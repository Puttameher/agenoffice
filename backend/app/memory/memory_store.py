import uuid
from typing import List, Optional, Dict, Any
from backend.app.models.schemas import MemoryRecord, ExperienceRecord
from backend.app.database.repository import Repository

class MemoryStore:
    """
    3-Tier Memory Architecture:
    1. Ephemeral Task State (handled inside LangGraph state during the task lifecycle)
    2. Persistent Agent Memory (specific notes, user preferences, or configurations for an individual agent)
    3. Experience Memory (organization-wide distilled learnings and lessons retrieved across agents)
    """

    # --- TIER 2: PERSISTENT AGENT MEMORY ---
    @staticmethod
    def save_agent_note(agent_id: str, key: str, content: str) -> MemoryRecord:
        record = MemoryRecord(
            id=str(uuid.uuid4()),
            agent_id=agent_id,
            key=key,
            content=content
        )
        return Repository.save_memory(record)

    @staticmethod
    def get_agent_memories(agent_id: str) -> List[MemoryRecord]:
        return Repository.get_agent_memories(agent_id)

    @staticmethod
    def format_agent_memories_for_prompt(agent_id: str) -> str:
        memories = Repository.get_agent_memories(agent_id)
        if not memories:
            return ""
        lines = [f"- [{m.key}]: {m.content}" for m in memories]
        return "Agent Memory Notes:\n" + "\n".join(lines)

    # --- TIER 3: EXPERIENCE MEMORY ---
    @staticmethod
    def save_experience(
        task_summary: str,
        strategy: str,
        what_worked: str,
        what_failed: str,
        lesson: str,
        feedback: Optional[str] = None
    ) -> ExperienceRecord:
        record = ExperienceRecord(
            id=str(uuid.uuid4()),
            task_summary=task_summary,
            strategy=strategy,
            what_worked=what_worked,
            what_failed=what_failed,
            feedback=feedback,
            lesson=lesson
        )
        return Repository.save_experience(record)

    @staticmethod
    def get_relevant_experiences(task_query: str, limit: int = 3) -> List[ExperienceRecord]:
        """Simple retrieval of relevant past experiences for a task query."""
        all_exps = Repository.list_experiences(limit=20)
        if not all_exps:
            return []
        
        words = set(task_query.lower().split())
        scored = []
        for exp in all_exps:
            summary_words = set(exp.task_summary.lower().split()) | set(exp.lesson.lower().split())
            overlap = len(words.intersection(summary_words))
            scored.append((overlap, exp))
        
        scored.sort(key=lambda x: x[0], reverse=True)
        return [exp for _, exp in scored[:limit]]

    @staticmethod
    def format_experiences_for_prompt(experiences: List[ExperienceRecord]) -> str:
        if not experiences:
            return ""
        sections = []
        for i, exp in enumerate(experiences, 1):
            sections.append(
                f"Past Experience #{i}:\n"
                f"- Task: {exp.task_summary}\n"
                f"- Strategy: {exp.strategy}\n"
                f"- What Worked: {exp.what_worked}\n"
                f"- Lesson: {exp.lesson}"
            )
        return "Relevant Past Organizational Experiences:\n" + "\n\n".join(sections)

memory_store = MemoryStore()
