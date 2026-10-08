# Obsidian Integration — ✅ Complete

Added as an optional external knowledge layer on top of the existing Chroma + SQLite architecture.

## Storage Separation

| Layer | Purpose |
|-------|--------|
| **SQLite** | Structured application state (agents, tasks, evaluations) |
| **Chroma** | Semantic machine memory and experience retrieval |
| **Obsidian** | Human-readable durable knowledge (projects, concepts, decisions) |
| **Manager** | Decides independently which layers are needed per request |

---

## Implementation Status — All Items Complete ✅

### Backend
- [x] `graph.py` — Unified Manager path; no Chat/Cowork split; `memory_writer_node` at END; MAX_RETRIES=2
- [x] `state.py` — Added `execution_trace`, `memory_context`, `verification_passed` fields
- [x] `agent_factory.py` — Expanded allowed tools (calculator, python_runner, browser, file_reader, obsidian, form_filler); accepts form override fields (name, description, tools, model)
- [x] `schemas.py` — `system_prompt` + `model` on AgentConfig; `AgentCreatePromptRequest` accepts full form fields
- [x] `memory/memory_writer.py` — MemoryWriter with type/importance metadata
- [x] `api/routes.py` — `/chat` always uses Manager graph; `/skills` GET; `/memory` GET; knowledge endpoints
- [x] `backend/skills/` — research, coding, data_analysis, pdf, knowledge-capture SKILL.md files

### Frontend
- [x] `index.html` — New M two-dot logo; no Chat/Cowork toggle; expanded hire form; slash commands in popup (/skills, /models, /memory, /status, /agents)
- [x] `main.js` — Unified dispatch through `/api/chat` → Manager; `/skills`, `/models`, `/memory`, `/status`, `/agents` slash handlers; `fetchAndShowSkills()`, `fetchAndShowMemory()`, `showOfficeStatus()`
- [x] `canvas.js` — Realistic 3-rack server room: 1U panel slots, blinking LEDs, cable trays, KVM terminal

---

## Verification

### Start the server
```
uvicorn backend.app.main:app --reload
```

### Manual Checks
1. New M logo visible in header, no Chat/Cowork toggle
2. Type any message → Manager graph routes it (office animations fire)
3. Type `/` → popup shows /skills, /models, /memory, /status, /agents
4. `/skills` → lists Research, Coding, Data Analysis, PDF skills
5. `/memory` → shows experience bank entries
6. `/status` → shows agent count, model, connection state
7. `+ Add Agent` → full form: Name, Description, System Prompt, Tools, Model, Memory
8. Server Room shows realistic rack servers with blinking LEDs

### Backend API Checks
- `GET /api/skills` → `{skills: [...], count: N}`
- `GET /api/memory` → `{memory: [...], count: N}`
- `POST /api/chat` → `{task_id, status: "dispatched", mode: "manager"}`
- `POST /api/agents` → accepts `{prompt, name, description, tools, model, memory_enabled}`

---

## Open Notes

> [!NOTE]
> **Voice (Whisper)**: Browser speech recognition retained. Whisper local transcription is a follow-up.

> [!NOTE]
> **Chroma vector DB**: MemoryWriter is on top of SQLite experience store. Chroma integration is a follow-up.

> [!NOTE]
> **Scheduler**: Morning briefing scheduler deferred to a follow-up pass.


Added as an optional external knowledge layer on top of the existing Chroma + SQLite architecture.

## Storage Separation

| Layer | Purpose |
|-------|--------|
| **SQLite** | Structured application state (agents, tasks, evaluations) |
| **Chroma** | Semantic machine memory and experience retrieval |
| **Obsidian** | Human-readable durable knowledge (projects, concepts, decisions) |
| **Manager** | Decides independently which layers are needed per request |

---

## What Stays (Preserved)
- **LangGraph graph structure** — simplified nodes, same file
- **GenericAgent + AgentFactory** — kept, extended
- **ToolRegistry** — kept, categorized
- **SQLite Repository** — kept for structured state
- **WebSocket event system** — kept as-is
- **Canvas 2D office** — kept, server room improved
- **FastAPI + CORS + static mount** — kept

## What Changes
- Orchestration: Remove Chat/Cowork split, one unified Manager path
- Memory: Replace keyword-match experience with a MemoryWriter pattern
- Agent creation UI: Full form (name, description, prompt, skills, tools, model)
- Logo: New "M" mark replacing lightning bolt
- Header: Remove Cowork toggle, remove audio wave box after mic
- Server Room: Realistic rack servers with cable trays, rack units, status panels
- Skills: File-based `skills/` directory with SKILL.md markdown definitions
- Slash commands: `/skills`, `/models`, `/agents`, `/tools`, `/memory`, `/status`

---

## Proposed Changes

### Backend

#### [MODIFY] `backend/app/orchestration/graph.py`
- Merge `direct_orchestrator` and `cowork` into one Manager path
- Remove peer_review_node (replace with optional verification inside evaluation_node)
- Rename `orchestrator_node` → `manager_node`
- Add `memory_writer_node` at the END of the graph
- Reduce graph to: START → manager → [memory_retrieval?] → execute → verify → synthesize → memory_writer → END
- MAX_RETRIES = 2

#### [MODIFY] `backend/app/orchestration/state.py`
- Add fields: `execution_trace`, `memory_context`, `verification_passed`

#### [MODIFY] `backend/app/agents/agent_factory.py`
- Expand allowed tools list to include all ToolRegistry tools
- Support `model` field in AgentConfig

#### [MODIFY] `backend/app/models/schemas.py`
- Add `system_prompt` field to AgentConfig (replaces `instructions`)
- Add `model` field to AgentConfig
- Keep `instructions` as alias for backward compat

#### [NEW] `backend/app/memory/memory_writer.py`
- MemoryWriter class that receives task_input, output, evaluation, feedback
- Decides whether to write a durable memory entry
- Writes concise structured memories with metadata (type, importance, source, timestamp)
- Types: user_preference, project_context, successful_strategy, failed_strategy, useful_fact, recurring_instruction

#### [MODIFY] `backend/app/api/routes.py`
- Remove `mode` field from chat endpoint — always use Manager graph
- Update `/agents` POST to accept full AgentConfig fields (name, description, system_prompt, skills, tools, model, memory_enabled)
- Add `/skills` GET endpoint
- Add `/memory` GET endpoint

#### [NEW] `backend/skills/` directory with SKILL.md files
```
backend/skills/
  research/SKILL.md
  coding/SKILL.md
  data_analysis/SKILL.md
  pdf/SKILL.md
```

---

### Frontend

#### [MODIFY] `frontend/index.html`
- **Logo**: Replace SVG lightning bolt with a new "M" letter mark logo (playful, premium)
- **Remove**: `[Chat | Cowork]` segmented toggle
- **Remove**: Audio wave button box after mic symbol (keep mic button itself)
- **Remove**: Green status dot or simplify WS badge
- **Agent creation drawer**: Expand `hire-drawer` to include: Name, Description, System Prompt (textarea), Skills (tags), Tools (checkboxes), Model (select), Memory toggle
- **Add**: Small "+" option button in Agents section list item for the new agent creation
- Update initial assistant message to remove reference to Chat/Cowork

#### [MODIFY] `frontend/style.css`
- Add styles for expanded agent creation form
- Add logo mark styles (`.brand-mark-m`)
- Remove `.mode-segmented-toggle` styles
- Update capsule toolbar (remove wave-bars box)

#### [MODIFY] `frontend/src/main.js`
- Remove `setMode()` / cowork references
- Remove audio wave button handler
- All messages go through single `/chat` endpoint (always uses Manager)
- Update agent creation form to send full config
- Add slash command handling for `/skills`, `/models`, `/agents`, `/tools`, `/memory`, `/status`

#### [MODIFY] `frontend/src/office/canvas.js`
- **Server Room overhaul**: Replace 4 simple black rectangles with realistic rack servers
  - Full-height rack cabinets with brushed metal panels
  - Rack unit slots with blinking status LEDs (green=active, amber=warning, red=alert)
  - Cable trays between racks
  - A side wall-mounted patch panel / KVM terminal
  - Cooling fan grill detail at top/bottom of each rack
  - Floor cable management strips
  - Overhead cable tray
  - This makes it look like a real datacenter, matching the style of other rooms

---

## Execution Trace in UI

Instead of "Chat" vs "Cowork", show a compact execution trace in the chat bubble:
```
Manager
  → retrieving memory
  → Researcher (web search)
  → Analyst (calculations)
  → Synthesis
  → ✓ Complete
```

---

## Agent Creation UI

When user clicks "+" or "Add Agent" in the Agents section:
- Opens a full-panel drawer with:
  - **Name** (text input)
  - **Description** (text area — also used to auto-generate prompt via AI)
  - **System Prompt** (auto-generated, editable)
  - **Skills** (tag editor)
  - **Tools** (checkboxes for: calculator, python_runner, browser, form_filler, file_reader)
  - **Model** (select)
  - **Memory** (toggle)
- Small logo animation shown during agent creation (playful "M" mark spinning/morphing)

---

## New Logo

Replace the lightning bolt SVG with a custom "M" mark:
- Style: Geometric, bold, premium
- Two overlapping circles forming an "M"-like shape
- Matches the user's image reference (two white dots on dark background = playful, minimal)
- Used consistently: header, agent creation screen, loading states

---

## Verification Plan

### Manual
1. Start server: `uvicorn backend.app.main:app --reload`
2. Open browser, verify:
   - New logo visible in header
   - No Chat/Cowork toggle visible
   - Mic button present, wave bars box gone
   - Server room shows realistic rack servers
   - Sending a message routes through unified Manager path
   - Agent creation drawer has full form fields
3. Test `/skills` slash command in chat
4. Test creating an agent with name/description/prompt

### Backend
- Verify graph executes: `manager → execute → verify → memory_writer → END`
- Verify memory_writer creates structured memory entries
- Verify `/skills` endpoint returns skill list

---

## Open Questions

> [!IMPORTANT]
> **Logo**: The user shared an image showing two white circles on dark background. Should the "M" be:
> - Two overlapping dots (minimalist, like the image)
> - A geometric "M" letterform
> - Something else entirely?
> The plan uses the two-dot style as default (matching the image).

> [!NOTE]
> **Voice (Whisper)**: This plan does NOT include Whisper voice transcription in this pass — the existing browser speech recognition remains. Whisper local transcription would require a significant Python dependency (whisper/openai-whisper) and a separate audio capture pipeline. Recommend doing this as a follow-up.

> [!NOTE]
> **Chroma vector DB**: The plan does NOT swap out the SQLite experience store for Chroma in this pass. The MemoryWriter is added on top of the existing SQLite store (structured memory entries with type/importance metadata). Chroma integration is a follow-up item.

> [!NOTE]
> **Scheduler**: Morning briefing scheduler is NOT in this pass. The plan focuses on core architecture simplification first.
