import hashlib
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from backend.app.config import settings
from backend.app.router.decider import Decider, JevDecider, LLMDecider, RoutingDecision
from backend.app.database.repository import Repository

# Route enum aliases
DIRECT = "DIRECT"
TOOL = "TOOL"
MANAGER = "MANAGER"

class JevRouter:
    """
    Jev Decision Router.
    Routes user input through System One decision intelligence (real Jev or LLM fallback),
    applies confidence-based escalation advice, and logs decisions to SQLite.
    """
    def __init__(self, confidence_threshold: Optional[float] = None):
        self.confidence_threshold = confidence_threshold or settings.CONFIDENCE_THRESHOLD
        self.jev_decider = JevDecider()
        self.llm_decider = LLMDecider()

    async def route(self, prompt: str, state: Optional[Dict[str, Any]] = None, force_decider: Optional[str] = None) -> RoutingDecision:
        """
        Evaluate route using JevDecider with automatic fallback to LLMDecider.
        Applies confidence-based safety escalation and logs to SQLite.
        """
        decision: Optional[RoutingDecision] = None
        decider_used = "unknown"

        # 1. Try JevDecider if requested or if TYPESAFE_API_KEY is present
        if force_decider == "jev" or (force_decider != "llm" and settings.TYPESAFE_API_KEY and len(settings.TYPESAFE_API_KEY.strip()) > 5):
            try:
                decision = await self.jev_decider.decide_route(prompt, state=state)
                decider_used = "jev"
            except Exception as e:
                print(f"[JevRouter] Jev API call failed ({e}). Falling back to LLMDecider.")

        # 2. Fallback to LLMDecider
        if decision is None:
            decision = await self.llm_decider.decide_route(prompt, state=state)
            decider_used = "llm"

        decision.decider = decider_used

        # 3. Apply Escalation Rules (Advice Model)
        # Escalation rule 1: If confidence < threshold, escalate along DIRECT -> TOOL -> MANAGER
        if decision.confidence < self.confidence_threshold:
            if decision.route == DIRECT:
                decision.route = TOOL
                decision.escalated = True
                decision.escalation_reason = f"Low confidence ({decision.confidence:.2f} < {self.confidence_threshold:.2f}) on DIRECT; escalated to TOOL."
            elif decision.route == TOOL:
                decision.route = MANAGER
                decision.escalated = True
                decision.escalation_reason = f"Low confidence ({decision.confidence:.2f} < {self.confidence_threshold:.2f}) on TOOL; escalated to MANAGER."

        # Escalation rule 2: Check needs_tools & needs_multistep probability flags
        if decision.route == DIRECT and (decision.needs_tools or decision.needs_tools_prob >= 0.50):
            decision.route = TOOL
            decision.escalated = True
            decision.escalation_reason = f"Noul indicates tools needed (prob={decision.needs_tools_prob:.2f}); escalated DIRECT to TOOL."

        if decision.route == TOOL and (decision.needs_multistep or decision.needs_multistep_prob >= 0.50):
            decision.route = MANAGER
            decision.escalated = True
            decision.escalation_reason = f"Noul indicates multi-step execution needed (prob={decision.needs_multistep_prob:.2f}); escalated TOOL to MANAGER."

        # 4. Log Decision to SQLite
        try:
            input_hash = hashlib.sha256(prompt.strip().encode("utf-8")).hexdigest()[:16]
            now_iso = datetime.now(timezone.utc).isoformat()
            decision_record = {
                "id": f"dec_{uuid.uuid4().hex[:12]}",
                "input_hash": input_hash,
                "prompt": prompt,
                "route": decision.route,
                "confidence": decision.confidence,
                "choice": decision.route,
                "score": decision.complexity_score,
                "noul": decision.needs_tools_prob,
                "probabilities": decision.raw_probabilities,
                "decider": decision.decider,
                "latency_ms": decision.latency_ms,
                "created_at": now_iso
            }
            Repository.save_decision(decision_record)
        except Exception as e:
            print(f"[JevRouter] Error logging decision to SQLite: {e}")

        return decision

    async def decide_learning(self, task_summary: str, strategy: str, score: float, force_decider: Optional[str] = None) -> Dict[str, Any]:
        """Decide learning action (IGNORE, MEMORY, or SKILL) via Jev or fallback."""
        if force_decider == "jev" or (force_decider != "llm" and settings.TYPESAFE_API_KEY and len(settings.TYPESAFE_API_KEY.strip()) > 5):
            try:
                return await self.jev_decider.decide_learning(task_summary, strategy, score)
            except Exception as e:
                print(f"[JevRouter] Jev decide_learning failed ({e}), using LLMDecider.")
        return await self.llm_decider.decide_learning(task_summary, strategy, score)

# Global singleton router
jev_router = JevRouter()

async def route_request(prompt: str, state: Optional[Dict[str, Any]] = None) -> RoutingDecision:
    """Convenience helper to route a request with default router."""
    return await jev_router.route(prompt, state=state)
