import uuid
import asyncio
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from pydantic import BaseModel

from backend.app.models.schemas import (
    AgentConfig, AgentCreatePromptRequest, AgentUpdateRequest,
    TaskCreateRequest, TaskResponse,
    FeedbackCreateRequest, FeedbackResponse,
    OfficeEvent, OrganizationState, ExperienceRecord, TaskEvaluation,
    SkillRecord, SkillCreateRequest, OfficeMetrics, TaskStep, Artifact
)
from backend.app.database.repository import Repository
from backend.app.events.event_bus import event_bus
from backend.app.agents.agent_factory import agent_factory
from backend.app.orchestration.state import AgentOfficeState
from backend.app.orchestration.graph import office_graph
from backend.app.orchestration.experience import experience_service
from backend.app.orchestration.router import classify_route, CHAT, TOOL, AGENT
from backend.app.orchestration.system_prompt import build_system_prompt, build_chat_prompt
from backend.app.api.websocket import ws_manager
from backend.app.memory.memory_writer import memory_writer
from backend.app.memory.memory_store import memory_store
from backend.app.llm import llm_config, test_llm_connection, is_live_connected, PROVIDER_CATALOG, llm_generate, get_llm

router = APIRouter()

# --- AGENT ROUTES ---
@router.post("/agents", response_model=AgentConfig)
async def create_agent(payload: AgentCreatePromptRequest):
    """Create a new permanent agent. Accepts a natural-language prompt plus optional
    structured override fields from the expanded hire drawer form."""
    agent = agent_factory.create_agent_from_prompt(
        payload.prompt,
        permanent=True,
        name_override=payload.name or None,
        description_override=payload.description or None,
        tools_override=payload.tools or None,
        model_override=payload.model or None,
        memory_enabled=payload.memory_enabled
    )
    await event_bus.emit(
        event_type="AGENT_CREATED",
        agent_id=agent.id,
        metadata={"name": agent.name, "role": agent.role, "skills": agent.skills, "desk_id": agent.desk_id}
    )
    return agent

@router.get("/agents", response_model=List[AgentConfig])
def list_agents(include_archived: bool = False):
    """Retrieve all agents in the office."""
    return Repository.list_agents(include_archived=include_archived)

@router.get("/agents/{agent_id}", response_model=AgentConfig)
def get_agent(agent_id: str):
    """Get single agent details by ID."""
    agent = Repository.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

@router.patch("/agents/{agent_id}", response_model=AgentConfig)
def update_agent(agent_id: str, updates: AgentUpdateRequest):
    """Update an existing agent's configuration."""
    agent = Repository.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    update_data = updates.model_dump(exclude_unset=True)
    updated_agent = agent.model_copy(update=update_data)
    Repository.save_agent(updated_agent)
    return updated_agent

@router.delete("/agents/{agent_id}")
async def delete_agent(agent_id: str):
    """Archive or remove an agent."""
    agent = Repository.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    Repository.update_agent_status(agent_id, "archived")
    await event_bus.emit(
        event_type="AGENT_ARCHIVED",
        agent_id=agent_id,
        metadata={"name": agent.name, "reason": "User requested archive"}
    )
    return {"message": f"Agent '{agent.name}' archived successfully."}

# --- TASK EXECUTION WORKER ---
async def run_task_in_graph(task_id: str, user_input: str, assigned_agent_id: Optional[str] = None):
    from backend.app.orchestration.intent import is_continuation, is_action
    from backend.app.orchestration.workspace import WorkspaceManager

    actual_input = user_input
    target_workspace_id = task_id

    # Handle continuation ('go on', 'continue', 'build it', 'do it')
    if is_continuation(user_input):
        recent_tasks = Repository.list_tasks(limit=10)
        prior = next((t for t in recent_tasks if t.id != task_id and not is_continuation(t.user_input) and is_action(t.user_input)), None)
        if prior:
            actual_input = prior.user_input
            prior_ws = WorkspaceManager(prior.id)
            if prior_ws.root.exists() and prior_ws.list_files():
                target_workspace_id = prior.id

    # Handle existing project detection (e.g. user references existing files)
    elif not is_continuation(user_input):
        existing_ws_id = WorkspaceManager.find_existing_workspace(user_input)
        if existing_ws_id:
            target_workspace_id = existing_ws_id

    initial_state = AgentOfficeState(
        task_id=task_id,
        user_input=actual_input,
        assigned_agent_id=assigned_agent_id,
        workspace_id=target_workspace_id,
        execution_state="pending",
        status="pending",
    )
    try:
        await office_graph.ainvoke(initial_state)
    except Exception as e:
        print(f"[ExecutionError] Task {task_id} failed: {e}")
        Repository.save_task(TaskResponse(
            id=task_id,
            user_input=actual_input,
            assigned_agent_id=assigned_agent_id,
            status="failed",
            result=f"Execution error: {str(e)}",
            retries=0,
            created_at=datetime.now(timezone.utc).isoformat(),
            completed_at=datetime.now(timezone.utc).isoformat()
        ))
        await event_bus.emit(
            event_type="TASK_FAILED",
            agent_id=assigned_agent_id,
            task_id=task_id,
            metadata={"error": str(e)}
        )


# --- TOOL TASK BACKGROUND RUNNER ---
async def run_tool_task(task_id: str, user_input: str, tool_name: Optional[str]):
    """
    Executes a single tool and emits TASK_COMPLETED with the result.
    Does NOT create a full agent workflow — just one tool call + optional LLM wrap.
    """
    try:
        from backend.app.tools.registry import tool_registry

        # Extract the argument for the tool (e.g. the math expression for calculator)
        arg = user_input
        if tool_name == "calculator":
            import re
            m = re.search(r"[\d\s\+\-\*\/\%\^\(\)\.]+[\d\)]+", user_input)
            arg = m.group(0).strip() if m else user_input
        elif tool_name in ("weather", "time"):
            arg = user_input  # pass the full message

        tool_result = tool_registry.execute(tool_name or "calculator", arg)

        # Wrap in a natural LLM reply when the result is terse
        if is_live_connected() and tool_name == "calculator" and "=" not in tool_result:
            reply = llm_generate(f"Tool result: {tool_result}\n\nUser asked: {user_input}\n\nRespond naturally in one sentence.")
        else:
            reply = tool_result

        # Persist as a minimal task record so fetchTaskResult() works
        task_record = TaskResponse(
            id=task_id,
            user_input=user_input,
            assigned_agent_id="tool_runner",
            status="completed",
            result=reply,
            retries=0,
            created_at=datetime.now(timezone.utc).isoformat(),
            completed_at=datetime.now(timezone.utc).isoformat(),
        )
        Repository.save_task(task_record)

        await event_bus.emit(
            event_type="TASK_COMPLETED",
            task_id=task_id,
            agent_id="tool_runner",
            metadata={
                "result_preview": reply[:120],
                "author_name": f"Tool: {tool_name or 'calculator'}",
                "handled_by_orchestrator": True,
                "artifacts": {},
                "files_created": [],
                "workspace_id": None,
            },
        )
    except Exception as exc:
        print(f"[ToolTask] {task_id} failed: {exc}")
        await event_bus.emit(
            event_type="TASK_FAILED",
            task_id=task_id,
            metadata={"error": str(exc)},
        )


# --- TASK ROUTES ---
class ChatMessagePayload(BaseModel):
    message: str
    mode: Optional[str] = None  # kept for backward compat — ignored, Router decides
    model_name: Optional[str] = None
    assigned_agent_id: Optional[str] = None  # direct dispatch from agent panel


@router.post("/chat")
async def handle_direct_chat(payload: ChatMessagePayload, background_tasks: BackgroundTasks):
    """
    Unified Manager chat endpoint with Router.

    The Router classifies each message into:
      CHAT  → direct LLM answer, no task record, instant WS response
      TOOL  → single tool execution, lightweight task record
      AGENT → full Manager/LangGraph graph, proper task with agents
    """
    cleaned_msg = payload.message.strip()
    if not cleaned_msg:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # ── ROUTE DECISION ────────────────────────────────────────────────────
    if payload.mode == "cowork":
        from backend.app.orchestration.router import RouteDecision
        route_decision = RouteDecision(route=AGENT, tool=None, reason="User explicitly requested cowork mode.", confidence=1.0)
    else:
        route_decision = await classify_route(cleaned_msg)

    # Internal debug event (not shown to user)
    route_task_id = f"{route_decision.route}_{uuid.uuid4().hex[:8]}"

    await event_bus.emit(
        event_type="ROUTE_DECIDED",
        task_id=route_task_id,
        metadata={
            "route": route_decision.route,
            "tool": route_decision.tool,
            "confidence": route_decision.confidence,
            "reason": route_decision.reason,
        }
    )

    # ── CHAT PATH: direct LLM with dynamic system prompt ─────────────────
    if route_decision.route == CHAT:
        # Build dynamic Jordan system prompt with workforce + experience context
        agents = Repository.list_agents(include_archived=False)
        experiences = memory_store.get_relevant_experiences(cleaned_msg, limit=2)
        system_prompt = build_system_prompt(agents=agents, experiences=experiences)
        prompt = build_chat_prompt(user_message=cleaned_msg, system_prompt=system_prompt)

        reply_text = llm_generate(prompt)
        # Strip continuation artifacts from LLM output
        for sep in ("\nJordan:", "\nUser:", "\nHuman:", "\nAssistant:"):
            if sep in reply_text:
                reply_text = reply_text.split(sep)[0]
        reply_text = reply_text.strip()

        # Emit DIRECT_CHAT_MESSAGE — not TASK_COMPLETED — keeps task board clean
        await event_bus.emit(
            event_type="DIRECT_CHAT_MESSAGE",
            task_id=route_task_id,
            agent_id="manager",
            metadata={
                "result_preview": reply_text[:120],
                "reply": reply_text,
                "author_name": "Manager Jordan",
                "handled_by_orchestrator": True,
            },
        )
        return {
            "mode": "chat",
            "task_id": route_task_id,
            "status": "dispatched",
            "reply": reply_text,
            "tokens": max(15, len(reply_text) // 4),
        }

    # ── TOOL PATH: single tool execution with immediate reply ─────────────
    if route_decision.route == TOOL:
        # Execute the tool synchronously so we can return the reply immediately
        # (same UX as CHAT — no waiting on WebSocket)
        try:
            from backend.app.tools.registry import tool_registry
            import re as _re
            tool_name = route_decision.tool
            arg = cleaned_msg
            if tool_name == "calculator":
                m = _re.search(r"[\d\s\+\-\*\/\%\^\(\)\.]+[\d\)]+", cleaned_msg)
                arg = m.group(0).strip() if m else cleaned_msg

            tool_result = tool_registry.execute(tool_name or "calculator", arg)

            # Wrap terse results in a natural LLM sentence
            if is_live_connected() and len(tool_result) < 60:
                reply_text = llm_generate(
                    f"Tool returned: {tool_result}\nUser asked: {cleaned_msg}\nRespond naturally in one sentence."
                ).strip()
            else:
                reply_text = tool_result

        except Exception as exc:
            reply_text = f"Tool error: {exc}"

        # Emit as DIRECT_CHAT_MESSAGE — no task board entry
        await event_bus.emit(
            event_type="DIRECT_CHAT_MESSAGE",
            task_id=route_task_id,
            agent_id="manager",
            metadata={
                "result_preview": reply_text[:120],
                "reply": reply_text,
                "author_name": f"Tool · {route_decision.tool or 'calculator'}",
                "handled_by_orchestrator": True,
            },
        )
        return {
            "mode": "tool",
            "task_id": route_task_id,
            "status": "dispatched",
            "reply": reply_text,
            "tokens": max(5, len(reply_text) // 4),
        }

    # ── AGENT PATH: full Manager/LangGraph orchestration ──────────────────
    task_id = f"task_{uuid.uuid4().hex[:8]}"
    task_record = TaskResponse(
        id=task_id,
        user_input=cleaned_msg,
        assigned_agent_id=payload.assigned_agent_id or None,
        status="pending",
        result=None,
        retries=0,
        created_at=datetime.now(timezone.utc).isoformat()
    )
    Repository.save_task(task_record)

    await event_bus.emit(
        event_type="TASK_CREATED",
        task_id=task_id,
        metadata={"user_input": cleaned_msg, "mode": "cowork" if payload.mode == "cowork" else "manager"}
    )

    background_tasks.add_task(
        run_task_in_graph,
        task_id=task_id,
        user_input=cleaned_msg,
        assigned_agent_id=payload.assigned_agent_id or None,
    )
    return {
        "mode": "cowork" if payload.mode == "cowork" else "manager",
        "task_id": task_id,
        "status": "dispatched",
        "message": "Task dispatched to autonomous Manager graph.",
    }

@router.post("/tasks", response_model=TaskResponse)
async def create_task(payload: TaskCreateRequest, background_tasks: BackgroundTasks):
    """Submit a new task to the AI Office."""
    task_id = f"task_{uuid.uuid4().hex[:8]}"
    
    task_record = TaskResponse(
        id=task_id,
        user_input=payload.user_input,
        assigned_agent_id=payload.assigned_agent_id,
        status="pending",
        result=None,
        retries=0,
        created_at=datetime.now(timezone.utc).isoformat()
    )
    Repository.save_task(task_record)

    await event_bus.emit(
        event_type="TASK_CREATED",
        task_id=task_id,
        agent_id=payload.assigned_agent_id,
        metadata={"user_input": payload.user_input}
    )

    # Dispatch to background task runner for real-time progressive events
    background_tasks.add_task(
        run_task_in_graph,
        task_id=task_id,
        user_input=payload.user_input,
        assigned_agent_id=payload.assigned_agent_id
    )

    return task_record

@router.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task(task_id: str):
    """Get status and result for a specific task."""
    task = Repository.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.get("/tasks/{task_id}/events", response_model=List[OfficeEvent])
def get_task_events(task_id: str):
    """Retrieve all backend events generated for a given task."""
    return Repository.get_events_for_task(task_id)


@router.get("/tasks/{task_id}/workspace")
def get_task_workspace(task_id: str):
    """
    List all files created in the task's isolated workspace.
    Returns file names, sizes, and workspace root path.
    """
    from backend.app.orchestration.workspace import WorkspaceManager
    ws = WorkspaceManager(task_id)
    files = ws.list_files()
    file_details = []
    for f in files:
        fpath = ws.path(f)
        file_details.append({
            "filename": f,
            "size_bytes": fpath.stat().st_size if fpath.exists() else 0,
            "path": str(fpath),
        })
    return {
        "task_id": task_id,
        "workspace_path": ws.abs_path,
        "files": file_details,
        "count": len(file_details),
    }


@router.get("/tasks/{task_id}/workspace/{filename:path}")
def download_workspace_file(task_id: str, filename: str):
    """
    Return the content of a specific file from the task workspace.
    Useful for previewing generated code or reports.
    """
    from fastapi.responses import PlainTextResponse
    from backend.app.orchestration.workspace import WorkspaceManager
    ws = WorkspaceManager(task_id)
    try:
        content = ws.read_file(filename)
        return PlainTextResponse(content=content)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File '{filename}' not found in workspace for task {task_id}")
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

# --- FEEDBACK ROUTE ---
@router.post("/feedback", response_model=FeedbackResponse)
async def create_feedback(payload: FeedbackCreateRequest):
    """Record human feedback on a completed task."""
    task = Repository.get_task(payload.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    feedback = FeedbackResponse(
        id=f"fb_{uuid.uuid4().hex[:8]}",
        task_id=payload.task_id,
        rating=payload.rating,
        comment=payload.comment,
        created_at=datetime.now(timezone.utc).isoformat()
    )
    Repository.save_feedback(feedback)

    await event_bus.emit(
        event_type="FEEDBACK_RECEIVED",
        task_id=payload.task_id,
        agent_id=task.assigned_agent_id,
        metadata={"rating": payload.rating, "comment": payload.comment}
    )
    return feedback

# --- ORGANIZATION & EVENTS ROUTES ---
@router.get("/organization/state", response_model=OrganizationState)
def get_organization_state():
    """Returns the live state of the AI company office."""
    agents = Repository.list_agents(include_archived=False)
    all_tasks = Repository.list_tasks(limit=10)
    active_tasks = [t for t in all_tasks if t.status in ["pending", "in_progress"]]
    # Only count real MANAGER/AGENT tasks — exclude CHAT and TOOL ghost entries
    completed_count = len([t for t in Repository.list_tasks(limit=200, exclude_system=True) if t.status == "completed"])
    recent_events = Repository.get_recent_events(limit=25)
    all_exps = Repository.list_experiences(limit=50)
    telemetry = Repository.get_office_telemetry()

    manager = {
        "name": "Jordan",
        "role": "Office Orchestrator & Manager",
        "status": "active",
        "desk_id": 0  # 0 is the Executive Manager Desk
    }

    return OrganizationState(
        manager=manager,
        agents=agents,
        active_tasks=active_tasks,
        recent_events=recent_events,
        total_completed_tasks=completed_count,
        total_experiences=len(all_exps),
        total_tokens=telemetry.get("total_tokens", 0),
        total_cost_usd=telemetry.get("total_cost_usd", 0.0),
        avg_latency_ms=telemetry.get("avg_latency_ms", 0.0)
    )

@router.get("/experiences", response_model=List[ExperienceRecord])
def get_experiences():
    """Retrieve the company's organizational experience bank."""
    return Repository.list_experiences(limit=20)


# --- SKILLS ENDPOINT ---
@router.get("/skills")
def get_skills():
    """
    Returns available skills from the backend/skills directory.
    Each skill is a directory with a SKILL.md file.
    """
    import os
    from backend.app.config import BASE_DIR
    skills_root = BASE_DIR / "skills"
    if not skills_root.exists():
        skills_root = BASE_DIR.parent / "skills"
    skills = []
    if skills_root.is_dir():
        for entry in os.listdir(str(skills_root)):
            skill_dir = os.path.join(skills_root, entry)
            skill_md = os.path.join(skill_dir, "SKILL.md")
            if os.path.isdir(skill_dir) and os.path.isfile(skill_md):
                try:
                    with open(skill_md, "r", encoding="utf-8") as f:
                        content = f.read()
                    # Extract name and description from frontmatter or first lines
                    lines = content.strip().splitlines()
                    name = entry.replace("-", " ").replace("_", " ").title()
                    description = lines[0].lstrip("# ").strip() if lines else "No description."
                    skills.append({"id": entry, "name": name, "description": description})
                except Exception:
                    skills.append({"id": entry, "name": entry, "description": ""})
    return {"skills": skills, "count": len(skills)}


# --- MEMORY ENDPOINT ---
@router.get("/memory")
def get_memory_entries():
    """
    Returns recent structured memory entries (experiences) written by the MemoryWriter.
    These are the machine-readable lessons learned from task executions.
    """
    experiences = Repository.list_experiences(limit=30)
    memory_entries = []
    for exp in experiences:
        memory_entries.append({
            "id": exp.id,
            "summary": exp.task_summary,
            "lesson": exp.lesson,
            "strategy": exp.strategy,
            "created_at": exp.created_at
        })
    return {"memory": memory_entries, "count": len(memory_entries)}

class ContextSummarizeRequest(BaseModel):
    notes: Optional[str] = None
    room: Optional[str] = None

@router.get("/context/current")
def get_current_context():
    """Returns active workflows, recent tasks, and total memory count for the Tea Break modal preview."""
    recent_tasks = Repository.list_tasks(limit=5)
    all_exps = Repository.list_experiences(limit=5)
    return {
        "status": "ready",
        "recent_tasks": recent_tasks,
        "recent_experiences": all_exps,
        "total_experiences": len(Repository.list_experiences(limit=100))
    }

@router.post("/context/summarize", response_model=ExperienceRecord)
async def summarize_current_context(request: Optional[ContextSummarizeRequest] = None):
    """
    Tea Break Context Summarizer:
    Summarizes recent tasks, active agent discussions, custom tea break reflections,
    and organizational workflows, and pushes the distilled experience directly into long-term context memory.
    """
    recent_tasks = Repository.list_tasks(limit=5)
    task_context_items = [f"Task: {t.user_input} (Status: {t.status})" for t in recent_tasks] if recent_tasks else ["Team discussion on autonomous multi-agent task distribution and zero-hallucination accuracy."]
    if request and request.notes:
        task_context_items.append(f"Team Reflection Notes: {request.notes}")
    task_context = "\n".join(task_context_items)
    
    exp = experience_service.summarize_and_store(
        task_input=f"Tea Break Context Review: {task_context}",
        agent_output=f"Distilled key strategic patterns, tool usage efficiency, and RAG retrieval accuracy for team memory bank. {request.notes if request and request.notes else ''}".strip(),
        evaluation=TaskEvaluation(
            id=f"eval_{uuid.uuid4().hex[:8]}",
            task_id=recent_tasks[0].id if recent_tasks else "tea_break_sync",
            success=True,
            score=0.99,
            reason="Context synthesized during tea break context refresh session."
        )
    )
    
    await event_bus.emit(
        event_type="EXPERIENCE_CREATED",
        task_id=recent_tasks[0].id if recent_tasks else None,
        metadata={
            "task_summary": exp.task_summary,
            "lesson": exp.lesson,
            "strategy": exp.strategy,
            "context_source": "tea_break_summarizer"
        }
    )
    return exp

@router.post("/meeting/sync")
async def meeting_sync(topic: Optional[str] = None):
    """Triggers an All-Hands Executive Strategy Sync in the War Room."""
    recent_tasks = Repository.list_tasks(limit=1)
    await event_bus.emit(
        event_type="TASK_CREATED",
        task_id=recent_tasks[0].id if recent_tasks else "sync_session",
        metadata={
            "type": "all_hands_sync",
            "topic": topic or "Executive Strategy War Room All-Hands Alignment",
            "caller": "Jordan (CEO)"
        }
    )
    return {"status": "ok", "message": "All-hands strategy sync initiated"}
 
# --- LLM RUNTIME MODEL & API CONFIGURATION ---
class LLMUpdatePayload(BaseModel):
    preset_key: Optional[str] = None
    model_name: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None

class SwitchModelPayload(BaseModel):
    model_id: str
    provider: Optional[str] = None

@router.get("/llm/config")
def get_llm_configuration():
    """Retrieve active LLM model preset, connection status, and model catalog."""
    return llm_config.to_dict()

@router.get("/llm/models")
def get_available_models():
    """Retrieve available models categorized by provider with currently active model highlighted."""
    cfg = llm_config.to_dict()
    return {
        "provider": cfg["provider"],
        "provider_name": cfg["provider_name"],
        "active_model": cfg["model_name"],
        "active_model_display": cfg["model_display_name"],
        "available_models": cfg["available_models"],
        "all_providers": cfg["all_providers"]
    }

@router.post("/llm/switch-model")
async def switch_model(payload: SwitchModelPayload):
    """Instant model switch from UI pill or slash command."""
    llm_config.update(model_name=payload.model_id, provider=payload.provider)
    await event_bus.emit(
        event_type="LLM_CONFIG_UPDATED",
        metadata={
            "model_name": llm_config.model_name,
            "provider": llm_config.get_provider()
        }
    )
    return llm_config.to_dict()

@router.post("/llm/config")
async def update_llm_configuration(payload: LLMUpdatePayload):
    """Switch active LLM model (OpenAI, Hermes) and configure API key/endpoint on the fly."""
    llm_config.update(
        preset_key=payload.preset_key,
        model_name=payload.model_name,
        api_key=payload.api_key,
        base_url=payload.base_url
    )
    await event_bus.emit(
        event_type="LLM_CONFIG_UPDATED",
        metadata={
            "preset_key": llm_config.preset_key,
            "model_name": llm_config.model_name,
            "has_api_key": bool(llm_config.api_key and len(llm_config.api_key.strip()) > 3)
        }
    )
    return llm_config.to_dict()

@router.post("/llm/test")
async def test_llm_connection_endpoint(payload: LLMUpdatePayload):
    """Production verification endpoint to test live connection to OpenAI or OpenRouter."""
    res = await test_llm_connection(
        preset_key=payload.preset_key,
        api_key=payload.api_key,
        base_url=payload.base_url,
        model_name=payload.model_name
    )
    return res

# --- WEBSOCKET EVENT STREAM ---
@router.websocket("/ws/events")
async def websocket_events_endpoint(websocket: WebSocket):
    """Real-time event stream for the 2D office frontend."""
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


# --- OBSIDIAN KNOWLEDGE ROUTES ---
class SaveToKnowledgeRequest(BaseModel):
    task_id: Optional[str] = None   # optional — if provided, we look up the task result
    user_input: str
    agent_output: str

@router.post("/knowledge/save")
async def save_to_knowledge(payload: SaveToKnowledgeRequest):
    """
    User-triggered 'Save to Knowledge' action.
    Generates a clean Markdown note and saves it to the Obsidian vault.
    Also writes a machine memory lesson.
    """
    result = memory_writer.save_to_knowledge(
        task_input=payload.user_input,
        agent_output=payload.agent_output
    )
    return result


@router.get("/knowledge/status")
def get_obsidian_status():
    """
    Returns whether the Obsidian vault is configured and reachable.
    Used by the frontend to show/hide the 'Save to Knowledge' button.
    """
    from backend.app.tools.obsidian_tool import _get_vault_path
    import os
    vault_path = os.getenv("OBSIDIAN_VAULT_PATH", "").strip()
    vault = _get_vault_path()
    return {
        "configured": vault is not None,
        "vault_path": vault_path if vault is not None else None,
        "message": "Vault ready" if vault else "Set OBSIDIAN_VAULT_PATH in .env to enable"
    }


@router.get("/knowledge/search")
async def search_knowledge(query: str = ""):
    """
    Search the Obsidian vault for notes matching the query.
    """
    import json
    from backend.app.tools.obsidian_tool import ObsidianTool, _get_vault_path
    if not query:
        return {"results": [], "message": "No query provided"}
    vault = _get_vault_path()
    if vault is None:
        return {"results": [], "message": "Obsidian vault not configured"}
    obs = ObsidianTool()
    raw = obs.run(json.dumps({"op": "search_notes", "query": query}))
    return {"results": raw, "query": query}


# =============================================================================
# NEW PRD ENDPOINTS — Added per new PDF PRD requirements
# =============================================================================

# --- GET /api/tasks (list all tasks — was missing) ---
@router.get("/tasks", response_model=List[TaskResponse])
def list_tasks(limit: int = 50, status: Optional[str] = None):
    """List all tasks with optional status filter."""
    tasks = Repository.list_tasks(limit=limit)
    if status:
        tasks = [t for t in tasks if t.status == status]
    return tasks


# --- POST /api/tasks/{id}/cancel ---
@router.post("/tasks/{task_id}/cancel")
async def cancel_task(task_id: str):
    """Cancel a running task (marks it failed with cancellation reason)."""
    task = Repository.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status in ("completed", "failed"):
        return {"message": f"Task already in terminal state: {task.status}"}

    from datetime import datetime, timezone
    cancelled = task.model_copy(update={
        "status": "failed",
        "result": "Task cancelled by user.",
        "completed_at": datetime.now(timezone.utc).isoformat()
    })
    Repository.save_task(cancelled)
    await event_bus.emit(
        event_type="TASK_FAILED",
        task_id=task_id,
        metadata={"error": "Cancelled by user", "reason": "user_cancel"}
    )
    return {"message": f"Task {task_id} cancelled."}


# --- GET /api/tasks/{id}/steps ---
@router.get("/tasks/{task_id}/steps", response_model=List[TaskStep])
def get_task_steps(task_id: str):
    """Get all atomic execution steps for a task."""
    task = Repository.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return Repository.get_task_steps(task_id)


# --- GET /api/tasks/{id}/artifacts ---
@router.get("/tasks/{task_id}/artifacts", response_model=List[Artifact])
def get_task_artifacts_endpoint(task_id: str):
    """Get all artifacts (files/reports) produced by a task."""
    task = Repository.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return Repository.get_task_artifacts(task_id)


# --- GET /api/events (historical events) ---
@router.get("/events", response_model=List[OfficeEvent])
def get_events(limit: int = 50):
    """Retrieve historical backend events (for observability)."""
    return Repository.get_recent_events(limit=limit)


# --- SKILLS API (DB-backed, replaces filesystem scanner) ---
@router.get("/skills/db", response_model=List[SkillRecord])
def list_skills_from_db():
    """List all registered skills from the database."""
    return Repository.list_skills()


@router.post("/skills/db", response_model=SkillRecord)
async def register_skill(payload: SkillCreateRequest):
    """Register a new reusable skill into the database."""
    import uuid
    from datetime import datetime, timezone
    # Check for duplicate name
    existing = Repository.get_skill_by_name(payload.name)
    if existing:
        raise HTTPException(status_code=409, detail=f"Skill '{payload.name}' already exists.")

    now = datetime.now(timezone.utc).isoformat()
    skill = SkillRecord(
        id=f"skill_{uuid.uuid4().hex[:8]}",
        name=payload.name,
        description=payload.description,
        procedure=payload.procedure,
        required_tools=payload.required_tools,
        version=1,
        status="active",
        created_at=now,
        updated_at=now
    )
    Repository.save_skill(skill)
    return skill


@router.get("/skills/db/{skill_id}", response_model=SkillRecord)
def get_skill(skill_id: str):
    """Get a specific skill by ID."""
    skill = Repository.get_skill(skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill


@router.patch("/skills/db/{skill_id}", response_model=SkillRecord)
def update_skill(skill_id: str, payload: dict):
    """Update an existing skill (e.g. add learned corrections or bump version)."""
    from datetime import datetime, timezone
    skill = Repository.get_skill(skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    updates = {k: v for k, v in payload.items() if k in ("description", "procedure", "learned_corrections", "status")}
    if updates:
        updates["version"] = skill.version + 1
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        updated = skill.model_copy(update=updates)
        Repository.save_skill(updated)
        return updated
    return skill


# --- METRICS ENDPOINT ---
@router.get("/metrics", response_model=OfficeMetrics)
def get_office_metrics():
    """Get office-wide performance metrics for the dashboard."""
    return Repository.get_metrics()


# --- PER-AGENT STATS ---
@router.get("/agents/{agent_id}/stats")
def get_agent_stats(agent_id: str):
    """Get task stats for a specific agent."""
    agent = Repository.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    tasks = Repository.list_tasks(limit=500)
    agent_tasks = [t for t in tasks if t.assigned_agent_id == agent_id]
    completed = [t for t in agent_tasks if t.status == "completed"]
    failed = [t for t in agent_tasks if t.status == "failed"]
    return {
        "agent_id": agent_id,
        "name": agent.name,
        "level": agent.level,
        "xp": agent.xp,
        "badges": agent.badges,
        "total_tasks": len(agent_tasks),
        "completed_tasks": len(completed),
        "failed_tasks": len(failed),
        "success_rate": round(len(completed) / len(agent_tasks) * 100, 1) if agent_tasks else 0.0,
    }
