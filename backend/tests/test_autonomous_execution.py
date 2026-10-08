import pytest
import os
from pathlib import Path

from backend.app.orchestration.state import AgentOfficeState
from backend.app.orchestration.graph import office_graph
from backend.app.orchestration.intent import classify_task, is_execution_category, is_continuation
from backend.app.orchestration.workspace import WorkspaceManager, _get_workspace_root
from backend.app.tools.registry import tool_registry
from backend.app.database.repository import Repository
from backend.app.models.schemas import AgentConfig


@pytest.mark.asyncio
async def test_build_gui_calculator_autonomous_execution():
    """
    Core requirement:
    When user asks 'Build a GUI calculator', the system must:
    1. Create a workspace
    2. Create calculator.py
    3. Run tests on calculation logic (addition, subtraction, multiplication, division, zero division)
    4. Not return a tutorial or internal JSON
    5. Return clean natural summary
    """
    task_id = "task_test_gui_calculator"
    initial_state = AgentOfficeState(
        task_id=task_id,
        user_input="Build a GUI calculator",
        workspace_id=task_id,
        status="pending",
    )

    final_state = await office_graph.ainvoke(initial_state)
    state_dict = final_state if isinstance(final_state, dict) else final_state.model_dump()

    assert state_dict["status"] == "completed"
    output = state_dict.get("agent_output", "")

    # Must not leak internal JSON or tutorial prose
    assert '"route":' not in output
    assert '"selected_agent_id":' not in output
    assert "first install python" not in output.lower()

    # Workspace & calculator.py must exist
    ws_root = _get_workspace_root()
    ws_dir = ws_root / task_id
    assert ws_dir.exists()

    calc_file = ws_dir / "calculator.py"
    assert calc_file.exists(), "calculator.py was not created in workspace"
    content = calc_file.read_text(encoding="utf-8")
    assert "CalculatorEngine" in content or "add" in content

    # Files created must be listed in state
    assert "calculator.py" in state_dict.get("files_created", [])

    # Output must have clean natural format
    assert "Built the calculator" in output or "calculator.py" in output
    assert "Created:" in output
    assert "Tested:" in output


@pytest.mark.asyncio
async def test_gibberish_message_does_not_trigger_summary_or_peer_review():
    """
    Bug verification:
    Random text like 'yicuctjjvkjkg' must NOT return '### Task Execution Summary'
    or '🛡️ Peer Review Sign-Off (Alex):'.
    """
    task_id = "task_test_gibberish_clean"
    initial_state = AgentOfficeState(
        task_id=task_id,
        user_input="yicuctjjvkjkg",
        status="pending",
    )

    final_state = await office_graph.ainvoke(initial_state)
    state_dict = final_state if isinstance(final_state, dict) else final_state.model_dump()

    output = state_dict.get("agent_output", "")
    assert "### Task Execution Summary" not in output, "Generic execution summary leaked on gibberish"
    assert "Peer Review Sign-Off" not in output, "Peer review sign-off triggered on gibberish"
    assert '"route":' not in output, "Routing JSON leaked"
    assert state_dict.get("is_collaborative") is False


def test_nine_category_task_classification():
    """Verify all 9 task categories are classified accurately."""
    assert classify_task("What is the difference between a class and a module?") == "explain"
    assert classify_task("How does Tkinter work?") == "explain"
    assert classify_task("Build a GUI calculator") == "build"
    assert classify_task("Create a REST API client") == "build"
    assert classify_task("Modify calculator.py to add square root button") == "modify"
    assert classify_task("Calculate 100 * 1.05 ** 3") == "execute"
    assert classify_task("Automate daily report generation") == "automate"
    assert classify_task("Create artifact: customer distribution chart") == "create_artifact"
    assert classify_task("Research company policy on remote work") == "research"
    assert classify_task("Analyze performance metrics for Q3") == "analyze"
    assert classify_task("Hello Jordan") == "answer"


def test_continuation_signals():
    """Verify 'go on' and continuation phrases are recognized."""
    assert is_continuation("go on")
    assert is_continuation("continue")
    assert is_continuation("build it")
    assert is_continuation("do it")
    assert is_continuation("proceed")
    assert is_continuation("please do it")
    assert not is_continuation("What is Python?")
    assert not is_continuation("Build a website")


def test_sandbox_tool_operations():
    """Verify SandboxTool operations (write, read, list, python execution)."""
    ws_id = "task_test_sandbox_ops"
    tool_registry.bind_workspace(ws_id)

    # Write
    w_res = tool_registry.execute("sandbox", '{"op": "write", "filename": "test_script.py", "content": "print(\'SANDBOX_OK\')" }')
    assert "Written: test_script.py" in w_res

    # Read
    r_res = tool_registry.execute("sandbox", '{"op": "read", "filename": "test_script.py"}')
    assert "SANDBOX_OK" in r_res

    # List
    l_res = tool_registry.execute("sandbox", '{"op": "list"}')
    assert "test_script.py" in l_res

    # Run Python
    run_res = tool_registry.execute("sandbox", '{"op": "run_python", "filename": "test_script.py"}')
    assert "Status: SUCCESS" in run_res
    assert "SANDBOX_OK" in run_res


def test_existing_workspace_detection():
    """Verify WorkspaceManager detects existing project files."""
    ws = WorkspaceManager("task_calc_existing")
    ws.write_file("my_calc.py", "# calc code")

    found = WorkspaceManager.find_existing_workspace("Modify my_calc.py to add square root")
    assert found == "task_calc_existing"
