import json
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from backend.app.database.db import get_db_connection
from backend.app.models.schemas import (
    AgentConfig, TaskResponse, TaskEvaluation, FeedbackResponse,
    MemoryRecord, ExperienceRecord, OfficeEvent,
    TaskStep, Artifact, SkillRecord, ToolRecord, OfficeMetrics
)

class Repository:
    # --- AGENT METHODS ---
    @staticmethod
    def save_agent(agent: AgentConfig) -> AgentConfig:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO agents 
            (id, name, role, description, instructions, skills, tools, permanent, memory_enabled, status, desk_id, level, xp, badges, tasks_completed, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            agent.id, agent.name, agent.role, agent.description, agent.instructions,
            json.dumps(agent.skills), json.dumps(agent.tools),
            1 if agent.permanent else 0,
            1 if agent.memory_enabled else 0,
            agent.status, agent.desk_id,
            getattr(agent, "level", 1), getattr(agent, "xp", 0),
            json.dumps(getattr(agent, "badges", [])),
            getattr(agent, "tasks_completed", 0),
            agent.created_at
        ))
        conn.commit()
        conn.close()
        return agent

    @staticmethod
    def get_agent(agent_id: str) -> Optional[AgentConfig]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM agents WHERE id = ?", (agent_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        badges = []
        try:
            badges = json.loads(row["badges"]) if "badges" in row.keys() and row["badges"] else []
        except Exception:
            badges = []
        return AgentConfig(
            id=row["id"],
            name=row["name"],
            role=row["role"],
            description=row["description"],
            instructions=row["instructions"],
            skills=json.loads(row["skills"]),
            tools=json.loads(row["tools"]),
            permanent=bool(row["permanent"]),
            memory_enabled=bool(row["memory_enabled"]),
            status=row["status"],
            desk_id=row["desk_id"],
            level=row["level"] if "level" in row.keys() and row["level"] is not None else 1,
            xp=row["xp"] if "xp" in row.keys() and row["xp"] is not None else 0,
            badges=badges,
            tasks_completed=row["tasks_completed"] if "tasks_completed" in row.keys() and row["tasks_completed"] is not None else 0,
            created_at=row["created_at"]
        )

    @staticmethod
    def list_agents(include_archived: bool = False) -> List[AgentConfig]:
        conn = get_db_connection()
        cursor = conn.cursor()
        if include_archived:
            cursor.execute("SELECT * FROM agents ORDER BY created_at ASC")
        else:
            cursor.execute("SELECT * FROM agents WHERE status != 'archived' ORDER BY created_at ASC")
        rows = cursor.fetchall()
        conn.close()
        agents = []
        for r in rows:
            badges = []
            try:
                badges = json.loads(r["badges"]) if "badges" in r.keys() and r["badges"] else []
            except Exception:
                badges = []
            agents.append(
                AgentConfig(
                    id=r["id"],
                    name=r["name"],
                    role=r["role"],
                    description=r["description"],
                    instructions=r["instructions"],
                    skills=json.loads(r["skills"]),
                    tools=json.loads(r["tools"]),
                    permanent=bool(r["permanent"]),
                    memory_enabled=bool(r["memory_enabled"]),
                    status=r["status"],
                    desk_id=r["desk_id"],
                    level=r["level"] if "level" in r.keys() and r["level"] is not None else 1,
                    xp=r["xp"] if "xp" in r.keys() and r["xp"] is not None else 0,
                    badges=badges,
                    tasks_completed=r["tasks_completed"] if "tasks_completed" in r.keys() and r["tasks_completed"] is not None else 0,
                    created_at=r["created_at"]
                )
            )
        return agents

    @staticmethod
    def update_agent_status(agent_id: str, status: str):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE agents SET status = ? WHERE id = ?", (status, agent_id))
        conn.commit()
        conn.close()

    @staticmethod
    def reset_agents_to_idle():
        """Reset all non-archived agents to idle on startup.
        Fixes agents stuck in 'working' or 'assigned' from a previous interrupted run.
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE agents SET status = 'idle' WHERE status IN ('working', 'assigned', 'completed')"
        )
        conn.commit()
        conn.close()

    @staticmethod
    def delete_agent(agent_id: str):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM agents WHERE id = ?", (agent_id,))
        conn.commit()
        conn.close()

    # --- TASK METHODS ---
    @staticmethod
    def save_task(task: TaskResponse) -> TaskResponse:
        conn = get_db_connection()
        cursor = conn.cursor()
        artifacts_json = json.dumps(task.artifacts) if task.artifacts else None
        cursor.execute("""
            INSERT OR REPLACE INTO tasks 
            (id, user_input, assigned_agent_id, collaborating_agent_id, status, result, retries, tokens_used, latency_ms, cost_usd, artifacts, created_at, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            task.id, task.user_input, task.assigned_agent_id, getattr(task, "collaborating_agent_id", None),
            task.status, task.result, task.retries, getattr(task, "tokens_used", 0),
            getattr(task, "latency_ms", 0.0), getattr(task, "cost_usd", 0.0),
            artifacts_json, task.created_at, task.completed_at
        ))
        conn.commit()
        conn.close()
        return task

    @staticmethod
    def get_task(task_id: str) -> Optional[TaskResponse]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        artifacts = None
        if "artifacts" in row.keys() and row["artifacts"]:
            try:
                artifacts = json.loads(row["artifacts"])
            except Exception:
                artifacts = None
        return TaskResponse(
            id=row["id"],
            user_input=row["user_input"],
            assigned_agent_id=row["assigned_agent_id"],
            collaborating_agent_id=row["collaborating_agent_id"] if "collaborating_agent_id" in row.keys() else None,
            status=row["status"],
            result=row["result"],
            retries=row["retries"],
            tokens_used=row["tokens_used"] if "tokens_used" in row.keys() and row["tokens_used"] is not None else 0,
            latency_ms=row["latency_ms"] if "latency_ms" in row.keys() and row["latency_ms"] is not None else 0.0,
            cost_usd=row["cost_usd"] if "cost_usd" in row.keys() and row["cost_usd"] is not None else 0.0,
            artifacts=artifacts,
            created_at=row["created_at"],
            completed_at=row["completed_at"]
        )

    @staticmethod
    def list_tasks(limit: int = 50, exclude_system: bool = False) -> List[TaskResponse]:
        """List tasks. Pass exclude_system=True to hide CHAT/TOOL ghost tasks
        (assigned_agent_id in ('manager', 'tool_runner')) from the Task Board.
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        if exclude_system:
            # Only show real MANAGER tasks dispatched to actual agents
            cursor.execute(
                "SELECT * FROM tasks WHERE assigned_agent_id NOT IN ('manager', 'tool_runner') "
                "ORDER BY created_at DESC LIMIT ?",
                (limit,)
            )
        else:
            cursor.execute("SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        conn.close()
        tasks = []
        for r in rows:
            artifacts = None
            if "artifacts" in r.keys() and r["artifacts"]:
                try:
                    artifacts = json.loads(r["artifacts"])
                except Exception:
                    artifacts = None
            tasks.append(
                TaskResponse(
                    id=r["id"],
                    user_input=r["user_input"],
                    assigned_agent_id=r["assigned_agent_id"],
                    collaborating_agent_id=r["collaborating_agent_id"] if "collaborating_agent_id" in r.keys() else None,
                    status=r["status"],
                    result=r["result"],
                    retries=r["retries"],
                    tokens_used=r["tokens_used"] if "tokens_used" in r.keys() and r["tokens_used"] is not None else 0,
                    latency_ms=r["latency_ms"] if "latency_ms" in r.keys() and r["latency_ms"] is not None else 0.0,
                    cost_usd=r["cost_usd"] if "cost_usd" in r.keys() and r["cost_usd"] is not None else 0.0,
                    artifacts=artifacts,
                    created_at=r["created_at"],
                    completed_at=r["completed_at"]
                )
            )
        return tasks

    @staticmethod
    def award_agent_xp(agent_id: str, xp_gain: int = 150) -> Optional[AgentConfig]:
        """Awards XP to an agent, levels them up, and grants prestige badges."""
        agent = Repository.get_agent(agent_id)
        if not agent:
            return None
        
        agent.xp += xp_gain
        agent.tasks_completed += 1
        
        # Level curve: 1 + xp // 250 (up to level 10)
        new_level = min(10, 1 + (agent.xp // 250))
        agent.level = new_level
        
        # Badge Milestones
        badge_pool = [
            (1, "Apprentice"),
            (2, "Problem Solver"),
            (3, "Task Specialist"),
            (5, "Senior Architect"),
            (7, "Swarm Commander"),
            (10, "Master Principal")
        ]
        current_badges = set(agent.badges or [])
        for req_lvl, badge in badge_pool:
            if agent.level >= req_lvl:
                current_badges.add(badge)
        agent.badges = list(current_badges)
        
        Repository.save_agent(agent)
        return agent

    @staticmethod
    def get_office_telemetry() -> Dict[str, Any]:
        """Aggregates system-wide tokens, cost, and latency analytics.
        Only counts real MANAGER tasks (not CHAT/TOOL ghost entries).
        """
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            # Exclude chat messages (manager) and tool calls (tool_runner) from metrics
            cursor.execute("""
                SELECT 
                    SUM(tokens_used) as total_tokens,
                    SUM(cost_usd) as total_cost,
                    AVG(latency_ms) as avg_latency
                FROM tasks
                WHERE assigned_agent_id NOT IN ('manager', 'tool_runner')
            """)
            row = cursor.fetchone()
            conn.close()
            if row:
                return {
                    "total_tokens": row["total_tokens"] or 0,
                    "total_cost_usd": round(row["total_cost"] or 0.0, 4),
                    "avg_latency_ms": round(row["avg_latency"] or 0.0, 1)
                }
        except Exception:
            conn.close()
        return {"total_tokens": 0, "total_cost_usd": 0.0, "avg_latency_ms": 0.0}

    # --- EVALUATION METHODS ---
    @staticmethod
    def save_evaluation(eval_record: TaskEvaluation) -> TaskEvaluation:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO evaluations 
            (id, task_id, success, score, reason, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            eval_record.id, eval_record.task_id,
            1 if eval_record.success else 0,
            eval_record.score, eval_record.reason, eval_record.created_at
        ))
        conn.commit()
        conn.close()
        return eval_record

    @staticmethod
    def get_evaluation(task_id: str) -> Optional[TaskEvaluation]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM evaluations WHERE task_id = ?", (task_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        return TaskEvaluation(
            id=row["id"],
            task_id=row["task_id"],
            success=bool(row["success"]),
            score=row["score"],
            reason=row["reason"],
            created_at=row["created_at"]
        )

    # --- FEEDBACK METHODS ---
    @staticmethod
    def save_feedback(feedback: FeedbackResponse) -> FeedbackResponse:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO feedback 
            (id, task_id, rating, comment, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (
            feedback.id, feedback.task_id, feedback.rating, feedback.comment, feedback.created_at
        ))
        conn.commit()
        conn.close()
        return feedback

    @staticmethod
    def get_feedback(task_id: str) -> Optional[FeedbackResponse]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM feedback WHERE task_id = ?", (task_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None
        return FeedbackResponse(
            id=row["id"],
            task_id=row["task_id"],
            rating=row["rating"],
            comment=row["comment"],
            created_at=row["created_at"]
        )

    # --- MEMORY METHODS ---
    @staticmethod
    def save_memory(mem: MemoryRecord) -> MemoryRecord:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO memories 
            (id, agent_id, key, content, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (mem.id, mem.agent_id, mem.key, mem.content, mem.created_at))
        conn.commit()
        conn.close()
        return mem

    @staticmethod
    def get_agent_memories(agent_id: str) -> List[MemoryRecord]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM memories WHERE agent_id = ? ORDER BY created_at ASC", (agent_id,))
        rows = cursor.fetchall()
        conn.close()
        return [
            MemoryRecord(
                id=r["id"],
                agent_id=r["agent_id"],
                key=r["key"],
                content=r["content"],
                created_at=r["created_at"]
            )
            for r in rows
        ]

    # --- EXPERIENCE METHODS ---
    @staticmethod
    def save_experience(exp: ExperienceRecord) -> ExperienceRecord:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO experiences 
            (id, task_summary, strategy, what_worked, what_failed, feedback, lesson, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            exp.id, exp.task_summary, exp.strategy, exp.what_worked,
            exp.what_failed, exp.feedback, exp.lesson, exp.created_at
        ))
        conn.commit()
        conn.close()
        return exp

    @staticmethod
    def list_experiences(limit: int = 20) -> List[ExperienceRecord]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM experiences ORDER BY created_at DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        conn.close()
        return [
            ExperienceRecord(
                id=r["id"],
                task_summary=r["task_summary"],
                strategy=r["strategy"],
                what_worked=r["what_worked"],
                what_failed=r["what_failed"],
                feedback=r["feedback"],
                lesson=r["lesson"],
                created_at=r["created_at"]
            )
            for r in rows
        ]

    # --- EVENT METHODS ---
    @staticmethod
    def save_event(event: OfficeEvent) -> OfficeEvent:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO events (id, type, agent_id, task_id, timestamp, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            event.id, event.type, event.agent_id, event.task_id,
            event.timestamp, json.dumps(event.metadata)
        ))
        conn.commit()
        conn.close()
        return event

    @staticmethod
    def get_events_for_task(task_id: str) -> List[OfficeEvent]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM events WHERE task_id = ? ORDER BY timestamp ASC", (task_id,))
        rows = cursor.fetchall()
        conn.close()
        return [
            OfficeEvent(
                id=r["id"],
                type=r["type"],
                agent_id=r["agent_id"],
                task_id=r["task_id"],
                timestamp=r["timestamp"],
                metadata=json.loads(r["metadata"])
            )
            for r in rows
        ]

    @staticmethod
    def get_recent_events(limit: int = 30) -> List[OfficeEvent]:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM events ORDER BY timestamp DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        conn.close()
        return [
            OfficeEvent(
                id=r["id"],
                type=r["type"],
                agent_id=r["agent_id"],
                task_id=r["task_id"],
                timestamp=r["timestamp"],
                metadata=json.loads(r["metadata"])
            )
            for r in rows
        ]

# --- TASK STEP METHODS ---
@staticmethod
def save_task_step(step):
    conn = get_db_connection()
    cursor = conn.cursor()
    sql = (
        "INSERT OR REPLACE INTO task_steps "
        "(id, task_id, agent_id, tool_id, step_input, step_output, status, retry_count, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    cursor.execute(sql, (
        step.id, step.task_id, step.agent_id, step.tool_id,
        step.step_input, step.step_output, step.status,
        step.retry_count, step.created_at
    ))
    conn.commit()
    conn.close()
    return step

@staticmethod
def get_task_steps(task_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM task_steps WHERE task_id = ? ORDER BY created_at ASC",
        (task_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        TaskStep(
            id=r["id"], task_id=r["task_id"], agent_id=r["agent_id"],
            tool_id=r["tool_id"], step_input=r["step_input"],
            step_output=r["step_output"], status=r["status"],
            retry_count=r["retry_count"], created_at=r["created_at"]
        )
        for r in rows
    ]

# --- ARTIFACT METHODS ---
@staticmethod
def save_artifact(artifact):
    conn = get_db_connection()
    cursor = conn.cursor()
    sql = (
        "INSERT OR REPLACE INTO artifacts "
        "(id, task_id, artifact_type, path, reference, metadata, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    cursor.execute(sql, (
        artifact.id, artifact.task_id, artifact.artifact_type,
        artifact.path, artifact.reference,
        json.dumps(artifact.metadata) if artifact.metadata else None,
        artifact.created_at
    ))
    conn.commit()
    conn.close()
    return artifact

@staticmethod
def get_task_artifacts(task_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM artifacts WHERE task_id = ? ORDER BY created_at ASC",
        (task_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        Artifact(
            id=r["id"], task_id=r["task_id"], artifact_type=r["artifact_type"],
            path=r["path"], reference=r["reference"],
            metadata=json.loads(r["metadata"]) if r["metadata"] else None,
            created_at=r["created_at"]
        )
        for r in rows
    ]

# --- SKILL METHODS ---
@staticmethod
def save_skill(skill):
    conn = get_db_connection()
    cursor = conn.cursor()
    sql = (
        "INSERT OR REPLACE INTO skills "
        "(id, name, description, procedure, required_tools, version, "
        " status, learned_corrections, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    cursor.execute(sql, (
        skill.id, skill.name, skill.description, skill.procedure,
        json.dumps(skill.required_tools), skill.version, skill.status,
        skill.learned_corrections, skill.created_at, skill.updated_at
    ))
    conn.commit()
    conn.close()
    return skill

@staticmethod
def _row_to_skill(row):
    return SkillRecord(
        id=row["id"], name=row["name"], description=row["description"],
        procedure=row["procedure"],
        required_tools=json.loads(row["required_tools"]),
        version=row["version"], status=row["status"],
        learned_corrections=row["learned_corrections"],
        created_at=row["created_at"], updated_at=row["updated_at"]
    )

@staticmethod
def get_skill(skill_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM skills WHERE id = ?", (skill_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return Repository._row_to_skill(row)

@staticmethod
def get_skill_by_name(name):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM skills WHERE name = ? LIMIT 1", (name,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return Repository._row_to_skill(row)

@staticmethod
def list_skills(status=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    if status:
        cursor.execute(
            "SELECT * FROM skills WHERE status = ? ORDER BY name ASC",
            (status,)
        )
    else:
        cursor.execute(
            "SELECT * FROM skills WHERE status != 'deprecated' ORDER BY name ASC"
        )
    rows = cursor.fetchall()
    conn.close()
    return [Repository._row_to_skill(r) for r in rows]

# --- METRICS METHOD ---
@staticmethod
def get_metrics():
    """Compute office-wide metrics for the dashboard."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT COUNT(*) as cnt FROM tasks "
        "WHERE assigned_agent_id != 'tool_runner' OR assigned_agent_id IS NULL"
    )
    total_tasks = cursor.fetchone()["cnt"]

    cursor.execute(
        "SELECT COUNT(*) as cnt FROM tasks WHERE status = 'completed' "
        "AND (assigned_agent_id != 'tool_runner' OR assigned_agent_id IS NULL)"
    )
    completed_tasks = cursor.fetchone()["cnt"]

    cursor.execute("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'failed'")
    failed_tasks = cursor.fetchone()["cnt"]

    cursor.execute(
        "SELECT AVG(latency_ms) as avg_lat FROM tasks WHERE status = 'completed'"
    )
    avg_latency_ms = cursor.fetchone()["avg_lat"] or 0.0

    cursor.execute(
        "SELECT SUM(tokens_used) as total_tok, SUM(cost_usd) as total_cost FROM tasks"
    )
    row = cursor.fetchone()
    total_tokens = row["total_tok"] or 0
    total_cost_usd = row["total_cost"] or 0.0

    cursor.execute("SELECT SUM(retries) as total_ret FROM tasks")
    total_retries = cursor.fetchone()["total_ret"] or 0

    cursor.execute(
        "SELECT assigned_agent_id, COUNT(*) as cnt FROM tasks "
        "WHERE assigned_agent_id IS NOT NULL AND assigned_agent_id != 'tool_runner' "
        "GROUP BY assigned_agent_id"
    )
    agent_counts = {r["assigned_agent_id"]: r["cnt"] for r in cursor.fetchall()}
    conn.close()

    success_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0.0
    return OfficeMetrics(
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        failed_tasks=failed_tasks,
        success_rate=round(success_rate, 1),
        avg_latency_ms=round(avg_latency_ms, 1),
        total_tokens=total_tokens,
        total_cost_usd=round(total_cost_usd, 6),
        total_retries=total_retries,
        agent_task_counts=agent_counts
    )
