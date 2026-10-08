import json
import re
from typing import Optional
from backend.app.models.schemas import ExperienceRecord, TaskEvaluation, FeedbackResponse
from backend.app.memory.memory_store import memory_store
from backend.app.llm import llm_generate

class ExperienceService:
    """
    Summarizes completed tasks and feedback into structured experiences
    and enables experience retrieval for future tasks.
    """
    @staticmethod
    def summarize_and_store(
        task_input: str,
        agent_output: str,
        evaluation: Optional[TaskEvaluation] = None,
        feedback: Optional[FeedbackResponse] = None
    ) -> ExperienceRecord:
        eval_info = f"Score: {evaluation.score}, Reason: {evaluation.reason}" if evaluation else "Not evaluated"
        fb_info = f"Rating: {feedback.rating}/5, Comment: {feedback.comment}" if feedback else "No human feedback provided yet."
        
        prompt = f"""
Act as an AI Organization Experience Summarizer.
Analyze this completed task, its evaluation, and human feedback to extract a reusable organizational learning experience.

Return ONLY a valid JSON object with:
- "task_summary": brief summary of what the task was
- "strategy": high level approach taken
- "what_worked": what was effective
- "what_failed": what could be improved or any errors encountered
- "lesson": key takeaway for future similar tasks

Task: {task_input}
Result: {agent_output}
Evaluation: {eval_info}
Feedback: {fb_info}
"""
        response_text = llm_generate(prompt)
        
        try:
            json_match = re.search(r"\{[\s\S]*\}", response_text)
            data = json.loads(json_match.group(0)) if json_match else json.loads(response_text)
            task_summary = data.get("task_summary", task_input[:80])
            strategy = data.get("strategy", "Executed task with agent skills and tools.")
            what_worked = data.get("what_worked", "Direct output structure.")
            what_failed = data.get("what_failed", "None")
            lesson = data.get("lesson", "Always verify constraints before finishing.")
        except Exception:
            task_summary = task_input[:80]
            strategy = "Utilized specialized agent capabilities and tools."
            what_worked = "Correctly parsed query and formatted response."
            what_failed = "None"
            lesson = "Continue breaking down multi-part calculations."

        fb_str = f"{feedback.rating} stars - {feedback.comment}" if feedback else None
        return memory_store.save_experience(
            task_summary=task_summary,
            strategy=strategy,
            what_worked=what_worked,
            what_failed=what_failed,
            lesson=lesson,
            feedback=fb_str
        )

experience_service = ExperienceService()
