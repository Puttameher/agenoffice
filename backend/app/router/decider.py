import json
import time
import hashlib
import asyncio
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Literal
from pydantic import BaseModel, Field

from backend.app.config import settings

class RoutingDecision(BaseModel):
    """Structured routing decision with typed primitives, calibrated probabilities, and escalation flags."""
    route: Literal["DIRECT", "TOOL", "MANAGER"]
    confidence: float = Field(default=0.9, ge=0.0, le=1.0)
    intent: str
    complexity_score: float = Field(default=0.0, ge=0.0, le=3.0)
    needs_tools: bool = False
    needs_tools_prob: float = Field(default=0.0, ge=0.0, le=1.0)
    needs_multistep: bool = False
    needs_multistep_prob: float = Field(default=0.0, ge=0.0, le=1.0)
    required_tools: List[str] = Field(default_factory=list)
    suggested_agents: List[str] = Field(default_factory=list)
    raw_probabilities: Dict[str, float] = Field(default_factory=dict)
    decider: str = "unknown"
    latency_ms: float = 0.0
    escalated: bool = False
    escalation_reason: Optional[str] = None


class Decider(ABC):
    """Abstract Decider interface for System One decision intelligence."""
    
    @abstractmethod
    async def decide_route(self, prompt: str, state: Optional[Dict[str, Any]] = None) -> RoutingDecision:
        """Evaluate prompt against typed questions: Choice, Score, and Nouls."""
        pass

    @abstractmethod
    async def decide_learning(self, task_summary: str, strategy: str, score: float) -> Dict[str, Any]:
        """Decide whether to Ignore, create Memory, or auto-generate a Skill."""
        pass


class JevDecider(Decider):
    """
    Real TypeSafe AI System One decision model integration.
    Queries https://api.typesafe.ai/v1/systemone via typesafe-sdk.
    """
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.TYPESAFE_API_KEY
        raw_base = base_url or settings.TYPESAFE_BASE_URL
        if raw_base and raw_base.endswith("/v1"):
            raw_base = raw_base[:-3]
        self.base_url = raw_base or "https://api.typesafe.ai"
        self.model = model or settings.TYPESAFE_MODEL or "jev-latest"

    async def decide_route(self, prompt: str, state: Optional[Dict[str, Any]] = None) -> RoutingDecision:
        if not self.api_key or len(self.api_key.strip()) < 5:
            raise ValueError("No valid TYPESAFE_API_KEY configured for JevDecider.")

        t0 = time.perf_counter()
        from typesafe_sdk import AsyncTypeSafeClient, Choice, Score, Noul

        active_state = state or {
            "document": prompt,
            "available_tools": ["filesystem", "terminal", "browser", "calculator", "screenshot"],
            "available_agents": ["Alex (Coder)", "Nova (Researcher)", "Kai (Browser)", "Rio (Analyst)"]
        }

        async with AsyncTypeSafeClient(api_key=self.api_key, base_url=self.base_url) as client:
            response = await asyncio.wait_for(
                client.system_one(
                    model=self.model,
                    state=active_state,
                    questions={
                        "route": Choice(
                            instructions="Determine the execution route for this user request.",
                            criteria={
                                "DIRECT": "Conversational reply, question, or explanation requiring no external tools or multi-step execution",
                                "TOOL": "Atomic standalone tool execution such as calculator, clock, weather, or single file read",
                                "MANAGER": "Multi-step research, web browsing, code generation, verification, or multi-agent orchestration"
                            }
                        ),
                        "complexity": Score(
                            instructions="Rate the technical and operational complexity of this request.",
                            criteria=["Trivial / Conversational", "Moderate / Single Tool", "Complex / Multi-Step Orchestration"]
                        ),
                        "needs_tools": Noul(instructions="Does this request require executing external tools like browser, shell, or file system?"),
                        "needs_multistep": Noul(instructions="Does completing this request require multi-step planning or subagent collaboration?")
                    }
                ),
                timeout=5.0
            )

        latency_ms = round((time.perf_counter() - t0) * 1000, 2)

        # Parse Choice answer
        choice_ans = response.choices.get("route")
        route_choice = choice_ans.choice if choice_ans else "DIRECT"
        route_conf = choice_ans.confidence if choice_ans else 0.8
        route_probs = choice_ans.probabilities if choice_ans else {"DIRECT": 0.8, "TOOL": 0.1, "MANAGER": 0.1}

        # Parse Score answer
        score_ans = response.scores.get("complexity")
        complexity = float(score_ans.score) if score_ans else 0.0

        # Parse Noul answers (calibrated probabilities [0.0, 1.0])
        tools_noul = response.nouls.get("needs_tools")
        tools_prob = float(tools_noul.noul) if tools_noul else 0.0

        multi_noul = response.nouls.get("needs_multistep")
        multi_prob = float(multi_noul.noul) if multi_noul else 0.0

        return RoutingDecision(
            route=route_choice,
            confidence=route_conf,
            intent=f"Evaluated by Jev ({route_choice})",
            complexity_score=complexity,
            needs_tools=tools_prob >= 0.50,
            needs_tools_prob=tools_prob,
            needs_multistep=multi_prob >= 0.50,
            needs_multistep_prob=multi_prob,
            raw_probabilities=route_probs,
            decider="jev",
            latency_ms=latency_ms
        )

    async def decide_learning(self, task_summary: str, strategy: str, score: float) -> Dict[str, Any]:
        if not self.api_key:
            raise ValueError("No valid TYPESAFE_API_KEY configured.")

        from typesafe_sdk import AsyncTypeSafeClient, Choice, Noul
        async with AsyncTypeSafeClient(api_key=self.api_key, base_url=self.base_url) as client:
            response = await client.system_one(
                model=self.model,
                state={
                    "task_summary": task_summary,
                    "strategy": strategy,
                    "evaluation_score": score
                },
                questions={
                    "learning_action": Choice(
                        instructions="Determine how to retain organizational learning from this completed task.",
                        criteria={
                            "IGNORE": "Trivial, one-off query or unsuccessful task with no reusable procedure",
                            "MEMORY": "User preference, factual insight, or short lesson worth remembering for future queries",
                            "SKILL": "Novel multi-step procedure, tool workflow, or reusable technique worth saving as a versioned skill"
                        }
                    ),
                    "is_novel": Noul(instructions="Does this task demonstrate a novel procedure or workflow?")
                }
            )

        ans = response.choices.get("learning_action")
        return {
            "action": ans.choice if ans else "MEMORY",
            "confidence": ans.confidence if ans else 0.85,
            "probabilities": ans.probabilities if ans else {}
        }


class LLMDecider(Decider):
    """
    Fallback Decider using structured output from the active main LLM (Groq / Ollama / OpenRouter).
    Emulates Jev's typed Choice/Score/Noul primitives with calibrated probability distributions.
    """
    def __init__(self):
        pass

    async def decide_route(self, prompt: str, state: Optional[Dict[str, Any]] = None) -> RoutingDecision:
        t0 = time.perf_counter()
        from backend.app.llm import llm_generate

        system_prompt = """You are Jev Decider, a System One decision evaluator for multi-agent workflows.
Evaluate the user prompt and return a strict JSON decision evaluating typed primitives:

1. choice "route": "DIRECT" (conversational/facts/greetings), "TOOL" (single atomic math/file/weather/time/calculator tool), or "MANAGER" (multi-step coding, web search, browsing, project building, multi-agent coordination).
2. probabilities: Dict of calibrated probabilities for DIRECT, TOOL, MANAGER summing to 1.0.
3. confidence: Float 0.0 to 1.0 for the selected route.
4. complexity: Float score from 0.0 (trivial) to 2.0 (multi-step complex workflow).
5. needs_tools_prob: Float probability 0.0 to 1.0 whether external tools are needed.
6. needs_multistep_prob: Float probability 0.0 to 1.0 whether multi-step orchestration is needed.
7. required_tools: List of tool names needed (e.g. ["calculator"], ["browser"], ["terminal", "filesystem"], or []).
8. suggested_agents: List of recommended agent names (e.g. ["Alex"], ["Nova"], ["Kai"], ["Manager"]).
9. intent: One concise sentence describing the user's core intent.

Reply ONLY with valid JSON in this exact structure:
{
  "route": "DIRECT" | "TOOL" | "MANAGER",
  "confidence": 0.95,
  "probabilities": {"DIRECT": 0.05, "TOOL": 0.05, "MANAGER": 0.90},
  "complexity": 1.8,
  "needs_tools_prob": 0.95,
  "needs_multistep_prob": 0.85,
  "required_tools": ["browser", "filesystem"],
  "suggested_agents": ["Nova", "Alex"],
  "intent": "Research and summarize findings"
}"""

        user_content = f"Evaluate this request:\n\"{prompt}\""
        raw_res = await asyncio.to_thread(llm_generate, f"{system_prompt}\n\n{user_content}")

        latency_ms = round((time.perf_counter() - t0) * 1000, 2)

        # Parse JSON
        try:
            import re
            m = re.search(r"\{[\s\S]*\}", raw_res)
            data = json.loads(m.group(0)) if m else json.loads(raw_res)
        except Exception:
            # Deterministic heuristic fallback
            lower = prompt.lower()
            if any(w in lower for w in ["calculate", "compute", "weather", "+", "-", "*", "/", "time in"]):
                data = {
                    "route": "TOOL",
                    "confidence": 0.90,
                    "probabilities": {"DIRECT": 0.05, "TOOL": 0.90, "MANAGER": 0.05},
                    "complexity": 0.8,
                    "needs_tools_prob": 0.95,
                    "needs_multistep_prob": 0.10,
                    "required_tools": ["calculator"],
                    "suggested_agents": ["Manager"],
                    "intent": "Run standalone tool"
                }
            elif any(w in lower for w in ["build", "create", "develop", "research", "browse", "scrape", "test", "investigate", "write script"]):
                data = {
                    "route": "MANAGER",
                    "confidence": 0.92,
                    "probabilities": {"DIRECT": 0.03, "TOOL": 0.10, "MANAGER": 0.87},
                    "complexity": 1.7,
                    "needs_tools_prob": 0.90,
                    "needs_multistep_prob": 0.85,
                    "required_tools": ["filesystem", "terminal"],
                    "suggested_agents": ["Alex", "Nova"],
                    "intent": "Multi-step project execution"
                }
            else:
                data = {
                    "route": "DIRECT",
                    "confidence": 0.95,
                    "probabilities": {"DIRECT": 0.92, "TOOL": 0.05, "MANAGER": 0.03},
                    "complexity": 0.2,
                    "needs_tools_prob": 0.05,
                    "needs_multistep_prob": 0.05,
                    "required_tools": [],
                    "suggested_agents": ["Manager"],
                    "intent": "Conversational inquiry"
                }

        route = data.get("route", "DIRECT").upper()
        if route not in ("DIRECT", "TOOL", "MANAGER"):
            route = "DIRECT"

        confidence = float(data.get("confidence", 0.85))
        probs = data.get("probabilities", {route: confidence})
        tools_prob = float(data.get("needs_tools_prob", 0.0))
        multi_prob = float(data.get("needs_multistep_prob", 0.0))

        return RoutingDecision(
            route=route,
            confidence=confidence,
            intent=str(data.get("intent", f"Route to {route}")),
            complexity_score=float(data.get("complexity", 0.5)),
            needs_tools=tools_prob >= 0.50,
            needs_tools_prob=tools_prob,
            needs_multistep=multi_prob >= 0.50,
            needs_multistep_prob=multi_prob,
            required_tools=data.get("required_tools", []),
            suggested_agents=data.get("suggested_agents", []),
            raw_probabilities=probs,
            decider="llm",
            latency_ms=latency_ms
        )

    async def decide_learning(self, task_summary: str, strategy: str, score: float) -> Dict[str, Any]:
        """Decide whether to IGNORE, store MEMORY, or generate a SKILL using structured LLM output."""
        from backend.app.llm import llm_generate
        prompt = f"""Evaluate this task outcome and decide whether to retain learning:
Task: {task_summary}
Strategy: {strategy}
Evaluation Score: {score}

Options:
- "IGNORE": Trivial or failed task with no reusable insights.
- "MEMORY": Short factual takeaway, preference, or lesson learned.
- "SKILL": Novel multi-step tool procedure worth turning into a reusable SKILL.md.

Reply with ONLY JSON:
{{"action": "IGNORE"|"MEMORY"|"SKILL", "confidence": 0.85, "reason": "one sentence"}}"""

        res = await asyncio.to_thread(llm_generate, prompt)
        try:
            import re
            m = re.search(r"\{[\s\S]*\}", res)
            data = json.loads(m.group(0)) if m else json.loads(res)
            return {
                "action": data.get("action", "MEMORY"),
                "confidence": float(data.get("confidence", 0.85)),
                "reason": data.get("reason", "Structured LLM assessment")
            }
        except Exception:
            return {
                "action": "SKILL" if score >= 0.85 and "code" in task_summary.lower() else ("MEMORY" if score >= 0.70 else "IGNORE"),
                "confidence": 0.80,
                "reason": "Default learning heuristic"
            }
