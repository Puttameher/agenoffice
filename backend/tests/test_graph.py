import pytest
import asyncio
import os
from pathlib import Path
from backend.app.database.db import init_db
from backend.app.database.repository import Repository
from backend.app.models.schemas import AgentConfig
from backend.app.orchestration.state import AgentOfficeState
from backend.app.orchestration.graph import office_graph
from backend.app.retrieval.rag_service import rag_service
from backend.app.orchestration.intent import classify_intent, is_action

from backend.app.llm import llm_config

@pytest.fixture(autouse=True)
def setup_environment(monkeypatch):
    init_db()
    rag_service.initialize_documents()
    monkeypatch.setattr(llm_config, "api_key", None)
    # Seed a standard permanent agent if none exists
    if not Repository.list_agents():
        Repository.save_agent(AgentConfig(
            id="agent_alex",
            name="Alex",
            role="Python Specialist",
            description="Python coder.",
            instructions="Help with Python and calculations.",
            skills=["Python", "debugging", "calculation"],
            tools=["calculator", "python_runner", "workspace_writer"],
            permanent=True,
            memory_enabled=True,
            status="idle",
            desk_id=1
        ))

@pytest.mark.asyncio
async def test_langgraph_workflow_end_to_end():
    initial_state = AgentOfficeState(
        task_id="task_test_01",
        user_input="Calculate 100 * (1 + 0.05) ** 3",
        workspace_id="task_test_01",
        status="pending",
    )

    final_state = await office_graph.ainvoke(initial_state)

    # In LangGraph with Pydantic state, returned final state is either dict or AgentOfficeState
    state_dict = final_state if isinstance(final_state, dict) else final_state.model_dump()

    assert state_dict["status"] == "completed"
    assert state_dict["assigned_agent_id"] is not None
    assert state_dict["agent_output"] is not None
    assert state_dict["evaluation"] is not None
    assert state_dict["evaluation"]["success"] is True
    assert state_dict["evaluation"]["score"] >= 0.0

@pytest.mark.asyncio
async def test_agentic_rag_decision_flow():
    initial_state = AgentOfficeState(
        task_id="task_test_rag",
        user_input="What are the company guidelines and policies for working hours?",
        workspace_id="task_test_rag",
        status="pending",
    )

    final_state = await office_graph.ainvoke(initial_state)
    state_dict = final_state if isinstance(final_state, dict) else final_state.model_dump()

    assert state_dict["status"] == "completed"
    # Should have triggered RAG retrieval
    assert state_dict.get("need_rag") is True
    assert state_dict.get("retrieved_rag_context") is not None
    assert "guidelines" in state_dict["retrieved_rag_context"].lower() or "policy" in state_dict["retrieved_rag_context"].lower()

@pytest.mark.asyncio
async def test_dynamic_temporary_agent_workflow():
    initial_state = AgentOfficeState(
        task_id="task_test_temp",
        user_input="Provide a clinical diet analysis for endurance runners.",
        workspace_id="task_test_temp",
        status="pending",
    )

    final_state = await office_graph.ainvoke(initial_state)
    state_dict = final_state if isinstance(final_state, dict) else final_state.model_dump()

    assert state_dict["status"] == "completed"
    # The temporary agent was created and then archived
    assert state_dict.get("is_temporary_agent") is True
    assigned_id = state_dict["assigned_agent_id"]
    agent_record = Repository.get_agent(assigned_id)
    assert agent_record.status == "archived"

@pytest.mark.asyncio
async def test_collaborative_swarm_and_telemetry_workflow():
    # Ensure a second permanent agent exists
    Repository.save_agent(AgentConfig(
        id="agent_rio",
        name="Rio",
        role="Auditor & Financial Analyst",
        description="Audits and analyzes metrics.",
        instructions="Audit numbers and review code.",
        skills=["audit", "analysis", "review"],
        tools=["calculator"],
        permanent=True,
        memory_enabled=True,
        status="idle",
        desk_id=3
    ))

    initial_state = AgentOfficeState(
        task_id="task_test_collab_01",
        user_input="Collaborate with Rio to calculate 5000 * 1.15 and verify investment returns",
        workspace_id="task_test_collab_01",
        status="pending",
    )

    final_state = await office_graph.ainvoke(initial_state)
    state_dict = final_state if isinstance(final_state, dict) else final_state.model_dump()

    assert state_dict["status"] == "completed"
    assert state_dict["is_collaborative"] is True
    assert state_dict["collaborating_agent_id"] is not None
    assert "Peer Review Sign-Off" in state_dict["agent_output"]
    assert state_dict["tokens_used"] > 0
    assert state_dict["latency_ms"] >= 0.0
    assert state_dict["cost_usd"] >= 0.0
    assert state_dict["artifacts"] is not None

    # Check that participating agent gained XP
    primary_agent = Repository.get_agent(state_dict["assigned_agent_id"])
    assert primary_agent.xp >= 150
    assert primary_agent.tasks_completed >= 1


# ---------------------------------------------------------------------------
# NEW TESTS: Autonomous Execution Behavior
# ---------------------------------------------------------------------------

def test_intent_classifier_action_tasks():
    """Action verbs at the start of a message must always classify as 'action'."""
    assert classify_intent("Build a GUI calculator") == "action"
    assert classify_intent("Create a Fibonacci sequence generator") == "action"
    assert classify_intent("Write a Python script that sorts a list") == "action"
    assert classify_intent("Calculate 1000 * 0.05 ** 2") == "action"
    assert classify_intent("Run the test suite") == "action"
    assert classify_intent("Generate a CSV report") == "action"


def test_intent_classifier_conversational_tasks():
    """Questions and explanations must stay on the conversational path."""
    assert classify_intent("How does Tkinter work?") == "conversational"
    assert classify_intent("What is a Python generator?") == "conversational"
    assert classify_intent("Explain recursion to me") == "conversational"
    assert classify_intent("Hello, how are you?") == "conversational"
    assert classify_intent("Tell me about machine learning") == "conversational"


@pytest.mark.asyncio
async def test_build_action_creates_workspace():
    """
    A build task must create a workspace directory with at least one file.
    The agent must not return a tutorial — it must produce a file.
    """
    task_id = "task_test_build_ws"
    initial_state = AgentOfficeState(
        task_id=task_id,
        user_input="Write a Python script that calculates fibonacci numbers up to n=10 and prints them",
        workspace_id=task_id,
        status="pending",
    )

    final_state = await office_graph.ainvoke(initial_state)
    state_dict = final_state if isinstance(final_state, dict) else final_state.model_dump()

    assert state_dict["status"] == "completed"
    assert state_dict["agent_output"] is not None

    # Workspace directory must exist
    from backend.app.orchestration.workspace import WorkspaceManager, _get_workspace_root
    ws_root = _get_workspace_root()
    ws_dir = ws_root / task_id
    assert ws_dir.exists(), f"Workspace directory was not created: {ws_dir}"

    # At least one file must have been written
    files = list(ws_dir.iterdir())
    assert len(files) >= 1, "No files were created in workspace for a build task"

    # Output must contain code or file references, not just prose
    output = state_dict["agent_output"]
    contains_code_evidence = (
        "```" in output
        or any(f.name in output for f in files)
        or "Created:" in output
        or ".py" in output
    )
    assert contains_code_evidence, (
        "Agent output for a build task must reference created files or contain code.\n"
        f"Output was:\n{output[:400]}"
    )


@pytest.mark.asyncio
async def test_action_task_never_returns_internal_json():
    """
    Action tasks must never return raw routing JSON as the user-facing response.
    """
    initial_state = AgentOfficeState(
        task_id="task_test_no_json",
        user_input="Build a password generator in Python",
        workspace_id="task_test_no_json",
        status="pending",
    )

    final_state = await office_graph.ainvoke(initial_state)
    state_dict = final_state if isinstance(final_state, dict) else final_state.model_dump()

    output = state_dict.get("agent_output", "")

    # Must not leak routing JSON
    assert '"route":' not in output, "Internal routing JSON leaked into user-facing output"
    assert '"selected_agent_id":' not in output, "Internal agent ID leaked into user-facing output"
    assert '"delegate_to_agent"' not in output, "Internal delegation decision leaked into output"
    assert output.strip() != "", "Agent output is empty for an action task"


@pytest.mark.asyncio
async def test_conversational_task_handled_directly():
    """
    A conversational question must be answered directly by the orchestrator,
    NOT routed to an agent for 'execution'.
    """
    initial_state = AgentOfficeState(
        task_id="task_test_convo",
        user_input="What is the difference between a list and a tuple in Python?",
        workspace_id="task_test_convo",
        status="pending",
    )

    final_state = await office_graph.ainvoke(initial_state)
    state_dict = final_state if isinstance(final_state, dict) else final_state.model_dump()

    assert state_dict["status"] == "completed"
    assert state_dict["agent_output"] is not None
    assert len(state_dict["agent_output"]) > 50, "Conversational response is too short"
    # Conversational tasks should not create workspace files
    files_created = state_dict.get("files_created", [])
    assert len(files_created) == 0, f"Conversational task should not create files, but created: {files_created}"


@pytest.mark.asyncio
async def test_langgraph_workflow_end_to_end():
    initial_state = AgentOfficeState(
        task_id="task_test_01",
        user_input="Calculate 100 * (1 + 0.05) ** 3"
    )
    
    final_state = await office_graph.ainvoke(initial_state)
    
    # In LangGraph with Pydantic state, returned final state is either dict or AgentOfficeState
    state_dict = final_state if isinstance(final_state, dict) else final_state.model_dump()
    
    assert state_dict["status"] == "completed"
    assert state_dict["assigned_agent_id"] is not None
    assert state_dict["agent_output"] is not None
    assert state_dict["evaluation"] is not None
    assert state_dict["evaluation"]["success"] is True
    assert state_dict["evaluation"]["score"] >= 0.0

@pytest.mark.asyncio
async def test_agentic_rag_decision_flow():
    initial_state = AgentOfficeState(
        task_id="task_test_rag",
        user_input="What are the company guidelines and policies for working hours?"
    )
    
    final_state = await office_graph.ainvoke(initial_state)
    state_dict = final_state if isinstance(final_state, dict) else final_state.model_dump()
    
    assert state_dict["status"] == "completed"
    # Should have triggered RAG retrieval
    assert state_dict.get("need_rag") is True
    assert state_dict.get("retrieved_rag_context") is not None
    assert "guidelines" in state_dict["retrieved_rag_context"].lower() or "policy" in state_dict["retrieved_rag_context"].lower()

@pytest.mark.asyncio
async def test_dynamic_temporary_agent_workflow():
    initial_state = AgentOfficeState(
        task_id="task_test_temp",
        user_input="Provide a clinical diet analysis for endurance runners."
    )
    
    final_state = await office_graph.ainvoke(initial_state)
    state_dict = final_state if isinstance(final_state, dict) else final_state.model_dump()
    
    assert state_dict["status"] == "completed"
    # The temporary agent was created and then archived
    assert state_dict.get("is_temporary_agent") is True
    assigned_id = state_dict["assigned_agent_id"]
    agent_record = Repository.get_agent(assigned_id)
    assert agent_record.status == "archived"

@pytest.mark.asyncio
async def test_collaborative_swarm_and_telemetry_workflow():
    # Ensure a second permanent agent exists
    Repository.save_agent(AgentConfig(
        id="agent_rio",
        name="Rio",
        role="Auditor & Financial Analyst",
        description="Audits and analyzes metrics.",
        instructions="Audit numbers and review code.",
        skills=["audit", "analysis", "review"],
        tools=["calculator"],
        permanent=True,
        memory_enabled=True,
        status="idle",
        desk_id=3
    ))
    
    initial_state = AgentOfficeState(
        task_id="task_test_collab_01",
        user_input="Collaborate with Rio to calculate 5000 * 1.15 and verify investment returns"
    )
    
    final_state = await office_graph.ainvoke(initial_state)
    state_dict = final_state if isinstance(final_state, dict) else final_state.model_dump()
    
    assert state_dict["status"] == "completed"
    assert state_dict["is_collaborative"] is True
    assert state_dict["collaborating_agent_id"] is not None
    assert "Peer Review Sign-Off" in state_dict["agent_output"]
    assert state_dict["tokens_used"] > 0
    assert state_dict["latency_ms"] >= 0.0
    assert state_dict["cost_usd"] >= 0.0
    assert state_dict["artifacts"] is not None
    
    # Check that participating agent gained XP
    primary_agent = Repository.get_agent(state_dict["assigned_agent_id"])
    assert primary_agent.xp >= 150
    assert primary_agent.tasks_completed >= 1
