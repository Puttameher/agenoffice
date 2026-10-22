"""
MemoryWriter — Dual-Loop Memory Architecture (Jev Triage + LLM Summarization)

After a task completes, MemoryWriter evaluates and preserves knowledge:
1. Fast Classification (System 1 via Jev):
   - Real-time decision model: IGNORE (drop), MEMORY (SQLite experience), or SKILL (Obsidian note + experience).
   - If IGNORE (casual chitchat, greetings, trivial Q&A): short-circuits instantly with destination="skip".
     Zero generative tokens wasted, sub-25ms latency.
2. LLM Summarization (System 2):
   - Executed ONLY when Jev classifies the outcome as MEMORY or SKILL.
   - Distills execution artifacts:
     * task_summary, strategy, what_worked, what_failed
     * actionable machine_lesson for SQLite experiences table
     * formatted Obsidian markdown note with wikilinks (for SKILL / architecture insights)

Destinations:
  skip     → casual conversation, greeting, not worth storing
  machine  → SQLite experience record (via memory_store.save_experience)
  obsidian → Obsidian vault markdown note
  both     → both machine memory and Obsidian note
"""

import json
import re
import asyncio
import concurrent.futures
from typing import Optional, Dict, Any
from datetime import datetime

from backend.app.llm import llm_generate
from backend.app.models.schemas import TaskEvaluation, FeedbackResponse
from backend.app.memory.memory_store import memory_store
from backend.app.tools.obsidian_tool import ObsidianTool, _get_vault_path
from backend.app.router.router import jev_router


class MemoryWriter:
    """
    Dual-Loop Memory Architecture:
    System 1 (Jev Decider) for ultra-fast classification triage.
    System 2 (Generative LLM) for expressive summarization and distillation.
    """

    def __init__(self):
        self._obsidian = ObsidianTool()

    async def aprocess(
        self,
        task_input: str,
        agent_output: str,
        evaluation: Optional[TaskEvaluation] = None,
        feedback: Optional[FeedbackResponse] = None,
    ) -> dict:
        """
        Async entry point for dual-loop memory processing.
        Returns a dict explaining what was stored.
        {
          "destination": "skip" | "machine" | "obsidian" | "both",
          "triage_action": "IGNORE" | "MEMORY" | "SKILL",
          "reason": "...",
          "obsidian_note_title": "...",   # only if obsidian was used
          "machine_lesson": "...",        # only if machine was used
        }
        """
        score_val = evaluation.score if evaluation else 0.80

        # ------------------------------------------------------------------
        # 1. System 1 Fast Triage (Jev / System One Decision Model)
        # ------------------------------------------------------------------
        try:
            triage = await jev_router.decide_learning(
                task_summary=task_input[:300],
                strategy="Agent execution",
                score=score_val
            )
        except Exception as e:
            triage = {"action": "MEMORY", "confidence": 0.70, "reason": f"Fallback triage: {e}"}

        action = triage.get("action", "MEMORY").upper()
        confidence = float(triage.get("confidence", 0.85))
        reason = triage.get("reason", "Jev System 1 evaluation")

        # Fast Short-Circuit: Trivial queries never burn LLM summarization tokens
        if action == "IGNORE":
            return {
                "destination": "skip",
                "triage_action": "IGNORE",
                "confidence": confidence,
                "reason": f"Jev System 1 classified as IGNORE: {reason}"
            }

        # ------------------------------------------------------------------
        # 2. System 2 LLM Summarization (Invoked ONLY for MEMORY / SKILL)
        # ------------------------------------------------------------------
        eval_info = f"Score: {evaluation.score:.2f}, Success: {evaluation.success}" if evaluation else "Not evaluated"
        fb_info   = f"Rating: {feedback.rating}/5 — {feedback.comment or ''}" if feedback else "No feedback"

        summary = self._summarize_with_llm(task_input, agent_output, eval_info, fb_info, triage_action=action)

        dest = "both" if action == "SKILL" else "machine"

        result = {
            "destination": dest,
            "triage_action": action,
            "confidence": confidence,
            "reason": f"Jev System 1 ({action}): {reason}",
            "task_summary": summary.get("task_summary", task_input[:120]),
            "strategy": summary.get("strategy", "Direct execution")
        }

        # ---- Machine Memory (SQLite) --------------------------------------
        if dest in ("machine", "both"):
            lesson = summary.get("machine_lesson", "")
            if lesson:
                fb_str = fb_info if feedback else None
                memory_store.save_experience(
                    task_summary=summary.get("task_summary", task_input[:120]),
                    strategy=summary.get("strategy", "Direct execution"),
                    what_worked=summary.get("what_worked", "Completed task"),
                    what_failed=summary.get("what_failed", "None"),
                    lesson=lesson,
                    feedback=fb_str
                )
                result["machine_lesson"] = lesson

        # ---- Obsidian Note ------------------------------------------------
        if dest in ("obsidian", "both"):
            vault_ok = _get_vault_path() is not None
            if vault_ok:
                title   = summary.get("obsidian_note_title", "")
                content = summary.get("obsidian_note_content", "")
                if title and content:
                    search_result = self._obsidian.run(
                        json.dumps({"op": "search_notes", "query": title})
                    )
                    note_exists = f"[[{title}]]" in search_result and "No notes found" not in search_result

                    if note_exists:
                        self._obsidian.run(json.dumps({
                            "op": "append_note",
                            "title": title,
                            "text": content
                        }))
                        result["obsidian_note_title"] = title
                        result["obsidian_action"] = "appended"
                    else:
                        self._obsidian.run(json.dumps({
                            "op": "create_note",
                            "title": title,
                            "content": content
                        }))
                        result["obsidian_note_title"] = title
                        result["obsidian_action"] = "created"

        return result

    def process(
        self,
        task_input: str,
        agent_output: str,
        evaluation: Optional[TaskEvaluation] = None,
        feedback: Optional[FeedbackResponse] = None,
    ) -> dict:
        """
        Synchronous wrapper with automatic asyncio loop bridging.
        """
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                return executor.submit(
                    asyncio.run,
                    self.aprocess(task_input, agent_output, evaluation, feedback)
                ).result()
        else:
            return asyncio.run(self.aprocess(task_input, agent_output, evaluation, feedback))

    # ------------------------------------------------------------------ #

    def _summarize_with_llm(
        self,
        task_input: str,
        agent_output: str,
        eval_info: str,
        fb_info: str,
        triage_action: str
    ) -> dict:
        """
        System 2: Invoked ONLY when Jev confirms this task outcome deserves learning (MEMORY or SKILL).
        Distills the execution into structured summary, lessons, and optional markdown note.
        """
        is_skill = (triage_action == "SKILL")

        prompt = f"""You are an expert AI knowledge synthesizer.
Extract distilled organizational learning and insights from this completed task.

Task: {task_input[:500]}
Agent Output (first 800 chars): {agent_output[:800]}
Evaluation: {eval_info}
Feedback: {fb_info}
Learning Target: {"Novel Skill / Architectural Knowledge" if is_skill else "Tactical Experience / Machine Memory"}

Return ONLY valid JSON matching this schema:
{{
  "task_summary": "one concise sentence summarizing what was accomplished",
  "strategy": "the core approach or execution technique used",
  "what_worked": "what was effective or succeeded",
  "what_failed": "any stumbling blocks, errors fixed, or 'None'",
  "machine_lesson": "actionable, reusable heuristic or lesson for future agents",
  "obsidian_note_title": "Concise Note Title (empty string if not a skill/concept)",
  "obsidian_note_content": "Markdown note with headers and [[wikilinks]] (empty string if not a skill/concept)"
}}"""

        raw = llm_generate(prompt)

        try:
            match = re.search(r"\{[\s\S]*\}", raw)
            return json.loads(match.group(0)) if match else json.loads(raw)
        except Exception:
            return {
                "task_summary": task_input[:120],
                "strategy": "Direct agent execution",
                "what_worked": "Completed task successfully",
                "what_failed": "None",
                "machine_lesson": f"Completed: {task_input[:100]}",
                "obsidian_note_title": f"Skill - {task_input[:30]}" if is_skill else "",
                "obsidian_note_content": f"# {task_input[:30]}\n\n{agent_output[:400]}" if is_skill else ""
            }

    # ------------------------------------------------------------------ #
    # Manual "Save to Knowledge" — triggered by user explicitly           #
    # ------------------------------------------------------------------ #

    def save_to_knowledge(self, task_input: str, agent_output: str) -> dict:
        """
        User explicitly clicked "Save to Knowledge".
        Always write to Obsidian (if configured). Also write to machine memory.

        Returns info about what was saved.
        """
        vault_ok = _get_vault_path() is not None

        # Generate a clean knowledge note
        prompt = f"""Convert this AI-generated content into a clean Obsidian knowledge note.

Task/Question: {task_input[:400]}
Content: {agent_output[:1500]}

Return ONLY valid JSON:
{{
  "title": "concise note title",
  "content": "full markdown note with headers, bullet points, and [[wikilinks]] to related concepts"
}}

Rules for the note:
- Use ## headers to organize
- Include [[wikilinks]] to related concepts (e.g. [[LangGraph]], [[Python]], [[Agentic RAG]])
- Keep it concise — only facts and insights, no filler
- Write like a human wiki, not a chatbot response"""

        raw = llm_generate(prompt)

        try:
            match = re.search(r"\{[\s\S]*\}", raw)
            data = json.loads(match.group(0)) if match else json.loads(raw)
            title   = data.get("title", "Captured Note")
            content = data.get("content", agent_output[:800])
        except Exception:
            title   = "Captured Note"
            content = agent_output[:800]

        result = {"title": title, "vault_configured": vault_ok}

        if vault_ok:
            # Check if note exists and update/create accordingly
            search_result = self._obsidian.run(json.dumps({"op": "search_notes", "query": title}))
            note_exists = f"[[{title}]]" in search_result and "No notes found" not in search_result

            if note_exists:
                obsidian_result = self._obsidian.run(json.dumps({
                    "op": "append_note",
                    "title": title,
                    "text": content
                }))
                result["obsidian_action"] = "appended"
            else:
                obsidian_result = self._obsidian.run(json.dumps({
                    "op": "create_note",
                    "title": title,
                    "content": content
                }))
                result["obsidian_action"] = "created"

            result["obsidian_message"] = obsidian_result
        else:
            result["obsidian_action"] = "skipped"
            result["obsidian_message"] = "Obsidian vault not configured. Set OBSIDIAN_VAULT_PATH in .env"

        # Always save machine lesson too
        memory_store.save_experience(
            task_summary=task_input[:120],
            strategy="User-triggered knowledge capture",
            what_worked=agent_output[:200],
            what_failed="None",
            lesson=f"Key concept: {title}",
        )
        result["machine_saved"] = True

        return result


# Single instance used across the app
memory_writer = MemoryWriter()
