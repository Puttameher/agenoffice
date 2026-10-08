from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field

# Event types
EventType = Literal[
    "TASK_CREATED",
    "AGENT_ASSIGNED",
    "AGENT_STARTED",
    "AGENT_WORKING",
    "AGENT_RETRIEVING",
    "AGENT_COMPLETED",
    "EVALUATION_COMPLETED",
    "FEEDBACK_RECEIVED",
    "EXPERIENCE_CREATED",
    "AGENT_CREATED",
    "AGENT_ARCHIVED",
    "TASK_COMPLETED",
    "TASK_FAILED",
    "DIRECT_CHAT_MESSAGE",
    "LLM_CONFIG_UPDATED",
    "ROUTE_DECIDED",
]

AgentStatus = Literal["idle", "assigned", "working", "completed", "archived"]
TaskStatus = Literal[
    "pending",
    "planning",
    "running",
    "testing",
    "fixing",
    "completed",
    "failed"
]

# --- AGENT SCHEMAS ---
class AgentConfig(BaseModel):
    id: str
    name: str
    role: str
    description: str
    instructions: str
    system_prompt: Optional[str] = None   # alias for instructions; if set, takes precedence
    model: Optional[str] = None           # per-agent model override (e.g. "gpt-4o", "hermes-3-openrouter")
    skills: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    permanent: bool = True
    memory_enabled: bool = True
    status: AgentStatus = "idle"
    desk_id: int = 1
    level: int = 1
    xp: int = 0
    badges: List[str] = Field(default_factory=list)
    tasks_completed: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class AgentCreatePromptRequest(BaseModel):
    """User request to create an agent — accepts either a natural-language prompt or the
    full structured fields from the expanded hire drawer form."""
    prompt: str
    name: Optional[str] = None
    description: Optional[str] = None
    tools: Optional[List[str]] = None
    model: Optional[str] = None
    memory_enabled: bool = True

class AgentUpdateRequest(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None
    skills: Optional[List[str]] = None
    tools: Optional[List[str]] = None
    status: Optional[AgentStatus] = None
    desk_id: Optional[int] = None

# --- TASK SCHEMAS ---
class TaskCreateRequest(BaseModel):
    user_input: str
    assigned_agent_id: Optional[str] = None  # None allows orchestrator to decide

class TaskResponse(BaseModel):
    id: str
    user_input: str
    assigned_agent_id: Optional[str] = None
    collaborating_agent_id: Optional[str] = None
    status: TaskStatus = "pending"
    result: Optional[str] = None
    retries: int = 0
    tokens_used: int = 0
    latency_ms: float = 0.0
    cost_usd: float = 0.0
    artifacts: Optional[Dict[str, Any]] = None
    created_at: str
    completed_at: Optional[str] = None

# --- EVALUATION & FEEDBACK SCHEMAS ---
class TaskEvaluation(BaseModel):
    id: str
    task_id: str
    success: bool
    score: float  # 0.0 to 1.0
    reason: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class FeedbackCreateRequest(BaseModel):
    task_id: str
    rating: int = Field(ge=1, le=5)  # 1 to 5 stars
    comment: Optional[str] = None

class FeedbackResponse(BaseModel):
    id: str
    task_id: str
    rating: int
    comment: Optional[str] = None
    created_at: str

# --- MEMORY & EXPERIENCE SCHEMAS ---
class MemoryRecord(BaseModel):
    id: str
    agent_id: str
    key: str
    content: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ExperienceRecord(BaseModel):
    id: str
    task_summary: str
    strategy: str
    what_worked: str
    what_failed: str
    feedback: Optional[str] = None
    lesson: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# --- EVENT SCHEMAS ---
class OfficeEvent(BaseModel):
    id: str
    type: EventType
    agent_id: Optional[str] = None
    task_id: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    metadata: Dict[str, Any] = Field(default_factory=dict)

# --- EXECUTION RESULT (internal — never sent directly to user) ---
class ExecutionResult(BaseModel):
    """
    Structured result returned by worker nodes inside the graph.
    The Manager converts this into a clean natural-language response.
    """
    status: str  # completed | failed | partial
    summary: str
    files_created: List[str] = Field(default_factory=list)
    files_modified: List[str] = Field(default_factory=list)
    commands_run: List[str] = Field(default_factory=list)
    tests: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
    artifacts: List[str] = Field(default_factory=list)

# --- ORGANIZATION STATE ---
class OrganizationState(BaseModel):
    manager: Dict[str, Any]
    agents: List[AgentConfig]
    active_tasks: List[TaskResponse]
    recent_events: List[OfficeEvent]
    total_completed_tasks: int
    total_experiences: int
    total_tokens: int = 0
    total_cost_usd: float = 0.0
    avg_latency_ms: float = 0.0

# --- NEW PRD SCHEMAS ---

class TaskStep(BaseModel):
    """Tracks each atomic step inside a task execution."""
    id: str
    task_id: str
    agent_id: Optional[str] = None
    tool_id: Optional[str] = None
    step_input: Optional[str] = None
    step_output: Optional[str] = None
    status: str = "pending"  # pending | running | completed | failed
    retry_count: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Artifact(BaseModel):
    """File or output produced by a task."""
    id: str
    task_id: str
    artifact_type: str = "file"   # file | report | screenshot | code
    path: Optional[str] = None
    reference: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class SkillRecord(BaseModel):
    """Reusable learned procedure with versioning."""
    id: str
    name: str
    description: str
    procedure: str                       # step-by-step instructions for the skill
    required_tools: List[str] = Field(default_factory=list)
    version: int = 1
    status: str = "active"              # active | deprecated | unvalidated
    learned_corrections: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class SkillCreateRequest(BaseModel):
    """Request to register a new skill."""
    name: str
    description: str
    procedure: str
    required_tools: List[str] = Field(default_factory=list)

class ToolRecord(BaseModel):
    """Tool registry entry with permission policy."""
    id: str
    name: str
    description: str
    permission_policy: str = "restricted"   # open | restricted | admin_only
    enabled: bool = True
    call_count: int = 0
    last_used: Optional[str] = None

class OfficeMetrics(BaseModel):
    """System-wide metrics for the metrics dashboard."""
    total_tasks: int = 0
    completed_tasks: int = 0
    failed_tasks: int = 0
    success_rate: float = 0.0
    avg_latency_ms: float = 0.0
    total_tokens: int = 0
    total_cost_usd: float = 0.0
    total_retries: int = 0
    tool_usage: Dict[str, int] = Field(default_factory=dict)
    agent_task_counts: Dict[str, int] = Field(default_factory=dict)
