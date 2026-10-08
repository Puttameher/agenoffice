"""
router.py — Lightweight intent router.

Classifies each user message into one of three execution paths:

  CHAT  → direct LLM answer (greetings, explanations, questions)
  TOOL  → single tool execution + optional LLM response
  AGENT → full Manager/LangGraph orchestration (build, research, multi-step)

The router uses one fast LLM call with a minimal prompt.
It only classifies — it never solves the task, plans, or retrieves data.

Falls back to keyword heuristics if the LLM call fails.
"""

import re
import json
from dataclasses import dataclass, field
from typing import Optional

from backend.app.llm import llm_generate, is_live_connected

# ---------------------------------------------------------------------------
# Route constants
# ---------------------------------------------------------------------------
CHAT  = "chat"
TOOL  = "tool"
AGENT = "agent"

# ---------------------------------------------------------------------------
# Router result
# ---------------------------------------------------------------------------
@dataclass
class RouteDecision:
    route: str              # "chat" | "tool" | "agent"
    tool: Optional[str]     # tool name when route == "tool", else None
    reason: str             # one-sentence explanation (for debug logs)
    confidence: float = 1.0 # 0.0–1.0

# ---------------------------------------------------------------------------
# Router system prompt — must stay very small
# ---------------------------------------------------------------------------
_ROUTER_SYSTEM = """\
You are a routing classifier for an AI assistant.
Classify the user message into exactly one route.

CHAT  — answer directly without external actions
        (greetings, factual questions, explanations, summaries, casual chat)

TOOL  — exactly ONE straightforward external action is needed
        (arithmetic calculation, weather lookup, time lookup, Gmail check, file open)

AGENT — multi-step orchestration is genuinely needed
        (build/code/implement projects, research across multiple sources,
         analyze repositories, generate artifacts, run + test + fix code)

Decision rules:
- Prefer CHAT unless an external action is clearly required.
- Prefer TOOL over AGENT when only ONE tool call is needed.
- Use AGENT only when planning, code execution, or multiple steps are involved.
- A long question does NOT automatically mean AGENT.
- A simple calculation is TOOL, not AGENT.

Reply with ONLY this JSON (no other text):
{"route": "chat"|"tool"|"agent", "tool": "tool_name_or_null", "reason": "one sentence", "confidence": 0.0_to_1.0}
"""

# ---------------------------------------------------------------------------
# Keyword fallback heuristics (used when LLM is unavailable)
# ---------------------------------------------------------------------------
_AGENT_SIGNALS = re.compile(
    r"\b(build|create|implement|write|develop|code|program|"
    r"scaffold|make a|generate a|run and test|research and|"
    r"analyze (the|this)|fix (the|this|my)|refactor|debug|"
    r"set up|setup|deploy|launch|install|scrape|automate|"
    r"compare .+ and .+|build .+ app|write .+ script)\b",
    re.IGNORECASE,
)

_TOOL_SIGNALS = re.compile(
    r"\b(calculate|compute|what is \d|whats \d|\d\s*[\+\-\*\/]\s*\d|"
    r"weather in|time in|time at|current time in|what time in|"
    r"check (my )?gmail|search (my )?gmail|check email|open file|read file)\b",
    re.IGNORECASE,
)

_AGENT_BUILD_VERBS = {"build", "create", "implement", "write", "develop", "code",
                       "program", "scaffold", "generate", "produce", "research",
                       "analyze", "analyse", "investigate", "scrape"}


def _keyword_route(message: str) -> RouteDecision:
    """
    Fast keyword-based fallback when the LLM is not available.
    Returns a RouteDecision with lower confidence.
    """
    lower = message.lower().strip()
    words = set(lower.split())

    if _AGENT_SIGNALS.search(lower) or (words & _AGENT_BUILD_VERBS):
        return RouteDecision(
            route=AGENT,
            tool=None,
            reason="Keyword match: build/code/research task detected.",
            confidence=0.75,
        )

    if _TOOL_SIGNALS.search(lower):
        # Detect which tool
        tool = "calculator"
        if any(kw in lower for kw in ["weather", "temperature"]):
            tool = "weather"
        elif any(kw in lower for kw in ["time in", "time at", "what time", "current time"]):
            tool = "time"
        elif any(kw in lower for kw in ["gmail", "email"]):
            tool = "gmail"
        elif any(kw in lower for kw in ["open file", "read file"]):
            tool = "laptop_file_reader"
        return RouteDecision(
            route=TOOL,
            tool=tool,
            reason="Keyword match: single tool action detected.",
            confidence=0.75,
        )

    return RouteDecision(
        route=CHAT,
        tool=None,
        reason="No action keywords found — treating as conversational.",
        confidence=0.80,
    )


# ---------------------------------------------------------------------------
# Continuation detection
# ---------------------------------------------------------------------------
_CONTINUATION_PHRASES = {
    "go on", "continue", "build it", "do it", "proceed", "keep going",
    "run it", "make it", "create it", "yes do it", "execute it",
    "please do it", "go ahead", "yes", "do that", "sure", "ok do it",
}


def is_continuation(message: str) -> bool:
    """Returns True if the message is a short continuation of a prior task."""
    cleaned = re.sub(r"[^\w\s]", "", message.strip().lower()).strip()
    return cleaned in _CONTINUATION_PHRASES


# ---------------------------------------------------------------------------
# Main router function
# ---------------------------------------------------------------------------
async def classify_route(
    message: str,
    conversation_context: Optional[str] = None,
    active_task_route: Optional[str] = None,
) -> RouteDecision:
    """
    Classify a user message into CHAT, TOOL, or AGENT.

    Args:
        message: The current user message.
        conversation_context: Optional last 1-2 turns for context.
        active_task_route: If there's an active task, its route (e.g. "agent").

    Returns:
        RouteDecision with route, tool, reason, and confidence.
    """
    # Fast path: continuation of an active task
    if active_task_route and is_continuation(message):
        return RouteDecision(
            route=active_task_route,
            tool=None,
            reason="Continuation of active task.",
            confidence=0.99,
        )

    # Skip LLM classification if offline — use keyword fallback directly
    if not is_live_connected():
        decision = _keyword_route(message)
        print(f"[Router] Offline fallback → {decision.route.upper()} ({decision.reason})")
        return decision

    # Build the prompt
    context_block = ""
    if conversation_context:
        context_block = f"\n\nRecent context:\n{conversation_context}\n"

    prompt = f"{_ROUTER_SYSTEM}{context_block}\n\nUser message: \"{message}\""

    try:
        raw = llm_generate(prompt)

        # Extract JSON from response
        match = re.search(r"\{[\s\S]*?\}", raw)
        if match:
            data = json.loads(match.group(0))
        else:
            data = json.loads(raw)

        route = data.get("route", CHAT).lower()
        if route not in (CHAT, TOOL, AGENT):
            route = CHAT

        tool = data.get("tool") or None
        if isinstance(tool, str) and tool.lower() in ("null", "none", ""):
            tool = None

        reason = str(data.get("reason", ""))
        confidence = float(data.get("confidence", 0.9))

        decision = RouteDecision(route=route, tool=tool, reason=reason, confidence=confidence)
        print(f"[Router] {decision.route.upper()} (conf={decision.confidence:.2f}) — {decision.reason}")
        return decision

    except Exception as exc:
        print(f"[Router] LLM classification failed ({exc}), using keyword fallback.")
        return _keyword_route(message)
