# 📘 Project Guide: Agentic AI Office (Version 1)

This guide provides an in-depth, technical walkthrough of the **Agentic AI Office** codebase. It explains every core file, class, function, input, output, and dependency, followed by a step-by-step trace of a complete end-to-end task execution.

---

## 🏗️ Architectural Philosophy

The system is designed with 4 guiding tenets:
1. **Single Generic Agent Model**: Instead of creating rigid class hierarchies (`CodingAgent`, `FinanceAgent`, `ResearchAgent`), there is exactly **ONE** `GenericAgent` class whose role, behavior, tool access, and memories are defined declaratively via `AgentConfig`.
2. **LangGraph as the Workflow Engine**: Workflows are governed by a stateful, cyclic directed graph (`StateGraph(AgentOfficeState)`) with explicit conditional edges, evaluation checks, and bounded loop counters.
3. **Real Backend State Drives Visualization**: The 2D office frontend does not use randomized or fake animations. Visual characters move and talk solely in response to 13 strictly typed backend events emitted via WebSockets.
4. **Experience-Based Adaptation Without RLHF**: The system improves on future tasks by distilling completed tasks, evaluations, and human feedback into structured lessons stored in SQLite and injected into future agent prompts.

---

## 📂 File-by-File Technical Breakdown

### 1. `backend/app/models/schemas.py`
- **Purpose**: Defines strongly typed Pydantic models for every entity in the office.
- **Key Classes**:
  - `AgentConfig`: Stores `id`, `name`, `role`, `description`, `instructions`, `skills`, `tools`, `permanent`, `memory_enabled`, `status`, `desk_id`, and `created_at`.
  - `TaskResponse`: Models task lifecycle, status (`pending`, `in_progress`, `completed`, `failed`), `result`, and `retries`.
  - `TaskEvaluation`: Captures `success: bool`, `score: float`, and `reason: str`.
  - `FeedbackResponse`: Holds human rating (1–5 stars) and qualitative commentary.
  - `ExperienceRecord`: Distills `task_summary`, `strategy`, `what_worked`, `what_failed`, `feedback`, and `lesson`.
  - `OfficeEvent`: Encapsulates the 13 backend event types with metadata.
- **Why it exists**: Guarantees strict runtime data validation and clean contracts between database, LangGraph, API routes, and WebSockets.

---

### 2. `backend/app/database/db.py` & `repository.py`
- **Purpose**: Pure Python SQLite3 database connection manager and typed data access layer (DAO / Repository pattern).
- **Key Functions in `Repository`**:
  - `save_agent(agent)` / `get_agent(agent_id)` / `list_agents()`: Serializes skills and tools to JSON strings and saves agents.
  - `save_task(task)` / `get_task(task_id)` / `list_tasks()`: Manages task records and results.
  - `save_evaluation(eval_record)`: Stores automated evaluation outcomes.
  - `save_feedback(feedback)`: Stores human star ratings and commentary.
  - `save_experience(exp)` / `list_experiences()`: Stores distilled organizational lessons.
  - `save_event(event)` / `get_events_for_task(task_id)`: Persists real-time event records for auditing and playback.
- **Inputs & Outputs**: Takes Pydantic models &rarr; maps to SQLite rows &rarr; returns hydrated Pydantic models.
- **Who calls it**: LangGraph nodes, API routes, EventBus, AgentFactory, MemoryStore.
- **What it calls**: `sqlite3` driver.

---

### 3. `backend/app/events/event_bus.py`
- **Purpose**: Central event emitter that connects backend lifecycle transitions to persistent storage and real-time WebSocket broadcasting.
- **Key Class**: `EventBus`
- **Key Method**:
  ```python
  async def emit(self, event_type: EventType, agent_id=None, task_id=None, metadata=None) -> OfficeEvent
  ```
  - **Inputs**: One of the 13 strictly typed event names, optional agent ID, optional task ID, and arbitrary metadata dictionary.
  - **Outputs**: Instantiated `OfficeEvent`.
  - **Execution Flow**:
    1. Instantiates `OfficeEvent` with UUID and ISO timestamp.
    2. Calls `Repository.save_event` to persist to SQLite.
    3. Asynchronously broadcasts the event to all registered subscribers (WebSockets).
- **The 13 Supported Events**:
  - `TASK_CREATED`, `AGENT_ASSIGNED`, `AGENT_STARTED`, `AGENT_WORKING`, `AGENT_RETRIEVING`, `AGENT_COMPLETED`, `EVALUATION_COMPLETED`, `FEEDBACK_RECEIVED`, `EXPERIENCE_CREATED`, `AGENT_CREATED`, `AGENT_ARCHIVED`, `TASK_COMPLETED`, `TASK_FAILED`.
- **Who calls it**: LangGraph nodes during workflow execution, FastAPI route handlers.
- **What it calls**: `Repository.save_event`, `WebSocketManager.broadcast_event`.

---

### 4. `backend/app/tools/registry.py`
- **Purpose**: Controlled tool calling abstraction without unrestricted OS/shell access.
- **Key Classes**:
  - `CalculatorTool`: Parses and evaluates arithmetic and mathematical formulas using Python's abstract syntax tree (`ast`) parser. Prohibits arbitrary code execution.
  - `PythonRunnerTool`: Executes controlled Python scripts in an isolated namespace with restricted built-in functions, timeouts, and stdout capturing. Strictly blocks `os`, `sys`, `subprocess`, `socket`, `open`, `eval`, etc.
  - `ToolRegistry`: Holds registered tool instances and exposes `execute(name, argument)`.
- **Inputs**: Tool name (`str`), argument/expression (`str`).
- **Outputs**: Formatted output string or error message.
- **Who calls it**: `GenericAgent.execute`.

---

### 5. `backend/app/retrieval/vector_store.py` & `rag_service.py`
- **Purpose**: Local document ingestion, chunking, and similarity retrieval for agentic RAG.
- **Key Classes**:
  - `SimpleVectorStore`: Lightweight, dependency-free vector store using tokenization, length-normalized term overlap, and cosine similarity ranking.
  - `RAGService`: Seeds default company documentation (`company_guidelines.md`, `technical_stack.md`) and exposes `query(query_text, top_k)`.
- **Inputs**: Query string (`str`).
- **Outputs**: List of matching chunks with document IDs, source text, and relevance score.
- **Who calls it**: `rag_retrieval_node` in `backend/app/orchestration/graph.py`.

---

### 6. `backend/app/memory/memory_store.py`
- **Purpose**: Manages the 3-tier memory model:
  1. *Ephemeral Task State* (inside `AgentOfficeState` during LangGraph lifecycle).
  2. *Persistent Agent Memory* (agent notes/preferences saved to SQLite).
  3. *Experience Memory* (organization-wide distilled lessons saved to SQLite and retrieved for future tasks).
- **Key Methods**:
  - `save_agent_note(agent_id, key, content)` / `format_agent_memories_for_prompt(agent_id)`: Formats agent-specific notes into a prompt section.
  - `save_experience(...)`: Records structured lessons.
  - `get_relevant_experiences(task_query)`: Performs keyword and topic similarity search across past experiences to inject relevant lessons into upcoming tasks.
- **Who calls it**: `orchestrator_node` (to retrieve past experiences), `generic_agent` (to load memories), `experience_node` (to store lessons).

---

### 7. `backend/app/agents/generic_agent.py` & `agent_factory.py`
- **Purpose**: Implements the single reusable agent execution engine and natural language hiring factory.
- **Key Classes**:
  - `GenericAgent`:
    - Method: `execute(task_input, rag_context, past_experiences) -> Dict[str, Any]`
    - Gathers personal memories, checks if registered tools (`calculator`, `python_runner`) are needed, runs tools, formats the complete system prompt, calls the LLM, and returns structured output.
  - `AgentFactory`:
    - Method: `create_agent_from_prompt(prompt, permanent=True) -> AgentConfig`
      Extracts structured agent configuration from natural language via LLM, assigns an available desk (Desks 1–6), validates allowed tools, and saves to SQLite.
    - Method: `create_temporary_agent(task_description, missing_capability) -> AgentConfig`
      Dynamically summons a temporary specialist agent with `permanent=False` to handle uncovered task domains.
    - Method: `archive_agent(agent_id)`
      Marks an agent status as `archived` in SQLite upon task completion.
- **Who calls it**: LangGraph `agent_execution_node`, `orchestrator_node`, and `POST /api/agents`.

---

### 8. `backend/app/evaluation/evaluator.py`
- **Purpose**: Automated task evaluator.
- **Key Method**: `evaluate_task_result(task_id, user_input, agent_output) -> TaskEvaluation`
- **Inputs**: Original user task string, final agent output string.
- **Outputs**: `TaskEvaluation` object containing `success: bool`, `score: float` (0.0 to 1.0), and `reason: str`.
- **Who calls it**: `evaluation_node` in `graph.py`.

---

### 9. `backend/app/orchestration/state.py` & `graph.py`
- **Purpose**: Core LangGraph workflow definition and typed state container.
- **Key Class**: `AgentOfficeState`
- **LangGraph Flow Nodes**:
  1. `orchestrator_node`:
     - Inspects existing permanent agents.
     - Decides whether an existing agent is capable or if a temporary specialist must be created.
     - Decides if agentic RAG retrieval is required (`need_rag: bool`).
     - Queries `memory_store` for past experiences.
     - Emits `AGENT_ASSIGNED`.
  2. `rag_retrieval_node`:
     - Emits `AGENT_RETRIEVING`.
     - Queries `rag_service` and attaches chunks to `state.retrieved_rag_context`.
  3. `agent_execution_node`:
     - Emits `AGENT_STARTED` and `AGENT_WORKING`.
     - Executes `GenericAgent.execute`.
     - Emits `AGENT_COMPLETED`.
  4. `evaluation_node`:
     - Executes `Evaluator.evaluate_task_result`.
     - Emits `EVALUATION_COMPLETED`.
  5. `experience_node`:
     - Calls `experience_service.summarize_and_store`.
     - Emits `EXPERIENCE_CREATED`.
     - If `is_temporary_agent`: archives agent and emits `AGENT_ARCHIVED`.
     - Updates SQLite task record and emits `TASK_COMPLETED`.
- **Conditional Routing Functions**:
  - `route_after_orchestrator`: If `state.need_rag` &rarr; `rag_node`, else &rarr; `agent_execution_node`.
  - `route_after_evaluation`: If `state.evaluation["success"]` or `retries >= max_retries` &rarr; `experience_node`, else increments `state.retries` and loops back to `agent_execution_node`.

---

### 10. `backend/app/api/routes.py` & `websocket.py`
- **Purpose**: Minimal REST API and real-time WebSocket connection manager.
- **Endpoints**:
  - `POST /api/agents`: Natural-language hiring endpoint.
  - `GET /api/agents`: List all active agents.
  - `GET /api/agents/{id}` / `PATCH /api/agents/{id}` / `DELETE /api/agents/{id}`: Agent CRUD.
  - `POST /api/tasks`: Dispatches a new task into background LangGraph execution.
  - `GET /api/tasks/{id}`: Returns status and result for a task.
  - `GET /api/tasks/{id}/events`: Returns historical events for a task.
  - `POST /api/feedback`: Records star rating and comment for a task.
  - `GET /api/organization/state`: Returns live state (agents, active tasks, stats, events).
  - `GET /api/experiences`: Returns organizational experience bank.
  - `WebSocket /api/ws/events`: Broadcasts live events to the frontend.

---

## 🔄 End-to-End Task Lifecycle (Step-by-Step Trace)

Here is how one complete task travels through the entire system:

```
[1] User enters prompt in UI
     ↓
[2] POST /api/tasks
     ↓ (FastAPI creates task record, emits TASK_CREATED event)
[3] Background Worker: office_graph.ainvoke(initial_state)
     ↓
[4] LangGraph: orchestrator_node (Manager Jordan)
     ├─ Inspects existing workforce from Repository.list_agents()
     ├─ Matches existing agent OR creates temporary specialist via AgentFactory
     ├─ Evaluates if query needs company documents (need_rag)
     ├─ Retrieves past organizational experiences from MemoryStore
     └─ Emits AGENT_ASSIGNED
     ↓
[5] Conditional Router: route_after_orchestrator
     ├─ If need_rag == True:
     │   └─ LangGraph: rag_retrieval_node
     │       ├─ Emits AGENT_RETRIEVING
     │       └─ Queries local SimpleVectorStore for relevant chunks
     └─ Routes to agent_execution_node
     ↓
[6] LangGraph: agent_execution_node
     ├─ Emits AGENT_STARTED & AGENT_WORKING
     ├─ GenericAgent.execute() runs:
     │   ├─ Injects AgentConfig instructions & skills
     │   ├─ Injects RAG chunks & past experiences
     │   ├─ Calls tools (Calculator / PythonRunner) if needed
     │   └─ Calls LLM to synthesize final output
     └─ Emits AGENT_COMPLETED
     ↓
[7] LangGraph: evaluation_node
     ├─ Evaluator grades agent output against initial prompt
     └─ Emits EVALUATION_COMPLETED (success, score, reason)
     ↓
[8] Conditional Router: route_after_evaluation
     ├─ If failed AND retries < MAX_RETRIES:
     │   └─ Loops back to agent_execution_node for refinement
     └─ If passed OR retries >= MAX_RETRIES:
         └─ Proceeds to experience_node
     ↓
[9] LangGraph: experience_node
     ├─ ExperienceService summarizes task, strategy, what worked, and lesson
     ├─ MemoryStore persists experience to SQLite
     ├─ Emits EXPERIENCE_CREATED
     ├─ If agent was temporary: archives agent and emits AGENT_ARCHIVED
     ├─ Saves final task result to SQLite
     └─ Emits TASK_COMPLETED
     ↓
[10] Frontend WebSocket Listener
     ├─ Receives real-time events sequentially
     ├─ Moves character sprites across Canvas (walk to manager, sit at desk, type, walk back)
     ├─ Displays speech bubbles and status tags
     ├─ Populates Task Result card and Evaluator score
     └─ Updates top metrics and event stream
     ↓
[11] User submits star rating and feedback via POST /api/feedback
     ├─ Feedback is persisted to SQLite
     └─ Enriches future experience retrieval queries
```
