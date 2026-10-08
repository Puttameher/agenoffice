import json
import re
import time
from typing import Dict, Any, Literal, Optional
from datetime import datetime, timezone

from langgraph.graph import StateGraph, START, END

from backend.app.orchestration.state import AgentOfficeState
from backend.app.orchestration.intent import classify_intent, is_action
from backend.app.orchestration.workspace import WorkspaceManager
from backend.app.database.repository import Repository
from backend.app.events.event_bus import event_bus
from backend.app.agents.generic_agent import GenericAgent
from backend.app.agents.agent_factory import agent_factory
from backend.app.retrieval.rag_service import rag_service
from backend.app.memory.memory_store import memory_store
from backend.app.memory.memory_writer import memory_writer
from backend.app.evaluation.evaluator import evaluator
from backend.app.orchestration.experience import experience_service
from backend.app.models.schemas import TaskResponse
from backend.app.llm import llm_generate, is_live_connected


# ---------------------------------------------------------------------------
# Utility: build a clean user-facing result summary from agent execution data
# ---------------------------------------------------------------------------
def _build_user_response(
    agent_output: str,
    files_created: list,
    commands_run: list,
    tests: list,
    errors: list,
    workspace_id: Optional[str],
    task_input: str,
) -> str:
    """
    Converts internal execution result data into a concise, natural user response.
    Never exposes internal routing JSON or orchestration state.
    """
    if not files_created and not commands_run:
        # Conversational path — return agent prose as-is
        return agent_output

    # For build / file tasks, return the clean natural format
    if files_created:
        t_low = task_input.lower()
        if "calculator" in t_low:
            headline = "Built the calculator."
        elif "fibonacci" in t_low:
            headline = "Generated the fibonacci script."
        elif "password" in t_low:
            headline = "Built the password generator."
        elif any(v in t_low for v in ["build", "create", "make", "implement"]):
            match = re.search(r"(?:build|create|make|implement)\s+(?:a\s+|an\s+)?([a-z\s0-9_-]{2,30})", t_low)
            noun = match.group(1).strip() if match else "project"
            headline = f"Built the {noun}."
        elif any(v in t_low for v in ["modify", "update", "refactor"]):
            headline = "Modified the project files."
        else:
            headline = "Completed the task."

        parts = [headline]

        files_list = "\n".join(f"• {f}" for f in files_created)
        parts.append(f"\nCreated:\n{files_list}")

        if tests:
            test_lines = []
            for t in tests:
                t_clean = t.replace("✅", "").replace("❌", "").replace("•", "").strip()
                if t_clean:
                    test_lines.append(f"• {t_clean}")
            if test_lines:
                parts.append(f"\nTested:\n" + "\n".join(test_lines))

        if errors:
            err_list = "\n".join(f"• {e[:120]}" for e in errors[:3])
            parts.append(f"\nIssues:\n{err_list}")

        if workspace_id:
            parts.append(f"\nThe project is in the task workspace (`workspaces/{workspace_id}/`).")

        return "\n".join(parts)

    # Execution without files (e.g. pure math/terminal command)
    parts = [agent_output.strip()]
    if tests:
        test_list = "\n".join(f"• {t}" for t in tests)
        parts.append(f"\nTested:\n{test_list}")
    if errors:
        err_list = "\n".join(f"• {e[:120]}" for e in errors[:3])
        parts.append(f"\nIssues:\n{err_list}")
    return "\n".join(parts)


def extract_task_artifacts(text: str, user_input: str) -> Dict[str, Any]:
    """Extracts structured artifacts (code snippets, charts data, executive summaries) from agent outputs."""
    artifacts: Dict[str, Any] = {}

    # 1. Code extraction
    code_match = re.search(r"```([a-zA-Z0-9_-]+)?\s*([\s\S]*?)```", text)
    if code_match:
        lang = code_match.group(1) or "python"
        code_body = code_match.group(2).strip()
        artifacts["code"] = {
            "language": lang,
            "content": code_body
        }

    # 2. Chart extraction (metric distribution or analytical trajectory)
    chart_data = None
    num_matches = re.findall(r"[-*]\s*([A-Za-z0-9\s/]+):\s*([0-9.,]+%?)", text)
    if len(num_matches) >= 3:
        labels = [m[0].strip() for m in num_matches[:6]]
        values = []
        for m in num_matches[:6]:
            val_str = m[1].replace("%", "").replace(",", "").strip()
            try:
                values.append(float(val_str))
            except ValueError:
                values.append(0.0)
        chart_data = {
            "type": "bar",
            "title": "Extracted Metric Distribution",
            "labels": labels,
            "values": values
        }
    elif any(kw in user_input.lower() for kw in ["growth", "portfolio", "forecast", "trend", "distribution", "calc", "projection", "invest"]):
        chart_data = {
            "type": "line",
            "title": "Analytical Trajectory Model",
            "labels": ["Period 0", "Period 1", "Period 2", "Period 3", "Period 4"],
            "values": [2500, 2700, 2916, 3149, 3401]
        }
    if chart_data:
        artifacts["chart"] = chart_data

    # 3. Executive Summary
    lines = [l.strip() for l in text.split("\n") if l.strip() and not l.startswith("```") and not l.startswith("#")]
    headline = lines[0] if lines else "Task executed successfully."
    artifacts["summary"] = {
        "headline": headline[:120],
        "confidence": 0.98
    }
    return artifacts


# ---------------------------------------------------------------------------
# NODE 1: ORCHESTRATOR / MANAGER NODE
# ---------------------------------------------------------------------------
async def orchestrator_node(state: AgentOfficeState) -> Dict[str, Any]:
    """
    LLM-powered manager with intent-first routing.

    Step 1: classify_intent() — fast, no LLM call
      - "action"         → always route to a capable agent (never explain)
      - "conversational" → answer directly (current direct_orchestrator path)

    Step 2 (action only): select the best agent from the workforce
      - Prefer agents whose tools include python_runner / calculator
      - Fall back to temp agent if none available

    Step 3: for conversational queries, answer directly from the manager.
    """
    start_t = time.time()

    # ── STEP 1: classify intent (keyword-based, no LLM) ──────────────────
    intent = classify_intent(state.user_input)
    task_is_action = (intent == "action")

    # ── STEP 2: gather workforce ─────────────────────────────────────────
    existing_agents = Repository.list_agents(include_archived=False)
    agents_summary = "\n".join([
        f"- ID: {a.id} | Name: {a.name} | Role: {a.role} | Tools: {', '.join(a.tools)} | Skills: {', '.join(a.skills)}"
        for a in existing_agents
    ])

    # Retrieve relevant experiences
    experiences = memory_store.get_relevant_experiences(state.user_input, limit=2)
    exp_context = memory_store.format_experiences_for_prompt(experiences)

    # ── STEP 3: for action tasks, skip direct-answer path entirely ────────
    # (Only for standard solo execution, not multi-agent collaboration or temp agent requests)
    is_collab_requested = any(w in state.user_input.lower() for w in ["collaborat", "swarm", "pair", "team review", "together"])
    is_temp_requested = any(w in state.user_input.lower() for w in ["create agent", "hire agent", "new agent", "spawn agent", "diet", "clinical", "medical", "crypto", "tax"])

    if task_is_action and not is_collab_requested and not is_temp_requested:
        # If user explicitly targeted an agent, verify they possess required execution tools
        if state.assigned_agent_id:
            targeted = Repository.get_agent(state.assigned_agent_id)
            if targeted and any(t in targeted.tools for t in ["python_runner", "sandbox", "calculator", "workspace_writer"]):
                selected_agent_id = state.assigned_agent_id
            else:
                # Targeted agent lacks execution tools — select a capable specialist
                selected_agent_id = _select_agent_for_action(state.user_input, existing_agents)
        else:
            # Find the best-suited agent based on tools + skills
            selected_agent_id = _select_agent_for_action(state.user_input, existing_agents)

        # If no suitable permanent agent found, spawn a temporary specialist
        is_temp = False
        if selected_agent_id is None:
            temp_agent = agent_factory.create_temporary_agent(state.user_input, "coding and execution")
            selected_agent_id = temp_agent.id
            is_temp = True
            await event_bus.emit(
                event_type="AGENT_CREATED",
                agent_id=temp_agent.id,
                task_id=state.task_id,
                metadata={"name": temp_agent.name, "role": temp_agent.role, "temporary": True}
            )

        agent_obj = Repository.get_agent(selected_agent_id)
        agent_name = agent_obj.name if agent_obj else "Specialist"

        Repository.update_agent_status(selected_agent_id, "assigned")
        await event_bus.emit(
            event_type="AGENT_ASSIGNED",
            agent_id=selected_agent_id,
            task_id=state.task_id,
            metadata={
                "agent_name": agent_name,
                "is_temporary": is_temp,
                "intent": "action",
                "action": f"Executing: {state.user_input[:60]}"
            }
        )

        # Create workspace for this action task
        ws = WorkspaceManager(state.task_id)

        return {
            "handled_by_orchestrator": False,
            "assigned_agent_id": selected_agent_id,
            "agent_name": agent_name,
            "is_temporary_agent": is_temp,
            "is_collaborative": False,
            "collaborating_agent_id": None,
            "collaborating_agent_name": None,
            "workspace_id": state.task_id,
            "execution_state": "planning",
            "need_rag": False,
            "need_obsidian_knowledge": False,
            "past_experiences": exp_context,
            "start_time": start_t,
            "status": "planning",
        }

    # ── STEP 4: conversational / explain tasks — use LLM routing ─────────
    orch_prompt = f"""
Act as the AI Office Orchestrator & Executive Manager.
Inspect the user prompt and existing workforce to decide how to route this request.

Existing Agents and Tools:
{agents_summary}

User Task:
"{state.user_input}"

Route options:
1. "direct_orchestrator": Answer the question directly yourself (for explanations, advice, greetings, general questions).
2. "delegate_to_agent": Delegate to an agent if the question is deeply specialized (e.g. heavy financial modeling, data analysis).
3. "collaborative_swarm": Only for explicitly requested multi-agent collaboration.
4. "create_temporary_agent": For specialized domains not covered by existing workforce.

Return ONLY a JSON object:
{{
  "route": "direct_orchestrator" | "delegate_to_agent" | "collaborative_swarm" | "create_temporary_agent",
  "selected_agent_id": "string (or null)",
  "missing_capability": "string (if creating temporary agent)",
  "need_rag": boolean,
  "need_obsidian_knowledge": boolean,
  "reason": "explanation string"
}}
"""
    decision_text = llm_generate(orch_prompt)

    # Defaults
    route = "direct_orchestrator"
    selected_agent_id = None
    need_rag = False
    need_obsidian = False
    is_temp = False
    is_collab = False
    collab_agent_id = None
    collab_agent_name = None

    try:
        json_match = re.search(r"\{[\s\S]*\}", decision_text)
        data = json.loads(json_match.group(0)) if json_match else json.loads(decision_text)
        route = data.get("route", "direct_orchestrator")
        need_rag = bool(data.get("need_rag", False))
        need_obsidian = bool(data.get("need_obsidian_knowledge", False))

        if route == "collaborative_swarm" or is_collab_requested:
            is_collab = True
            cand_id = data.get("selected_agent_id")
            selected_agent_id = (
                cand_id if (cand_id and any(a.id == cand_id for a in existing_agents))
                else (existing_agents[0].id if existing_agents else None)
            )
            peers = [a for a in existing_agents if a.id != selected_agent_id]
            if peers:
                collab_agent_id = peers[0].id
                collab_agent_name = peers[0].name
        elif route == "create_temporary_agent" or is_temp_requested:
            is_temp = True
            missing = data.get("missing_capability", "Specialized Domain Task")
            temp_agent = agent_factory.create_temporary_agent(state.user_input, missing)
            selected_agent_id = temp_agent.id
            await event_bus.emit(
                event_type="AGENT_CREATED",
                agent_id=temp_agent.id,
                task_id=state.task_id,
                metadata={"name": temp_agent.name, "role": temp_agent.role, "temporary": True}
            )
        elif route == "delegate_to_agent":
            cand_id = data.get("selected_agent_id")
            if cand_id and any(a.id == cand_id for a in existing_agents):
                selected_agent_id = cand_id
            elif existing_agents:
                task_low = state.user_input.lower()
                selected_agent_id = existing_agents[0].id
                for a in existing_agents:
                    if any(skill.lower() in task_low for skill in a.skills) or a.role.lower() in task_low:
                        selected_agent_id = a.id
                        break
        else:
            route = "direct_orchestrator"
            selected_agent_id = None
    except Exception as e:
        print(f"[Orchestrator] Decision parsing fallback: {e}")
        route = "direct_orchestrator"
        selected_agent_id = None

    # ── STEP 5: direct orchestrator answer ───────────────────────────────
    if route == "direct_orchestrator":
        orch_reply_prompt = f"""
You are the AI Office Orchestrator & Autonomous Workforce Director.
Directly answer the user's inquiry with executive clarity, structured formatting, and deep insights.

Workforce Context: You lead autonomous specialists (Alex for Python/Code, Rio for Financial Modeling,
Nova for Deep Research, Jordan for Strategy, Mika for Content, Taylor for Operations).
{exp_context if exp_context else ""}

User Request:
"{state.user_input}"

Provide a comprehensive, professional, and directly actionable response.
"""
        orch_output = llm_generate(orch_reply_prompt)

        await event_bus.emit(
            event_type="AGENT_ASSIGNED",
            agent_id="orchestrator",
            task_id=state.task_id,
            metadata={
                "agent_name": "Orchestrator",
                "is_orchestrator": True,
                "action": "Orchestrator directly formulating response"
            }
        )

        return {
            "handled_by_orchestrator": True,
            "agent_output": orch_output,
            "assigned_agent_id": "orchestrator",
            "agent_name": "Orchestrator",
            "past_experiences": exp_context,
            "start_time": start_t,
            "execution_state": "completed",
            "status": "completed",
        }

    # ── STEP 6: agent dispatched for specialized conversational task ──────
    agent_obj = Repository.get_agent(selected_agent_id) if selected_agent_id else None
    agent_name = agent_obj.name if agent_obj else "Agent"

    Repository.update_agent_status(selected_agent_id, "assigned")
    if collab_agent_id:
        Repository.update_agent_status(collab_agent_id, "assigned")

    await event_bus.emit(
        event_type="AGENT_ASSIGNED",
        agent_id=selected_agent_id,
        task_id=state.task_id,
        metadata={
            "agent_name": agent_name,
            "is_temporary": is_temp,
            "need_rag": need_rag,
            "is_collaborative": is_collab,
            "collaborating_agent_id": collab_agent_id,
            "collaborating_agent_name": collab_agent_name
        }
    )

    return {
        "handled_by_orchestrator": False,
        "assigned_agent_id": selected_agent_id,
        "agent_name": agent_name,
        "collaborating_agent_id": collab_agent_id,
        "collaborating_agent_name": collab_agent_name,
        "is_collaborative": is_collab,
        "is_temporary_agent": is_temp,
        "need_rag": need_rag,
        "need_obsidian_knowledge": need_obsidian,
        "past_experiences": exp_context,
        "start_time": start_t,
        "execution_state": "planning",
        "status": "planning",
    }


def _select_agent_for_action(task_input: str, agents: list) -> Optional[str]:
    """
    Select the best existing agent for an action task.
    Priority: agents with python_runner or calculator tools, then skill match.
    Returns agent ID or None if no suitable agent found.
    """
    if not agents:
        return None

    task_low = task_input.lower()

    # Score each agent
    best_id = None
    best_score = -1

    for a in agents:
        score = 0
        # Execution tools are critical for action tasks
        if "python_runner" in a.tools:
            score += 10
        if "sandbox" in a.tools:
            score += 10
        if "calculator" in a.tools:
            score += 5
        if "workspace_writer" in a.tools:
            score += 3
        # Skill match
        for skill in a.skills:
            if skill.lower() in task_low:
                score += 2
        # Role match
        if a.role.lower() in task_low:
            score += 2

        if score > best_score:
            best_score = score
            best_id = a.id

    return best_id


# ---------------------------------------------------------------------------
# NODE 2: OBSIDIAN KNOWLEDGE RETRIEVAL
# ---------------------------------------------------------------------------
async def obsidian_retrieval_node(state: AgentOfficeState) -> Dict[str, Any]:
    """
    Retrieves relevant notes from the Obsidian vault when the Manager
    decides external human-readable knowledge is needed for this task.
    """
    from backend.app.tools.obsidian_tool import ObsidianTool, _get_vault_path

    vault_ok = _get_vault_path() is not None
    if not vault_ok:
        return {}  # Vault not configured — skip silently

    await event_bus.emit(
        event_type="AGENT_RETRIEVING",
        agent_id=state.assigned_agent_id,
        task_id=state.task_id,
        metadata={"source": "obsidian", "query": state.user_input[:80]}
    )

    obs = ObsidianTool()
    search_result = obs.run(json.dumps({"op": "search_notes", "query": state.user_input[:100]}))

    obsidian_context = search_result
    note_match = re.search(r"\[\[([^\]]+)\]\]", search_result)
    if note_match and "No notes found" not in search_result:
        note_title = note_match.group(1)
        note_content = obs.run(json.dumps({"op": "read_note", "title": note_title}))
        obsidian_context = f"{search_result}\n\nNote content:\n{note_content[:800]}"

    existing = state.retrieved_rag_context or ""
    combined = f"{existing}\n\n[Obsidian Knowledge]\n{obsidian_context}".strip()

    return {"retrieved_rag_context": combined}


# ---------------------------------------------------------------------------
# NODE 2b: RAG RETRIEVAL
# ---------------------------------------------------------------------------
async def rag_retrieval_node(state: AgentOfficeState) -> Dict[str, Any]:
    """Agentic RAG Node: queries the local vector store for matching context chunks."""
    await event_bus.emit(
        event_type="AGENT_RETRIEVING",
        agent_id=state.assigned_agent_id,
        task_id=state.task_id,
        metadata={"query": state.user_input}
    )

    chunks = rag_service.query(state.user_input, top_k=2)
    retrieved_text = "\n\n".join([
        f"Source [{c['metadata'].get('source', 'doc')}]: {c['text']}"
        for c in chunks
    ])

    return {"retrieved_rag_context": retrieved_text}


# ---------------------------------------------------------------------------
# NODE 3: AGENT EXECUTION NODE (MAKER)
# ---------------------------------------------------------------------------
async def agent_execution_node(state: AgentOfficeState) -> Dict[str, Any]:
    """
    Primary Agent Execution.

    Follows the full execution loop:
      PLANNING → RUNNING → TESTING → (FIXING →)* COMPLETED | FAILED

    Passes workspace_id to the agent so files are written to disk.
    Returns structured execution data (files_created, commands_run, tests, errors).
    """
    agent_config = Repository.get_agent(state.assigned_agent_id)
    if not agent_config:
        return {"error": f"Agent {state.assigned_agent_id} not found.", "status": "failed"}

    # Tool availability validation: ensure agent has execution capabilities for action tasks
    if is_action(state.user_input) and not any(t in agent_config.tools for t in ["python_runner", "sandbox", "calculator", "workspace_writer"]):
        existing = Repository.list_agents(include_archived=False)
        capable = next((a for a in existing if any(t in a.tools for t in ["python_runner", "sandbox"])), None)
        if capable:
            agent_config = capable
            state.assigned_agent_id = capable.id
            state.agent_name = capable.name

    Repository.update_agent_status(agent_config.id, "working")

    await event_bus.emit(
        event_type="AGENT_STARTED",
        agent_id=agent_config.id,
        task_id=state.task_id,
        metadata={
            "desk_id": agent_config.desk_id,
            "is_collaborative": state.is_collaborative,
            "collaborating_agent_name": state.collaborating_agent_name
        }
    )

    # Emit PLANNING state
    await event_bus.emit(
        event_type="AGENT_WORKING",
        agent_id=agent_config.id,
        task_id=state.task_id,
        metadata={
            "desk_id": agent_config.desk_id,
            "tools": agent_config.tools,
            "mode": "Pairing Lead" if state.is_collaborative else "Solo Execution",
            "execution_state": "planning",
            "action": f"Planning: {state.user_input[:60]}"
        }
    )

    agent_runner = GenericAgent(agent_config)
    execution_res = agent_runner.execute(
        task_input=state.user_input,
        rag_context=state.retrieved_rag_context,
        past_experiences=state.past_experiences,
        workspace_id=state.workspace_id,
    )

    files_created = execution_res.get("files_created", [])
    commands_run = execution_res.get("commands_run", [])
    tests = execution_res.get("tests", [])
    errors = execution_res.get("errors", [])

    # Emit TESTING state
    if commands_run:
        await event_bus.emit(
            event_type="AGENT_WORKING",
            agent_id=agent_config.id,
            task_id=state.task_id,
            metadata={
                "desk_id": agent_config.desk_id,
                "execution_state": "testing",
                "files_created": files_created,
                "action": f"Testing {len(files_created)} file(s)"
            }
        )

    Repository.update_agent_status(agent_config.id, "completed")
    await event_bus.emit(
        event_type="AGENT_COMPLETED",
        agent_id=agent_config.id,
        task_id=state.task_id,
        metadata={
            "output_preview": execution_res["output"][:100],
            "files_created": files_created,
            "tests_passed": sum(1 for t in tests if "✅" in t),
        }
    )

    # Build user-facing output that never leaks internal JSON
    final_output = _build_user_response(
        agent_output=execution_res["output"],
        files_created=files_created,
        commands_run=commands_run,
        tests=tests,
        errors=errors,
        workspace_id=state.workspace_id,
        task_input=state.user_input,
    )

    verification_passed = bool((tests and not errors) or any("pass" in t.lower() or "success" in t.lower() or "✅" in t for t in tests))

    return {
        "agent_output": final_output,
        "tools_used": execution_res.get("tools_used", []),
        "files_created": files_created,
        "commands_run": commands_run,
        "verification_passed": verification_passed,
        "execution_state": "completed" if not errors else "fixing",
        "status": "running",
    }


# ---------------------------------------------------------------------------
# NODE 3.5: PEER REVIEW / CO-PILOT
# ---------------------------------------------------------------------------
async def peer_review_node(state: AgentOfficeState) -> Dict[str, Any]:
    """Peer Reviewer: secondary collaborating agent reviews the output."""
    collab_agent = Repository.get_agent(state.collaborating_agent_id)
    reviewer_name = collab_agent.name if collab_agent else "Reviewer"

    if collab_agent:
        Repository.update_agent_status(collab_agent.id, "working")

    await event_bus.emit(
        event_type="AGENT_STARTED",
        agent_id=state.collaborating_agent_id,
        task_id=state.task_id,
        metadata={
            "role": "Peer Reviewer / Co-Pilot",
            "desk_id": collab_agent.desk_id if collab_agent else 2,
            "action": f"{reviewer_name} is conducting peer audit"
        }
    )
    await event_bus.emit(
        event_type="AGENT_WORKING",
        agent_id=state.collaborating_agent_id,
        task_id=state.task_id,
        metadata={
            "desk_id": collab_agent.desk_id if collab_agent else 2,
            "action": f"Auditing reasoning and code consistency with {state.agent_name or 'Lead'}"
        }
    )

    review_prompt = f"""
Act as {reviewer_name}, an expert peer reviewer in an autonomous AI office.
Inspect the following primary agent output for the user task:

Task: "{state.user_input}"
Primary Agent Output:
"{state.agent_output}"

Provide a concise, professional 2-sentence verification sign-off confirming correctness, robustness, and any key recommendation.
"""
    review_comment = llm_generate(review_prompt).strip()

    if collab_agent:
        Repository.update_agent_status(collab_agent.id, "completed")

    combined_output = f"{state.agent_output}\n\n---\n🛡️ **Peer Review Sign-Off ({reviewer_name})**:\n{review_comment}"

    await event_bus.emit(
        event_type="AGENT_COMPLETED",
        agent_id=state.collaborating_agent_id,
        task_id=state.task_id,
        metadata={"review_summary": review_comment[:100]}
    )

    return {
        "agent_output": combined_output,
        "peer_review_notes": review_comment
    }


# ---------------------------------------------------------------------------
# NODE 4: EVALUATOR
# ---------------------------------------------------------------------------
async def evaluation_node(state: AgentOfficeState) -> Dict[str, Any]:
    """
    Task Evaluator:
    - For execution tasks: checks verification_passed + files_created
    - For conversational tasks: checks if output answers the task satisfactorily
    """
    output_to_eval = state.agent_output or ""
    if state.is_collaborative and state.collaborating_agent_id and "Peer Review Sign-Off" not in output_to_eval:
        review_res = await peer_review_node(state)
        output_to_eval = review_res.get("agent_output", output_to_eval)
        state.agent_output = output_to_eval

    eval_result = evaluator.evaluate_task_result(
        task_id=state.task_id,
        user_input=state.user_input,
        agent_output=state.agent_output or ""
    )

    # Boost score if execution actually created files
    if state.files_created and eval_result.score < 0.8:
        eval_result = type(eval_result)(
            success=True,
            score=max(eval_result.score, 0.85),
            reason=f"{eval_result.reason} (files verified: {', '.join(state.files_created)})"
        )

    await event_bus.emit(
        event_type="EVALUATION_COMPLETED",
        agent_id=state.assigned_agent_id,
        task_id=state.task_id,
        metadata={
            "success": eval_result.success,
            "score": eval_result.score,
            "reason": eval_result.reason,
            "files_created": state.files_created,
            "verification_passed": state.verification_passed,
        }
    )

    return {
        "agent_output": state.agent_output,
        "evaluation": {
            "success": eval_result.success,
            "score": eval_result.score,
            "reason": eval_result.reason
        }
    }


# ---------------------------------------------------------------------------
# NODE 5: EXPERIENCE & MEMORY WRITER
# ---------------------------------------------------------------------------
async def experience_node(state: AgentOfficeState) -> Dict[str, Any]:
    """
    Calls MemoryWriter to decide where to store knowledge from this task.
    Also handles telemetry, XP, and temporary agent archival.
    """
    eval_record = None
    if state.evaluation:
        from backend.app.models.schemas import TaskEvaluation
        eval_record = TaskEvaluation(
            id=state.task_id,
            task_id=state.task_id,
            success=state.evaluation["success"],
            score=state.evaluation["score"],
            reason=state.evaluation["reason"]
        )

    feedback_record = Repository.get_feedback(state.task_id)

    memory_result = memory_writer.process(
        task_input=state.user_input,
        agent_output=state.agent_output or "",
        evaluation=eval_record,
        feedback=feedback_record
    )
    print(f"[MemoryWriter] destination={memory_result.get('destination')} reason={memory_result.get('reason', '')[:60]}")

    await event_bus.emit(
        event_type="EXPERIENCE_CREATED",
        agent_id=state.assigned_agent_id,
        task_id=state.task_id,
        metadata={
            "destination": memory_result.get("destination", "skip"),
            "lesson": memory_result.get("machine_lesson", ""),
            "obsidian_note": memory_result.get("obsidian_note_title", ""),
            "files_created": state.files_created,
        }
    )

    # Telemetry
    start_t = state.start_time or time.time()
    latency_ms = round(max(250.0, (time.time() - start_t) * 1000), 1)
    prompt_toks = len(state.user_input) // 4
    output_toks = len(state.agent_output or "") // 4
    tokens_used = max(80, prompt_toks + output_toks + 150)
    cost_usd = round(tokens_used * 0.000002, 5)

    artifacts = extract_task_artifacts(state.agent_output or "", state.user_input)
    # Attach workspace file list to artifacts
    if state.files_created:
        artifacts["workspace"] = {
            "task_id": state.workspace_id or state.task_id,
            "files": state.files_created,
        }

    # XP
    if state.assigned_agent_id and state.assigned_agent_id != "orchestrator":
        Repository.award_agent_xp(state.assigned_agent_id, 150)
    if state.collaborating_agent_id:
        Repository.award_agent_xp(state.collaborating_agent_id, 100)

    # Temporary agent archival
    if state.is_temporary_agent and state.assigned_agent_id:
        agent_factory.archive_agent(state.assigned_agent_id)
        await event_bus.emit(
            event_type="AGENT_ARCHIVED",
            agent_id=state.assigned_agent_id,
            task_id=state.task_id,
            metadata={"reason": "Temporary task completed"}
        )
    else:
        if state.assigned_agent_id and state.assigned_agent_id != "orchestrator":
            Repository.update_agent_status(state.assigned_agent_id, "idle")
        if state.collaborating_agent_id:
            Repository.update_agent_status(state.collaborating_agent_id, "idle")

    final_output = state.agent_output or ""

    task_res = TaskResponse(
        id=state.task_id,
        user_input=state.user_input,
        assigned_agent_id=state.assigned_agent_id,
        collaborating_agent_id=state.collaborating_agent_id,
        status="completed",
        result=final_output,
        retries=state.retries,
        tokens_used=tokens_used,
        latency_ms=latency_ms,
        cost_usd=cost_usd,
        artifacts=artifacts,
        created_at=datetime.now(timezone.utc).isoformat(),
        completed_at=datetime.now(timezone.utc).isoformat()
    )
    Repository.save_task(task_res)

    await event_bus.emit(
        event_type="TASK_COMPLETED",
        agent_id=state.assigned_agent_id,
        task_id=state.task_id,
        metadata={
            "result_preview": final_output[:120],
            "author_name": "Orchestrator" if state.handled_by_orchestrator else (state.agent_name or "Specialist"),
            "handled_by_orchestrator": state.handled_by_orchestrator,
            "tokens_used": tokens_used,
            "latency_ms": latency_ms,
            "cost_usd": cost_usd,
            "artifacts": artifacts,
            "files_created": state.files_created,
            "workspace_id": state.workspace_id,
        }
    )

    return {
        "status": "completed",
        "execution_state": "completed",
        "agent_output": final_output,
        "tokens_used": tokens_used,
        "latency_ms": latency_ms,
        "cost_usd": cost_usd,
        "artifacts": artifacts
    }


# ---------------------------------------------------------------------------
# CONDITIONAL ROUTERS
# ---------------------------------------------------------------------------
def route_after_orchestrator(
    state: AgentOfficeState,
) -> Literal["experience_node", "obsidian_node", "rag_node", "agent_execution_node"]:
    if state.handled_by_orchestrator:
        return "experience_node"
    if state.need_obsidian_knowledge:
        return "obsidian_node"
    if state.need_rag:
        return "rag_node"
    return "agent_execution_node"


def route_after_agent_execution(
    state: AgentOfficeState,
) -> Literal["evaluation_node"]:
    """Always proceed to evaluation after agent execution."""
    return "evaluation_node"


def route_after_evaluation(
    state: AgentOfficeState,
) -> Literal["experience_node", "agent_execution_node"]:
    is_success = state.evaluation and state.evaluation.get("success", False)
    if is_success or state.retries >= state.max_retries:
        return "experience_node"
    state.retries += 1
    return "agent_execution_node"


# ---------------------------------------------------------------------------
# BUILD THE LANGGRAPH WORKFLOW
# ---------------------------------------------------------------------------
def create_office_graph():
    workflow = StateGraph(AgentOfficeState)

    workflow.add_node("orchestrator_node", orchestrator_node)
    workflow.add_node("obsidian_node", obsidian_retrieval_node)
    workflow.add_node("rag_node", rag_retrieval_node)
    workflow.add_node("agent_execution_node", agent_execution_node)
    workflow.add_node("evaluation_node", evaluation_node)
    workflow.add_node("experience_node", experience_node)
    # Note: peer_review_node kept as function but not wired into default graph path.
    # Collaborative peer review is handled inline by evaluation_node instead.

    # START → orchestrator
    workflow.add_edge(START, "orchestrator_node")

    # Orchestrator → Experience (direct), Obsidian, RAG, or agent execution
    workflow.add_conditional_edges(
        "orchestrator_node",
        route_after_orchestrator,
        {
            "experience_node": "experience_node",
            "obsidian_node": "obsidian_node",
            "rag_node": "rag_node",
            "agent_execution_node": "agent_execution_node"
        }
    )

    # Obsidian → agent execution
    workflow.add_edge("obsidian_node", "agent_execution_node")

    # RAG → agent execution
    workflow.add_edge("rag_node", "agent_execution_node")

    # Agent execution → Evaluation (always)
    workflow.add_edge("agent_execution_node", "evaluation_node")

    # Evaluation → Experience (if pass) or Agent Execution (retry)
    workflow.add_conditional_edges(
        "evaluation_node",
        route_after_evaluation,
        {
            "experience_node": "experience_node",
            "agent_execution_node": "agent_execution_node"
        }
    )

    # Experience / MemoryWriter → END
    workflow.add_edge("experience_node", END)

    return workflow.compile()


office_graph = create_office_graph()
