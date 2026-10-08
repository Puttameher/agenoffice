"""
MemoryWriter — decides where completed task knowledge should live.

After a task completes, call MemoryWriter.process().
It decides:
  - Should this go into machine memory (Chroma/SQLite experience)?
  - Should this become a human-readable Obsidian note?
  - Should it go to both?
  - Should it be skipped entirely?

Keep it simple: one LLM call, one decision, clear routing.

Destinations:
  machine  → SQLite experience record (existing system)
  obsidian → Obsidian vault markdown note
  both     → both of the above
  skip     → casual conversation, not worth storing
"""

import json
import re
from typing import Optional
from datetime import datetime

from backend.app.llm import llm_generate
from backend.app.models.schemas import TaskEvaluation, FeedbackResponse
from backend.app.memory.memory_store import memory_store
from backend.app.tools.obsidian_tool import ObsidianTool, _get_vault_path


class MemoryWriter:
    """
    Routes completed task information to the right storage layer.

    Call process() after every task. It is fast and cheap — uses
    a small LLM prompt to decide whether to persist anything.
    """

    def __init__(self):
        self._obsidian = ObsidianTool()

    def process(
        self,
        task_input: str,
        agent_output: str,
        evaluation: Optional[TaskEvaluation] = None,
        feedback: Optional[FeedbackResponse] = None,
    ) -> dict:
        """
        Main entry point. Returns a dict explaining what was stored.
        {
          "destination": "skip" | "machine" | "obsidian" | "both",
          "reason": "...",
          "obsidian_note_title": "...",   # only if obsidian was used
          "machine_lesson": "...",        # only if machine was used
        }
        """
        eval_info = f"Score: {evaluation.score:.2f}, Success: {evaluation.success}" if evaluation else "Not evaluated"
        fb_info   = f"Rating: {feedback.rating}/5 — {feedback.comment or ''}" if feedback else "No feedback"

        decision = self._decide(task_input, agent_output, eval_info, fb_info)

        result = {"destination": decision.get("destination", "skip"), "reason": decision.get("reason", "")}

        dest = result["destination"]

        # ---- machine memory -----------------------------------------------
        if dest in ("machine", "both"):
            lesson = decision.get("machine_lesson", "")
            if lesson:
                fb_str = fb_info if feedback else None
                memory_store.save_experience(
                    task_summary=decision.get("task_summary", task_input[:120]),
                    strategy=decision.get("strategy", "Direct execution"),
                    what_worked=decision.get("what_worked", "Completed task"),
                    what_failed=decision.get("what_failed", "None"),
                    lesson=lesson,
                    feedback=fb_str
                )
                result["machine_lesson"] = lesson

        # ---- obsidian note ------------------------------------------------
        if dest in ("obsidian", "both"):
            vault_ok = _get_vault_path() is not None
            if vault_ok:
                title   = decision.get("obsidian_note_title", "")
                content = decision.get("obsidian_note_content", "")
                if title and content:
                    # Try to find and update an existing note first
                    search_result = self._obsidian.run(
                        json.dumps({"op": "search_notes", "query": title})
                    )
                    note_exists = f"[[{title}]]" in search_result and "No notes found" not in search_result

                    if note_exists:
                        # Append new information instead of overwriting
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

    # ------------------------------------------------------------------ #

    def _decide(self, task_input: str, agent_output: str, eval_info: str, fb_info: str) -> dict:
        """
        Ask the LLM: what kind of memory does this task deserve?
        Returns a structured dict.
        """
        prompt = f"""You are a memory router for an AI system.
Analyze the task and output below and decide what to remember.

Task: {task_input[:400]}
Output (first 600 chars): {agent_output[:600]}
Evaluation: {eval_info}
Feedback: {fb_info}

Decide the destination:
- "skip"    — casual conversation, greeting, simple Q&A, not worth storing
- "machine" — useful strategy or lesson for future AI tasks (not human-readable knowledge)
- "obsidian"— important technical concept, project decision, or reference a human would want to read
- "both"    — qualifies for both machine and human knowledge

Return ONLY valid JSON. No explanation outside the JSON.
{{
  "destination": "skip" | "machine" | "obsidian" | "both",
  "reason": "one sentence why",
  "task_summary": "brief task description",
  "strategy": "what approach was taken",
  "what_worked": "what was effective",
  "what_failed": "any issues",
  "machine_lesson": "reusable lesson for AI (empty string if not machine)",
  "obsidian_note_title": "Note Title Without .md (empty string if not obsidian)",
  "obsidian_note_content": "full markdown content for the note (empty string if not obsidian)"
}}"""

        raw = llm_generate(prompt)

        try:
            match = re.search(r"\{[\s\S]*\}", raw)
            return json.loads(match.group(0)) if match else json.loads(raw)
        except Exception:
            # Fallback — if parsing fails, just skip
            return {"destination": "skip", "reason": "Could not parse decision."}

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
