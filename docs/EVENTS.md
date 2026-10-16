# Jev Office: Frontend & Backend Event Contract

This document formalizes the exact communication contract between the FastAPI backend and the existing 2D pixel-art office frontend (`frontend/src/main.js` and `frontend/src/office/officeManager.js`).

---

## 1. Transport Mechanisms

- **WebSocket Stream**: `ws://<host>:<port>/api/ws/events`
  The frontend automatically connects on load and reconnects every 3 seconds if disconnected.
- **REST Endpoints**: HTTP JSON request/response for actions and state queries.
- **SSE Stream (Optional/Auxiliary)**: `http://<host>:<port>/api/events` for CLI or external consumers.

---

## 2. Event Envelope Schema

Every event sent over the WebSocket stream is serialized as JSON matching this schema:

```json
{
  "id": "evt_abc12345",
  "type": "<EVENT_TYPE>",
  "task_id": "task_xyz789",
  "agent_id": "agent_alex_01",
  "message": "Human-readable status text",
  "timestamp": "2026-10-16T14:30:00Z",
  "metadata": {}
}
```

### Core Event Types & Metadata Payloads

| Event Type | Triggers In Frontend | Required `metadata` Fields |
| :--- | :--- | :--- |
| `TASK_CREATED` | Sets DAG node to Start, initializes task tracking | `{"objective": string, "route": "DIRECT"\|"TOOL"\|"MANAGER"}` |
| `AGENT_ASSIGNED` | Manager calls agent to desk; plays sound; sets DAG to Orch | `{"agent_name": string, "agent_id": string, "is_collaborative": bool, "collaborating_agent_name"?: string, "collaborating_agent_id"?: string}` |
| `AGENT_RETRIEVING` | Shows "Searching organizational knowledge..."; sets DAG to RAG | `{"query": string, "doc_count"?: int}` |
| `AGENT_STARTED` / `AGENT_WORKING` | Moves agent to desk, triggers typing animation & sound | `{"agent_name": string, "role": string, "tool"?: string}` |
| `AGENT_COMPLETED` | Agent walks back to Manager to submit output draft | `{"agent_name": string, "output_preview"?: string}` |
| `TOOL_CALLED` | Records tool execution in HUD/Event Feed | `{"tool": string, "input": object, "sandboxed": bool}` |
| `VERIFICATION_RESULT` | Evaluator verifies execution output | `{"passed": bool, "score": float, "reason": string}` |
| `EVALUATION_COMPLETED` | Updates Eval score badge and reason box; sets DAG to Eval | `{"score": float, "reason": string}` |
| `EXPERIENCE_CREATED` | Updates DAG to Exp; Manager speaks learning note | `{"experience_id": string, "summary": string}` |
| `TASK_COMPLETED` | Increments completed counter; triggers fanfare; fetches result | `{"result": string, "duration_ms"?: int}` |
| `TASK_FAILED` | Shows error message in assistant chat; returns agent | `{"error": string}` |
| `DIRECT_CHAT_MESSAGE` | Emits immediate conversational response from Manager | `{"reply": string, "author_name": string}` |
| `AGENT_CREATED` | Triggers office roster refresh; agent enters door | `{"agent": object}` |
| `AGENT_ARCHIVED` | Temporary specialist says farewell and departs office | `{"agent_id": string, "reason"?: string}` |
| `FEEDBACK_RECEIVED` | Confirms user star rating | `{"rating": int, "comment"?: string}` |
| `PERMISSION_REQUESTED` | Prompts user confirmation for gated actions | `{"action": string, "tool": string, "command": string}` |

---

## 3. REST Endpoints Contract

### Chat & Dispatch
- `POST /api/chat`
  - **Request Body**:
    ```json
    {
      "message": "string",
      "assigned_agent_id": "optional_string"
    }
    ```
  - **Response (Direct / Fast Path)**:
    ```json
    {
      "task_id": "task_123",
      "reply": "Manager response text"
    }
    ```
  - **Response (Multi-step / Tool / Async Task)**:
    ```json
    {
      "task_id": "task_123",
      "status": "pending"
    }
    ```

### Tasks
- `GET /api/tasks/{task_id}`
  - **Response**:
    ```json
    {
      "id": "task_123",
      "prompt": "string",
      "status": "completed" | "failed" | "running",
      "result": "string",
      "evaluation": { "score": 0.95, "reason": "Verified" },
      "created_at": "timestamp"
    }
    ```

### Organization & Agents
- `GET /api/agents`: Returns list of all active agents (`AgentConfig[]`).
- `POST /api/agents`: Creates a permanent or custom agent.
- `GET /api/organization/state`: Returns `{ "agents": [...], "tasks_completed": int, "active_tasks": int }`.

### Memory, Skills, and Learning
- `GET /api/skills`: Returns all active skills with descriptions and procedures.
- `GET /api/memory`: Returns recent semantic memories and vault notes.
- `GET /api/experiences`: Returns distilled organizational learning entries.
- `POST /api/feedback`: `{ "task_id": "string", "rating": 1-5, "comment": "string" }`.

### LLM Runtime Config
- `GET /api/llm/config`: Current provider, model, and base URL.
- `POST /api/llm/config`: Updates model provider or API endpoints.
- `GET /api/llm/models`: Available models from provider.
- `POST /api/llm/test`: Connectivity test for LLM backend.
