# 🎓 Interview Guide: Agentic AI Office (Version 1)

This guide provides precise, senior-level interview answers to the 17 core technical questions about the **Agentic AI Office** architecture. Every answer is grounded directly in the actual Python and JavaScript code of this repository.

---

### 1. What is an agent in your system?
**Interview Answer:**
> In our architecture, an agent is **not** a separate subclass for every role (like `CodingAgent` or `FinanceAgent`). Instead, we implement **ONE reusable `GenericAgent` class** (`backend/app/agents/generic_agent.py`) configured by an `AgentConfig` Pydantic model (`backend/app/models/schemas.py`).
>
> An agent encapsulates:
> 1. **Identity & Instructions**: Name, role, description, and system prompt.
> 2. **Skills & Tool Access**: Whitelisted tools from our `ToolRegistry` (e.g., `calculator`, `python_runner`).
> 3. **Persistent Memories**: Individual notes and preferences loaded from the `memories` table in SQLite.
> 4. **State Machine**: A status flag (`idle`, `assigned`, `working`, `completed`, `archived`) and physical office desk coordinate (`desk_id`).
>
> When `GenericAgent.execute()` runs, it injects the agent's instructions, available tools, retrieved RAG context, and past experiences into an execution prompt, invokes tools if necessary, and returns a verified result.

---

### 2. What is the orchestrator, and what does it do?
**Interview Answer:**
> The orchestrator (**Manager Jordan**) is the LLM-powered manager implemented as the entry node (`orchestrator_node` in `backend/app/orchestration/graph.py`).
>
> When a user submits a task, the orchestrator:
> 1. Queries `Repository.list_agents()` to inspect the skills and roles of the existing workforce.
> 2. Decides whether an existing agent can handle the task or if a temporary specialist must be created.
> 3. Makes an **agentic RAG decision** (`need_rag: bool`) determining whether external company documents must be retrieved.
> 4. Retrieves relevant historical organizational experiences from `MemoryStore`.
> 5. Emits `AGENT_ASSIGNED` via `EventBus` to notify the 2D frontend.

---

### 3. Why LangGraph instead of standard chains or raw Python loops?
**Interview Answer:**
> We chose **LangGraph** because real agentic workflows require **cyclic graphs with shared, typed state** (`AgentOfficeState` in `backend/app/orchestration/state.py`), which standard DAGs or linear LangChain chains cannot handle cleanly.
>
> Key benefits in our code:
> - **Stateful Transitions**: Every node (`orchestrator_node`, `rag_node`, `agent_execution_node`, `evaluation_node`, `experience_node`) accepts and returns updates to the shared `AgentOfficeState`.
> - **Conditional Edges**: Dynamic routing decisions (`route_after_orchestrator` and `route_after_evaluation`) dictate whether to fetch RAG docs or loop back for refinement.
> - **Bounded Cycles**: Cyclic evaluation loops can be strictly guarded with a retry ceiling (`state.retries < state.max_retries`) to prevent infinite looping.

---

### 4. How are agents created?
**Interview Answer:**
> Agents are created through the `AgentFactory` (`backend/app/agents/agent_factory.py`).
>
> When a user enters a natural-language prompt (e.g., *"Create Elena, a Data Scientist specializing in statistical analysis"*):
> 1. The factory sends an extraction prompt to the LLM to produce a structured JSON configuration (`name`, `role`, `description`, `instructions`, `skills`, `tools`).
> 2. The factory validates the generated configuration: it validates tools against permitted registry tools and assigns an unused desk (Desks 1–6) via `_find_available_desk()`.
> 3. The validated `AgentConfig` is saved to the SQLite `agents` table and immediately broadcasted over the `EventBus` (`AGENT_CREATED`), which adds the character sprite to the 2D canvas.

---

### 5. How do permanent agents work?
**Interview Answer:**
> Permanent agents (`permanent=True`) are long-lived employees stored in SQLite. They persist across application restarts and sessions. They remain seated at their assigned desks in the office (`desk_id`) in an `idle` state until assigned a task by Manager Jordan, at which point they walk to the manager, receive instructions, return to their desk to execute, deliver results, and return to `idle`.

---

### 6. How do temporary agents work?
**Interview Answer:**
> Temporary agents (`permanent=False`) are dynamically spawned specialists created when the orchestrator determines that the current workforce lacks a specific capability (e.g., a medical nutrition analysis or crypto tax problem).
>
> **Lifecycle**:
> 1. In `orchestrator_node`, if no agent matches, it calls `AgentFactory.create_temporary_agent(task, missing_capability)`.
> 2. The agent is saved with `permanent=False`, given a temporary badge (`Temp_`), and assigned to Desk #6.
> 3. An `AGENT_CREATED` event triggers the frontend to spawn the character at the office entrance door (`DOOR_COORDINATES`), walking to their desk.
> 4. The temporary agent executes the task and the evaluator grades it.
> 5. In `experience_node`, the temporary agent is archived (`Repository.update_agent_status(id, 'archived')`), and an `AGENT_ARCHIVED` event causes the character to say goodbye, walk to the exit door, and disappear from the office.

---

### 7. How does memory work?
**Interview Answer:**
> We explicitly avoid saving endless raw chat histories forever. Instead, we implement a **3-Tier Memory Model** (`backend/app/memory/memory_store.py`):
> 1. **Ephemeral Task State**: Transient context stored inside `AgentOfficeState` during LangGraph execution and cleared when the task completes.
> 2. **Persistent Agent Memory**: Agent-specific preferences, notes, or role instructions saved in the SQLite `memories` table via `save_agent_note()` and injected into that specific agent's prompt.
> 3. **Experience Memory**: Organization-wide distilled lessons saved in the `experiences` table and retrieved across all agents for similar tasks.

---

### 8. What is RAG?
**Interview Answer:**
> **RAG (Retrieval-Augmented Generation)** is the technique of supplementing an LLM prompt with domain-specific document chunks retrieved from a knowledge base.
>
> In our code (`backend/app/retrieval/vector_store.py` and `rag_service.py`):
> 1. Local markdown documents (`company_guidelines.md`, `technical_stack.md`) are split into paragraph chunks.
> 2. Chunks are indexed in `SimpleVectorStore`.
> 3. During retrieval, queries are matched using term-overlap and cosine similarity.
> 4. Retrieved chunks are appended under `"Retrieved Company Documents (RAG):"` in the agent's prompt.

---

### 9. What is agentic RAG?
**Interview Answer:**
> In conventional RAG, retrieval runs on *every single request* regardless of whether it's needed, which wastes latency and tokens.
>
> In **Agentic RAG**, retrieval is an autonomous decision made by the system. In `orchestrator_node` (`graph.py`), the orchestrator analyzes the query and sets `state.need_rag: bool`. If the user asks *"Calculate 25 * 4"*, `need_rag` is `False`, and LangGraph's `route_after_orchestrator` bypasses `rag_node` completely, routing directly to `agent_execution_node`. Retrieval only fires when domain or policy knowledge is actually required.

---

### 10. How does the experience-learning loop work?
**Interview Answer:**
> After an agent completes a task, the workflow transitions to `experience_node` (`graph.py`):
> 1. `ExperienceService.summarize_and_store()` takes the initial task, the agent's output, the evaluation score/reason, and any human feedback.
> 2. An LLM summarizer distills this into a structured `ExperienceRecord`: `task_summary`, `strategy`, `what_worked`, `what_failed`, and `lesson`.
> 3. The record is saved to the SQLite `experiences` table.
> 4. For future tasks, `orchestrator_node` queries `MemoryStore.get_relevant_experiences(task_query)` and prepends past organizational learnings into the agent's prompt.

---

### 11. Is this RLHF?
**Interview Answer:**
> **No, this is NOT RLHF (Reinforcement Learning from Human Feedback).**
>
> RLHF adjusts the underlying neural network weights of a base model using a learned reward model and policy optimization (such as PPO or DPO).
>
> Our architecture uses **In-Context Experience Learning via Human Feedback Adaptation**:
> - We do **not** train or fine-tune neural network weights.
> - Instead, human star ratings and comments are captured via `POST /api/feedback`, stored in SQLite, and fed into an LLM experience summarizer.
> - The distilled lessons are retrieved dynamically as prompt context for future tasks. This achieves behavioral adaptation with zero model retraining costs.

---

### 12. How does evaluation work?
**Interview Answer:**
> In `evaluation_node` (`graph.py`), `Evaluator.evaluate_task_result()` (`backend/app/evaluation/evaluator.py`) inspects the agent's output against the user's initial prompt.
>
> It returns a structured `TaskEvaluation` with:
> - `success: bool` (did the answer satisfy requirements?)
> - `score: float` (0.0 to 1.0 confidence score)
> - `reason: str` (explanation of the grade)
>
> In `route_after_evaluation`, if `success` is `False` and `retries < max_retries`, the graph routes back to `agent_execution_node` for refinement; otherwise, it proceeds to `experience_node`.

---

### 13. How does feedback affect future tasks?
**Interview Answer:**
> When a user rates a task (1–5 stars) and leaves a comment via `POST /api/feedback`, the feedback is stored in the `feedback` table.
>
> When `ExperienceService.summarize_and_store()` runs, it ingests this human feedback directly into the prompt. A low rating highlights what failed, while a high rating reinforces successful strategies. Future tasks matching that topic retrieve these experiences from `MemoryStore.get_relevant_experiences()`, ensuring agents do not repeat past mistakes.

---

### 14. How does the 2D office connect to the backend?
**Interview Answer:**
> The frontend connects to the backend through a dual-channel architecture:
> 1. **REST API**: On page load, `fetch('/api/organization/state')` hydrates initial workforce stats, agent roster, desk assignments, and active tasks.
> 2. **Real-time WebSocket (`/api/ws/events`)**: Connected via `WebSocketManager` (`backend/app/api/websocket.py`). Whenever LangGraph or the API emits an event, the JSON payload is streamed instantly to `frontend/src/main.js`.
>
> `OfficeManager.handleBackendEvent(event)` (`frontend/src/office/officeManager.js`) receives the event and triggers character movement:
> - `AGENT_ASSIGNED` &rarr; agent walks from desk to manager.
> - `AGENT_STARTED` &rarr; agent walks to desk.
> - `AGENT_WORKING` &rarr; character enters typing state with screen sparks and speech bubbles.
> - `AGENT_COMPLETED` &rarr; agent walks back to manager to deliver results.

---

### 15. Why are backend events necessary?
**Interview Answer:**
> Backend events are necessary because **the backend is the single source of truth**.
>
> Without real backend events, the frontend would have to rely on fake timers or randomized animations (which gives a misleading illusion of work). By emitting 13 typed events directly from the LangGraph nodes (`orchestrator_node`, `rag_node`, `agent_execution_node`, `evaluation_node`, `experience_node`), the 2D office visualizes the **actual runtime state** of the AI organization at 60 FPS.

---

### 16. What happens if an agent fails?
**Interview Answer:**
> If an agent fails (e.g. tool runtime error or insufficient answer):
> 1. The `Evaluator` detects the failure and returns `success=False` with the failure reason.
> 2. LangGraph's `route_after_evaluation` checks `state.retries < state.max_retries`.
> 3. If under the retry limit, `state.retries` is incremented, and the task loops back to `agent_execution_node` with the evaluator feedback to refine the output.
> 4. If an unhandled Python exception occurs, `run_task_in_graph` in `routes.py` catches it, marks the task status as `failed` in SQLite, and emits a `TASK_FAILED` event so the frontend updates the status banner and returns the agent to idle.

---

### 17. How do you prevent infinite loops?
**Interview Answer:**
> We prevent infinite loops in two ways:
> 1. **LangGraph State Ceiling**: In `AgentOfficeState`, we define `retries: int = 0` and `max_retries: int = 2`. In the conditional router `route_after_evaluation`, even if `success` is `False`, the condition `retries >= max_retries` forces the workflow to break out of the loop and route to `experience_node` and `END`.
> 2. **LangGraph Recursion Limit**: LangGraph's built-in engine terminates execution if recursion exceeds limits, safeguarding system resources.
