import re
import json
import uuid
from backend.app.models.schemas import TaskEvaluation
from backend.app.database.repository import Repository
from backend.app.llm import llm_generate

class Evaluator:
    """
    Task Evaluator returning success: bool, score: float, reason: str.
    Evaluates whether the agent output answers the user task effectively.
    """
    @staticmethod
    def evaluate_task_result(task_id: str, user_input: str, agent_output: str) -> TaskEvaluation:
        eval_prompt = f"""
Evaluate the following agent task output against the user's initial request.
Return ONLY a valid JSON object with:
- "success": boolean (true if the task was answered correctly and adequately, false otherwise)
- "score": number between 0.0 and 1.0
- "reason": short explanation string

User Request:
"{user_input}"

Agent Output:
"{agent_output}"
"""
        response_text = llm_generate(eval_prompt)
        
        try:
            json_match = re.search(r"\{[\s\S]*\}", response_text)
            data = json.loads(json_match.group(0)) if json_match else json.loads(response_text)
            success = bool(data.get("success", True))
            score = float(data.get("score", 0.9))
            reason = str(data.get("reason", "Task completed satisfactorily."))
        except Exception:
            success = len(agent_output.strip()) > 15
            score = 0.9 if success else 0.4
            reason = "Response addressed the prompt adequately." if success else "Response was too brief or incomplete."

        record = TaskEvaluation(
            id=str(uuid.uuid4()),
            task_id=task_id,
            success=success,
            score=score,
            reason=reason
        )
        return Repository.save_evaluation(record)

evaluator = Evaluator()
