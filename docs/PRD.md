# 🏢 Product Requirements Document (PRD) — Agentic AI Office
## Version 2.0.0 — Comprehensive Autonomous Multi-Agent Workforce Platform

---

## 📑 Table of Contents
1. [Executive Summary & Product Vision](#1-executive-summary--product-vision)
2. [System Architecture & Topology](#2-system-architecture--topology)
3. [Complete Feature Catalog](#3-complete-feature-catalog)
   - 3.1. Claude-Style Interactive Chat & Cowork Capsule
   - 3.2. 3-Way Intent Router (Chat vs Tool vs Agent Swarm)
   - 3.3. 2D Pixel-Art Office Simulation Canvas (1366×680)
   - 3.4. Character Pathfinding, Idle Roaming & Relaxation Hubs
   - 3.5. LangGraph Cyclic Multi-Agent Workflow Engine
   - 3.6. Workforce Management, NL Hiring & Temporary Specialists
   - 3.7. Agent Gamification: XP, Levels & Badge Progression
   - 3.8. Isolated Task-Scoped Workspace Sandboxes
   - 3.9. Safe Execution Tool Registry (8 Production Tools)
   - 3.10. Dual-Layer Memory: Machine Experiences + Obsidian Vault Knowledge
   - 3.11. Agentic RAG (Retrieval-Augmented Generation)
   - 3.12. Automated Evaluator, Bounded Retries & Human Feedback
   - 3.13. Multi-Provider LLM Gateway & Runtime Model Switcher
   - 3.14. Real-Time Telemetry, Token Accounting & Cost Engine
   - 3.15. Web Audio Sound Engine & Day/Night Lighting Cycle
   - 3.16. Skills Subsystem (`SKILL.md` Repository)
4. [End-to-End System Flows](#4-end-to-end-system-flows)
   - 4.1. Flow 1: Direct Fast Chat (Bypasses Task Board)
   - 4.2. Flow 2: Standalone Fast Tool Execution
   - 4.3. Flow 3: Autonomous Cowork Multi-Agent Swarm
   - 4.4. Flow 4: Natural Language Agent Hiring
   - 4.5. Flow 5: On-Demand Temporary Specialist Spawn & Archival
   - 4.6. Flow 6: Automated Evaluation, Rubric Scoring & Bounded Retries
   - 4.7. Flow 7: Obsidian Vault Markdown Knowledge Synthesis
   - 4.8. Flow 8: Tea Break Organizational Context Reflection
5. [Codebase Architecture & Function Catalog](#5-codebase-architecture--function-catalog)
   - 5.1. Data Models & Schemas (`backend/app/models/schemas.py`)
   - 5.2. Database & Repository Layer (`backend/app/database/`)
   - 5.3. Real-Time Event Bus (`backend/app/events/event_bus.py`)
   - 5.4. Intent Classifier & 3-Way Router (`backend/app/orchestration/`)
   - 5.5. LangGraph Cyclic Workflow & State (`backend/app/orchestration/`)
   - 5.6. Task Workspace Isolation (`backend/app/orchestration/workspace.py`)
   - 5.7. Safe Tool Registry & Implementations (`backend/app/tools/`)
   - 5.8. Memory & Dual-Layer Knowledge Writers (`backend/app/memory/`)
   - 5.9. Obsidian Markdown Vault Integration (`backend/app/tools/obsidian_tool.py`)
   - 5.10. Evaluator & Quality Assurance (`backend/app/evaluation/`)
   - 5.11. Universal LLM Gateway & Fallback Simulator (`backend/app/llm.py`)
   - 5.12. REST API & WebSocket Controller (`backend/app/api/`)
   - 5.13. Frontend Application Controller (`frontend/src/main.js`)
   - 5.14. 2D Office Canvas Renderer (`frontend/src/office/canvas.js`)
   - 5.15. Character Animations & Sprites (`frontend/src/office/characters.js`)
   - 5.16. A* Grid Pathfinding Engine (`frontend/src/office/pathfinder.js`)
   - 5.17. Office Manager & Event Synchronization (`frontend/src/office/officeManager.js`)
   - 5.18. Web Audio Sound Engine (`frontend/src/office/sound.js`)
6. [REST API Specification](#6-rest-api-specification)
7. [The 16 Strictly Typed Backend Events](#7-the-16-strictly-typed-backend-events)
8. [Database Schema & Persistence Structure](#8-database-schema--persistence-structure)
9. [Automated Verification & Test Suite](#9-automated-verification--test-suite)

---

## 1. Executive Summary & Product Vision

### 1.1 Purpose
The **Agentic AI Office** is a local-first, production-grade autonomous multi-agent company simulation and workspace. It elevates multi-agent systems from obscure terminal logs into a vibrant, visual, and highly transparent virtual workplace.

Users interact with an AI organization led by **Manager Jordan (CEO / Orchestrator)** and an active roster of permanent and temporary specialist agents. Every operation—from fast conversational answers to multi-step software development in isolated sandboxes—is reflected visually in real time on a 2D pixel-art office canvas.

### 1.2 Core Pillars
1. **Visual Grounding**: 16 strictly typed backend events power character animations, pathfinding, desk seating, speech bubbles, sound effects, and kanban board updates.
2. **Intelligent 3-Way Routing**: User queries are analyzed to select the most efficient execution path:
   - `CHAT`: Instant zero-overhead response directly from Manager Jordan.
   - `TOOL`: Synchronous execution of a single utility (e.g. calculator, time, weather).
   - `AGENT`: Full LangGraph multi-agent orchestration with planning, workspace execution, code generation, and automated evaluation.
3. **Dual-Layer Memory**:
   - *Machine Memory*: Experience Bank of distilled strategies, lessons, and metrics injected into future agent prompts.
   - *Human Knowledge*: Bi-directional Obsidian Markdown vault notes with frontmatter, tags, and wiki-links.
4. **Isolated Task Sandboxing**: Every autonomous coding task receives an isolated workspace directory (`workspaces/task_<id>/`), complete with path traversal protection, file generation, test execution, and download APIs.
5. **Universal Provider Flexibility**: Zero-cost offline fallback simulator alongside live integrations for OpenAI (GPT-4o, GPT-4o-mini), OpenRouter (Hermes 3 70B, Llama 3.3 70B), Ollama, and DeepSeek.

---

## 2. System Architecture & Topology

![Agentic AI Office Architecture](assets/architecture.png)
*Figure 1. Target high-level architecture. The office UI is the observable surface; the personal agent core performs the work.*

```mermaid
graph TD
    User([👤 User]) -->|Prompt / Dictation| Frontend[Frontend UI & Canvas]
    
    subgraph Presentation [Presentation Layer (HTML5 / Vanilla JS / Canvas)]
        Frontend -->|Input| Capsule[Claude-Style Floating Capsule]
        Capsule -->|Mode: Chat / Cowork| APIDispatch[API Dispatcher]
        Canvas[2D Office Canvas (1366x680)]
        Pathfinding[A* Pathfinder & Relaxation Spots]
        WSClient[WebSocket Event Stream]
    end

    subgraph BackendServer [FastAPI Application Server]
        APIDispatch --> Routes[FastAPI Routes: /api/chat, /api/tasks, /api/agents]
        Routes --> Router[3-Way Intent Router (Chat | Tool | Agent)]
        
        Router -->|CHAT| DirectChat[Manager Jordan Direct LLM]
        Router -->|TOOL| FastTool[Single Tool Invocation]
        Router -->|AGENT| LangGraph[LangGraph StateGraph Engine]
        
        EventBus[Central Event Bus (16 Typed Events)] --> WSManager[WebSocket Manager]
        WSManager -->|Real-Time Broadcast| WSClient
        
        subgraph GraphEngine [LangGraph Cyclic Orchestration]
            START --> OrchestratorNode[1. Orchestrator: Manager Jordan]
            OrchestratorNode -->|Needs Obsidian| ObsidianNode[2. Obsidian Vault Retrieval]
            OrchestratorNode -->|Needs Company Docs| RAGNode[3. Agentic Vector RAG]
            OrchestratorNode -->|Direct Execution| AgentNode[4. Generic Agent Engine]
            ObsidianNode --> AgentNode
            RAGNode --> AgentNode
            AgentNode --> EvalNode[5. Automated Evaluator]
            EvalNode -->|Score < 0.70 & Retries < 2| AgentNode
            EvalNode -->|Success or Max Retries| ExpNode[6. Experience & Archival Node]
            ExpNode --> END
        end

        subgraph ToolSandbox [Tool Registry & Workspaces]
            ToolRegistry[Tool Registry (8 Tools)]
            Workspaces[workspaces/task_id/ Filesystem]
        end

        subgraph KnowledgeLayers [Dual Memory & Persistence]
            SQLite[(SQLite Database: office.db)]
            ObsidianVault[Obsidian Vault (.md Files)]
        end
    end

    DirectChat --> EventBus
    FastTool --> EventBus
    LangGraph --> ToolSandbox
    LangGraph --> KnowledgeLayers
    LangGraph --> EventBus
    WSClient --> Canvas
```

---

## 3. Complete Feature Catalog

### 3.1. Claude-Style Interactive Chat & Cowork Capsule
- **Dual Mode Switcher**:
  - `Chat Mode`: Instant conversation with Manager Jordan. Perfect for inquiries, project ideation, and explanations.
  - `Cowork Mode`: Explicit dispatch to the autonomous LangGraph multi-agent office swarm.
- **Model Selector Pill**: Direct indicator displaying active model (`GPT-4o`, `Hermes 3 70B`, `Simulated Fallback`). Clicking opens the runtime LLM configuration modal.
- **Voice Dictation Microphone**: Built-in speech-to-text using Web Speech API (`webkitSpeechRecognition`) with visual pulse animation and auto-dispatch.
- **Slash Commands Palette**: Typing `/` triggers a quick-skill menu (`/python`, `/calc`, `/rag`, `/hire`, `/teabreak`, `/meeting`, `/status`, `/clear`, `/model`).
- **Dock Positioning**: One-click toggling between left-dock and right-dock screen alignments.

### 3.2. 3-Way Intent Router (Chat vs Tool vs Agent Swarm)
- Evaluates user messages using a lightweight LLM classifier (with regex heuristic fallback):
  - `CHAT`: Greetings, general questions, explanations. Emits `DIRECT_CHAT_MESSAGE` and returns immediately without polluting the task board.
  - `TOOL`: Single-shot mathematical calculations, time, or weather lookups. Executes synchronously and returns natural LLM-wrapped output.
  - `AGENT`: Coding, multi-step research, refactoring, building projects. Generates a formal `TaskResponse` and triggers the LangGraph execution engine.
- Continuation Detection: Understands phrases like *"go on"*, *"continue"*, *"build it"*, *"proceed"* to advance previous conversational plans into autonomous code execution.

### 3.3. 2D Pixel-Art Office Simulation Canvas (1366×680)
- **High-Definition Canvas Layout**:
  - **CEO Suite (Top Center)**: Executive mahogany desk for Manager Jordan (Desk 0), leather chair, gold nameplate, and meeting staging area.
  - **Open Floor Workspace (Center)**: 6 permanent employee workstations equipped with mahogany desks, desktop monitors, LED indicators, and employee nameplates:
    - *Desk 1*: Alex (Coding Agent)
    - *Desk 2*: Nova (Research Agent)
    - *Desk 3*: Rio (Analysis Agent)
    - *Desk 4*: Mika (Content Agent)
    - *Desk 5*: Zane (Design Agent)
    - *Desk 6*: Taro (Operations Agent)
  - **Server Room / Datacenter (Top Right)**: 3 glowing server racks with animated LED telemetry lights.
  - **Lounge & Break Hub (Top Left)**: Coffee counter, espresso bar, water cooler, velvet couch with **Pixel the Cat**, foosball table, pinball machine, chess table, and arcade cabinet.
  - **Tea Break Lounge & Context Synthesizer (Middle Right)**: Artisan tea & samovar bar, vector context distillation core.
  - **Visual Task Board (Bottom Left)**: Live Kanban board rendered directly onto the canvas displaying active, queued, and completed jobs.
  - **Courtyard Garden (Bottom Right)**: Sakura cherry blossom trees, stone zen fountain, oak garden benches.
  - **Office Entrance (Bottom Center)**: Reception doorway where new hires and temporary specialists arrive and depart.

### 3.4. Character Pathfinding, Idle Roaming & Relaxation Hubs
- **A\* Grid Pathfinder (`pathfinder.js`)**: Real-time obstacle-avoidance routing preventing characters from walking through desks, walls, or props.
- **Sprite Animation Engine (`characters.js`)**: 4-frame directional walk cycles (up, down, left, right), typing animations, speech bubbles, and name badges.
- **Idle Roaming & Relaxation System**: When idle, agents autonomously roam between 12 relaxation spots:
  - Lounging on the couch with Pixel the cat
  - Playing foosball or retro pinball
  - Contemplating chess moves
  - Brewing fresh espresso
  - Sitting under the sakura trees in the garden
  - Strolling by the zen fountain

### 3.5. LangGraph Cyclic Multi-Agent Workflow Engine
- **State-Driven Workflow (`AgentOfficeState`)**:
  1. `orchestrator_node`: Manager Jordan assesses roster capability, matches specialists, checks if Obsidian notes or RAG docs are needed, and queries the Experience Bank.
  2. `obsidian_node`: Retrieves user notes, project context, and backlinks from local Obsidian Markdown vault.
  3. `rag_node`: Vector similarity search against corporate handbook and technical documentation.
  4. `agent_execution_node`: The assigned agent walks to Manager Jordan for briefing, returns to desk, executes tools, creates workspace files, and generates output.
  5. `evaluation_node`: Evaluates solution against original prompt, scoring completeness and correctness (0.0 to 1.0).
  6. `experience_node`: Distills organizational strategy and lessons learned into the Experience Bank, updates agent XP, and archives temporary agents.
- **Bounded Self-Correction Loop**: If evaluation score is < 0.70 and retries < 2, state loops back to `agent_execution_node` with concrete feedback.

### 3.6. Workforce Management, NL Hiring & Temporary Specialists
- **Natural Language Agent Hiring**: Create agents via prompt (e.g., *"Hire Maya, an ML Specialist proficient in PyTorch and scikit-learn"*). Parses skills, assigns tools, allocates an open desk, and persists to SQLite.
- **Dynamic Temporary Specialists**: When incoming tasks demand skills outside the existing workforce (e.g., Clinical Trials, Quantum Cryptography), Manager Jordan spawns an on-demand temporary agent (e.g., `temp_agent_clinical`), who walks in, solves the problem, and is archived upon completion.

### 3.7. Agent Gamification: XP, Levels & Badge Progression
- Agents gain Experience Points (XP) upon completing tasks:
  - **+150 XP** awarded to the primary assigned agent.
  - **+100 XP** awarded to collaborating peer agents.
- Automatic Leveling: Agents level up every 500 XP.
- Achievements & Badges: Tracked in `AgentConfig.badges` (e.g., *"Code Ninja"*, *"Master Architect"*, *"Bug Hunter"*).

### 3.8. Isolated Task-Scoped Workspace Sandboxes
- Every task execution receives a dedicated filesystem workspace under `workspaces/task_<id>/`.
- **Path Traversal Protection**: Enforces containment within workspace root, blocking unauthorized system access (`PermissionError`).
- **File Management**: Create scripts, read file trees, inspect directory contents, and download outputs via dedicated REST endpoints (`/api/tasks/{task_id}/workspace`).

### 3.9. Safe Execution Tool Registry (8 Production Tools)
1. **`calculator`**: Safe AST-evaluated arithmetic eliminating code injection.
2. **`python_runner`**: AST-parsed restricted Python sandbox with captured stdout.
3. **`browser`**: Safe HTTP scraper and web content reader.
4. **`form_filler`**: Automated web form simulator.
5. **`laptop_file_reader`**: Local workspace document reader.
6. **`workspace_writer`**: Scoped file generator writing code directly into `workspaces/task_<id>/`.
7. **`sandbox`**: Subprocess runner executing code, running unit tests, and capturing stdout/stderr within the task workspace.
8. **`obsidian`**: File-based Obsidian Markdown vault manager.

### 3.10. Dual-Layer Memory: Machine Experiences + Obsidian Vault Knowledge
- **Tier 1 (Ephemeral Task State)**: Stored in LangGraph `AgentOfficeState` during execution.
- **Tier 2 (Persistent Agent Memory)**: Key-value notes and preferences stored in SQLite `agent_memories`.
- **Tier 3 (Organizational Experience Bank)**: Machine-readable distilled learnings (`task_summary`, `strategy`, `what_worked`, `what_failed`, `lesson`) queried by the orchestrator for future tasks.
- **Human Knowledge Layer (Obsidian Vault)**:
  - Real Markdown files saved in the user's local Obsidian vault (`OBSIDIAN_VAULT_PATH`).
  - Includes YAML frontmatter, tags (`#agentic-office`), wikilinks (`[[topic]]`), and structured action points.
  - Bi-directional: agents read Obsidian notes during task planning and save completed solutions directly to the vault.

### 3.11. Agentic RAG (Retrieval-Augmented Generation)
- Autonomous retrieval decision (`need_rag: bool`) made by Manager Jordan.
- In-memory vector store using tokenization, length-normalized term overlap, and cosine similarity.
- Pre-seeded with corporate policies, coding conventions, architectural standards, and security guidelines.

### 3.12. Automated Evaluator, Bounded Retries & Human Feedback
- Automated Evaluator returns `success: bool`, `score: float` (0.0 to 1.0), and `reason: str`.
- Human Feedback: 1–5 star ratings and qualitative comments saved in SQLite. Feedback directly enriches future experience retrieval without requiring model fine-tuning.

### 3.13. Multi-Provider LLM Gateway & Runtime Model Switcher
- Universal provider catalog supporting:
  - **OpenAI**: GPT-4o, GPT-4o-mini
  - **OpenRouter**: Hermes 3 70B, Llama 3.3 70B, Claude 3.5 Sonnet
  - **Ollama**: Local models (`http://localhost:11434/v1`)
  - **DeepSeek**: DeepSeek Chat & Coder
  - **Intelligent Fallback Simulator**: Deterministic offline simulation requiring zero API keys.
- Runtime model switching via UI pill or `/api/llm/switch-model` without restarting the server.

### 3.14. Real-Time Telemetry, Token Accounting & Cost Engine
- Measures prompt tokens, completion tokens, latency (ms), and estimated cost ($USD).
- Real-time aggregation available through `/api/organization/state`.

### 3.15. Web Audio Sound Engine & Day/Night Lighting Cycle
- Procedural oscillator synthesis via browser Web Audio API:
  - Soft interface clicks, footsteps during walking, keyboard typing clicks, task launch chimes, success melodies, and error buzzers.
- Day/Night lighting cycle with warm ambient overlays.

### 3.16. Skills Subsystem (`SKILL.md` Repository)
- Scans `backend/skills/` for modular capability folders containing `SKILL.md`.
- Exposed via `/api/skills` for UI discovery.

---

## 4. End-to-End System Flows

### 4.1. Flow 1: Direct Fast Chat (Bypasses Task Board)
```
User Enters Message (Mode = "chat" or Router classifies as CHAT)
  ↓
POST /api/chat
  ↓
Router identifies CHAT intent (e.g. "What is LangGraph?")
  ↓
Dynamic System Prompt assembled with active workforce + experiences
  ↓
Calls llm_generate() directly
  ↓
Emits DIRECT_CHAT_MESSAGE event
  ↓
Frontend displays reply immediately in chat capsule (Zero Task Board clutter)
```

### 4.2. Flow 2: Standalone Fast Tool Execution
```
User Enters Expression (e.g. "calculate 45 * 12 + 89")
  ↓
POST /api/chat
  ↓
Router identifies TOOL intent (tool: "calculator")
  ↓
ToolRegistry executes CalculatorTool synchronously via AST
  ↓
Result optionally wrapped in concise natural LLM sentence
  ↓
Emits DIRECT_CHAT_MESSAGE with Tool badge
  ↓
Instant UI response returned without long polling
```

### 4.3. Flow 3: Autonomous Cowork Multi-Agent Swarm
```
User Submits Project (e.g. "Build a Python CLI password generator with tests")
  ↓
POST /api/chat (Mode = "cowork" or Router classifies as AGENT)
  ↓
Creates Task record in SQLite (status: "pending") & emits TASK_CREATED
  ↓
Dispatches BackgroundTask: run_task_in_graph
  ↓
[Node 1: orchestrator_node (Manager Jordan)]
  ├─ Inspects workforce & assigns Alex (Coding Agent)
  ├─ Binds task workspace: workspaces/task_<id>/
  ├─ Checks if Obsidian notes or RAG docs are required
  └─ Emits AGENT_ASSIGNED
  ↓
[Node 2 or 3: obsidian_node / rag_node] (If flagged)
  └─ Attaches relevant documentation context to state
  ↓
[Node 4: agent_execution_node]
  ├─ Character walks to Manager desk for briefing, then returns to Desk 1
  ├─ Emits AGENT_STARTED & AGENT_WORKING (typing animation)
  ├─ Executes tools: workspace_writer, sandbox
  ├─ Generates files (e.g. generator.py, test_generator.py) in workspaces/task_<id>/
  ├─ Runs tests inside workspace sandbox and captures results
  └─ Emits AGENT_COMPLETED
  ↓
[Node 5: evaluation_node]
  ├─ Evaluator LLM scores output against requirements
  └─ Emits EVALUATION_COMPLETED
  ↓
[Node 6: experience_node]
  ├─ Distills organizational lessons and saves ExperienceRecord to SQLite
  ├─ Awards +150 XP to Alex (triggers level check)
  ├─ Emits EXPERIENCE_CREATED & TASK_COMPLETED
  └─ Saves completed Task record with token/cost/artifact telemetry
  ↓
WebSocket updates Frontend:
  ├─ Chat displays clean result summary & workspace file list
  ├─ Artifact Studio renders generated code and briefing
  └─ Task Board marks task Completed
```

### 4.4. Flow 4: Natural Language Agent Hiring
```
User enters hiring prompt (e.g. "Hire Liam, a Security Auditor")
  ↓
POST /api/agents
  ↓
AgentFactory calls LLM to extract role, skills, instructions, tools
  ↓
Finds first open desk (Desks 1–6)
  ↓
Persists AgentConfig to SQLite & emits AGENT_CREATED
  ↓
Frontend spawns new Character sprite at office entrance
  ↓
Character walks from doorway to assigned desk and sits down
```

### 4.5. Flow 5: On-Demand Temporary Specialist Spawn & Archival
```
Task requires unrepresented skill (e.g. "Bioinformatics sequence alignment")
  ↓
Orchestrator detects no matching permanent agent
  ↓
AgentFactory creates temporary agent (permanent=False, status="temporary")
  ↓
Emits AGENT_CREATED; specialist walks into office
  ↓
Specialist executes task in workspace and passes evaluation
  ↓
Experience Node detects is_temporary_agent == True
  ↓
Updates status to "archived" in SQLite & emits AGENT_ARCHIVED
  ↓
Specialist character waves goodbye and departs through entrance doorway
```

### 4.6. Flow 6: Automated Evaluation, Rubric Scoring & Bounded Retries
```
Agent Execution Node finishes output
  ↓
Evaluator runs rubric: completeness, code correctness, test execution
  ↓
Score >= 0.70?
  ├── YES ──> Proceeds to Experience Node (Completion)
  └── NO  ──> Retries < MAX_RETRIES (2)?
                ├── YES ──> Injects critique into state, increments retries,
                │           and loops back to Agent Execution Node
                └── NO  ──> Saves completion with evaluation warning
```

### 4.7. Flow 7: Obsidian Vault Markdown Knowledge Synthesis
```
User clicks "Save to Knowledge" on completed task
  ↓
POST /api/knowledge/save
  ↓
MemoryWriter formats Markdown note:
  ├─ YAML frontmatter (title, date, tags, agent, model)
  ├─ Executive summary & technical solution
  └─ Distilled takeaways & backlinks ([[topic]])
  ↓
Writes file to OBSIDIAN_VAULT_PATH/<Title>.md
  ↓
Also writes machine-readable experience to SQLite
  ↓
Available immediately in Obsidian desktop app and future agent lookups
```

### 4.8. Flow 8: Tea Break Organizational Context Reflection
```
User clicks Coffee Counter or Samovar Bar in Tea Break Lounge
  ↓
GET /api/context/current fetches recent tasks and experiences
  ↓
User enters reflection notes and clicks "Synthesize Context"
  ↓
POST /api/context/summarize
  ↓
ExperienceService distills organizational workflow patterns
  ↓
Saves ExperienceRecord to SQLite & emits EXPERIENCE_CREATED
  ↓
Future task orchestrations now benefit from this synthesized knowledge
```

---

## 5. Codebase Architecture & Function Catalog

### 5.1. Data Models & Schemas ([backend/app/models/schemas.py](file:///d:/youtube/agenoffice/backend/app/models/schemas.py))
- `AgentConfig`: Agent entity definition (`id`, `name`, `role`, `description`, `instructions`, `system_prompt`, `model`, `skills`, `tools`, `permanent`, `memory_enabled`, `status`, `desk_id`, `level`, `xp`, `badges`, `tasks_completed`, `created_at`).
- `AgentCreatePromptRequest`: Flexible hire request supporting raw prompt or explicit overrides.
- `AgentUpdateRequest`: Partial updates for agent configuration.
- `TaskCreateRequest` & `TaskResponse`: Task entity with `assigned_agent_id`, `collaborating_agent_id`, `status`, `result`, `retries`, `tokens_used`, `latency_ms`, `cost_usd`, and `artifacts`.
- `TaskEvaluation`: Evaluation result schema (`id`, `task_id`, `success`, `score`, `reason`, `evaluated_at`).
- `FeedbackCreateRequest` & `FeedbackResponse`: User star ratings (1–5) and commentary.
- `ExperienceRecord`: Distilled organizational knowledge record (`id`, `task_summary`, `strategy`, `what_worked`, `what_failed`, `lesson`, `feedback`, `created_at`).
- `OfficeEvent`: Real-time event container (`id`, `event_type`, `agent_id`, `task_id`, `timestamp`, `metadata`).
- `OrganizationState`: Complete organizational snapshot with manager, active agents, tasks, events, and telemetry.

### 5.2. Database & Repository Layer ([backend/app/database/](file:///d:/youtube/agenoffice/backend/app/database/))
- **`db.py`**:
  - `get_db_connection()`: Returns thread-safe SQLite connection with dictionary row access.
  - `init_db()`: Initializes tables (`agents`, `tasks`, `evaluations`, `feedback`, `experiences`, `agent_memories`, `events`) and seeds default workforce.
- **`repository.py` (`Repository`)**:
  - `save_agent(agent)` / `get_agent(agent_id)` / `list_agents(include_archived)`: Agent persistence.
  - `update_agent_status(agent_id, status)`: Update agent working state.
  - `award_agent_xp(agent_id, xp_amount)`: Increments agent XP and handles level progression.
  - `save_task(task)` / `get_task(task_id)` / `list_tasks(limit, exclude_system)`: Task persistence.
  - `save_evaluation(eval_record)`: Stores rubric evaluations.
  - `save_feedback(feedback)`: Stores user star ratings.
  - `save_experience(exp)` / `list_experiences(limit)`: Experience Bank operations.
  - `save_agent_memory(agent_id, key, content)` / `get_agent_memories(agent_id)`: Agent personal notes.
  - `save_event(event)` / `get_events_for_task(task_id)` / `get_recent_events(limit)`: Real-time event audit log.
  - `get_office_telemetry()`: Computes total tokens, cost ($USD), and average latency across all runs.

### 5.3. Real-Time Event Bus ([backend/app/events/event_bus.py](file:///d:/youtube/agenoffice/backend/app/events/event_bus.py))
- `EventBus`:
  - `subscribe(callback)` / `unsubscribe(callback)`: Registers WebSocket stream listeners.
  - `emit(event_type, agent_id, task_id, metadata)`: Persists event to SQLite and broadcasts payload to all connected clients.

### 5.4. Intent Classifier & 3-Way Router ([backend/app/orchestration/](file:///d:/youtube/agenoffice/backend/app/orchestration/))
- **`intent.py`**:
  - `classify_intent(text)`: Classifies into 9 task categories (`answer`, `explain`, `build`, `modify`, `execute`, `research`, `analyze`, `automate`, `create_artifact`).
  - `is_continuation(text)`: Detects continuation signals ("continue", "go on", "build it").
  - `is_action(text)`: Identifies if prompt requires external code execution.
- **`router.py`**:
  - `classify_route(user_message)`: Uses fast LLM classification (with heuristic fallback) returning `RouteDecision(route, tool, reason, confidence)`.
- **`system_prompt.py`**:
  - `build_system_prompt(agents, experiences)`: Assembles Manager Jordan's dynamic system prompt.
  - `build_chat_prompt(user_message, system_prompt)`: Assembles chat prompts.

### 5.5. LangGraph Cyclic Workflow & State ([backend/app/orchestration/](file:///d:/youtube/agenoffice/backend/app/orchestration/))
- **`state.py`**:
  - `AgentOfficeState`: Typed state container holding execution variables across graph nodes.
- **`graph.py`**:
  - `orchestrator_node`: Manager Jordan routing and specialist assignment.
  - `obsidian_retrieval_node`: Markdown vault note lookups.
  - `rag_retrieval_node`: Vector database documentation queries.
  - `agent_execution_node`: Primary agent execution with tool calling.
  - `evaluation_node`: Solution quality scoring.
  - `experience_node`: Learnings distillation, agent archival, and XP distribution.
  - `create_office_graph()`: Compiles LangGraph `StateGraph`.

### 5.6. Task Workspace Isolation ([backend/app/orchestration/workspace.py](file:///d:/youtube/agenoffice/backend/app/orchestration/workspace.py))
- `WorkspaceManager`:
  - `path(filename)`: Path traversal-safe resolution inside `workspaces/task_<id>/`.
  - `write_file(filename, content)`: Creates or updates workspace files.
  - `read_file(filename)`: Reads file content.
  - `list_files()`: Lists all files inside workspace directory.
  - `run_python(filename)`: Executes Python scripts inside isolated workspace.
  - `run_command(cmd)`: Runs shell commands within workspace root.
  - `run_tests(target)`: Executes unit tests and captures stdout/stderr.

### 5.7. Safe Tool Registry & Implementations ([backend/app/tools/](file:///d:/youtube/agenoffice/backend/app/tools/))
- `CalculatorTool`: AST-parsed mathematical expression evaluator.
- `PythonRunnerTool`: AST-restricted in-process Python sandbox.
- `BrowserTool`: URL fetching and text extraction.
- `FormFillerTool`: Simulated web form submission.
- `LaptopFileReaderTool`: Local file reading.
- `WorkspaceWriterTool`: Scoped workspace file writer.
- `SandboxTool`: Workspace command and test runner.
- `ToolRegistry`: Unified registry with `register()`, `get()`, `list_tools()`, `execute()`, and `bind_workspace()`.

### 5.8. Memory & Dual-Layer Knowledge Writers ([backend/app/memory/](file:///d:/youtube/agenoffice/backend/app/memory/))
- **`memory_store.py` (`MemoryStore`)**:
  - `get_relevant_experiences(query, limit)`: Similarity ranking against historical experiences.
  - `get_agent_memory_notes(agent_id)`: Retrieves agent-specific notes.
- **`memory_writer.py` (`MemoryWriter`)**:
  - `save_to_knowledge(task_input, agent_output)`: Writes dual memory—machine lesson to SQLite and clean Markdown note with frontmatter to the Obsidian vault.

### 5.9. Obsidian Markdown Vault Integration ([backend/app/tools/obsidian_tool.py](file:///d:/youtube/agenoffice/backend/app/tools/obsidian_tool.py))
- `ObsidianTool`:
  - `search_notes(query)`: Case-insensitive vault full-text search.
  - `read_note(title)`: Reads note content.
  - `create_note(title, content)`: Creates new Markdown note.
  - `update_note(title, content)`: Replaces existing note content.
  - `append_note(title, text)`: Appends text to existing note.
  - `find_related(title)`: Identifies related notes via wikilinks (`[[...]]`).

### 5.10. Evaluator & Quality Assurance ([backend/app/evaluation/evaluator.py](file:///d:/youtube/agenoffice/backend/app/evaluation/evaluator.py))
- `Evaluator`:
  - `evaluate_task_result(task_id, user_input, agent_output)`: Evaluates agent output, scores solution (0.0 to 1.0), and stores record in database.

### 5.11. Universal LLM Gateway & Fallback Simulator ([backend/app/llm.py](file:///d:/youtube/agenoffice/backend/app/llm.py))
- `LLMConfig`: Configuration state manager for model, provider, API key, and base URL.
- `PROVIDER_CATALOG`: Registry of supported models across OpenAI, OpenRouter, Ollama, and DeepSeek.
- `SimulatedLLM`: Intelligent offline fallback simulator providing realistic agent responses without API keys.
- `llm_generate(prompt, model_name)`: Unified dispatch to active LLM or simulator.
- `test_llm_connection()`: Connectivity testing endpoint.

### 5.12. REST API & WebSocket Controller ([backend/app/api/](file:///d:/youtube/agenoffice/backend/app/api/))
- **`routes.py`**: Full FastAPI REST controller implementing all system endpoints.
- **`websocket.py` (`WebSocketManager`)**: Manages real-time client connections and broadcasts `OfficeEvent` payloads.

### 5.13. Frontend Application Controller ([frontend/src/main.js](file:///d:/youtube/agenoffice/frontend/src/main.js))
- Orchestrates UI state, Chat vs Cowork mode switcher, voice dictation, slash commands, LLM modal, task dispatching, and WebSocket reconnection.

### 5.14. 2D Office Canvas Renderer ([frontend/src/office/canvas.js](file:///d:/youtube/agenoffice/frontend/src/office/canvas.js))
- Renders the 1366×680 pixel-art office: parquet floor, CEO suite, 6 workstations, lounge, tea break room, task board, courtyard garden, server racks, and day/night lighting.

### 5.15. Character Animations & Sprites ([frontend/src/office/characters.js](file:///d:/youtube/agenoffice/frontend/src/office/characters.js))
- Renders pixel-art character sprites, directional walking animations, typing states, and speech bubbles.

### 5.16. A\* Grid Pathfinding Engine ([frontend/src/office/pathfinder.js](file:///d:/youtube/agenoffice/frontend/src/office/pathfinder.js))
- Implements A* grid pathfinding with waypoint smoothing, avoiding furniture obstacles.

### 5.17. Office Manager & Event Synchronization ([frontend/src/office/officeManager.js](file:///d:/youtube/agenoffice/frontend/src/office/officeManager.js))
- Translates backend WebSocket events (`AGENT_ASSIGNED`, `AGENT_WORKING`, `TASK_COMPLETED`, etc.) into character movements and visual cues.

### 5.18. Web Audio Sound Engine ([frontend/src/office/sound.js](file:///d:/youtube/agenoffice/frontend/src/office/sound.js))
- Synthesizes audio using browser Web Audio oscillators (clicks, footsteps, typing, chimes, success melodies, and error tones).

---

## 6. REST API Specification

| Method | Endpoint | Description | Request Body | Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/chat` | Unified chat & router dispatch | `{"message": str, "mode"?: str, "model_name"?: str}` | Chat reply or Dispatched task info |
| `POST` | `/api/tasks` | Direct task dispatch to LangGraph | `{"user_input": str, "assigned_agent_id"?: str}` | `TaskResponse` |
| `GET` | `/api/tasks/{task_id}` | Fetch task details and status | None | `TaskResponse` |
| `GET` | `/api/tasks/{task_id}/events` | Fetch all backend audit events for task | None | `List[OfficeEvent]` |
| `GET` | `/api/tasks/{task_id}/workspace`| List files in task's isolated workspace | None | `{"workspace_path": str, "files": list}` |
| `GET` | `/api/tasks/{task_id}/workspace/{file}` | Download/preview workspace file | None | Plain text file content |
| `POST` | `/api/agents` | Hire agent via natural language prompt | `{"prompt": str, "name"?: str, "tools"?: list}` | `AgentConfig` |
| `GET` | `/api/agents` | List active workforce agents | None | `List[AgentConfig]` |
| `GET` | `/api/agents/{agent_id}` | Get single agent profile | None | `AgentConfig` |
| `PATCH`| `/api/agents/{agent_id}` | Update agent configuration | `AgentUpdateRequest` | `AgentConfig` |
| `DELETE`| `/api/agents/{agent_id}`| Archive agent | None | `{"message": str}` |
| `POST` | `/api/feedback` | Submit human star rating (1–5) | `{"task_id": str, "rating": int, "comment": str}`| `FeedbackResponse` |
| `GET` | `/api/organization/state` | Fetch office metrics, tasks & telemetry | None | `OrganizationState` |
| `GET` | `/api/experiences` | List past organizational lessons | None | `List[ExperienceRecord]` |
| `GET` | `/api/memory` | Fetch machine-readable memory lessons | None | `{"memory": list, "count": int}` |
| `GET` | `/api/skills` | List available skills in repository | None | `{"skills": list, "count": int}` |
| `GET` | `/api/context/current` | Preview active context for Tea Break | None | Context summary dict |
| `POST` | `/api/context/summarize` | Synthesize Tea Break reflection | `{"notes"?: str, "room"?: str}` | `ExperienceRecord` |
| `POST` | `/api/meeting/sync` | Trigger War Room strategy session | `{"topic"?: str}` | `{"status": "ok"}` |
| `GET` | `/api/knowledge/status` | Check Obsidian vault connectivity | None | `{"configured": bool, "vault_path": str}` |
| `GET` | `/api/knowledge/search` | Full-text search Obsidian vault | Query param: `query=...` | `{"results": str}` |
| `POST` | `/api/knowledge/save` | Save task result as Obsidian note | `{"user_input": str, "agent_output": str}` | `{"status": "ok", "note_path": str}` |
| `GET` | `/api/llm/config` | Get active model config & presets | None | `LLMConfig` dict |
| `GET` | `/api/llm/models` | List available models by provider | None | Model catalog dict |
| `POST` | `/api/llm/switch-model` | Instant model switch | `{"model_id": str, "provider"?: str}` | `LLMConfig` dict |
| `POST` | `/api/llm/config` | Update API keys & endpoints | `LLMUpdatePayload` | `LLMConfig` dict |
| `POST` | `/api/llm/test` | Test live provider connectivity | `LLMUpdatePayload` | `{"status": "ok"\|"error"}` |
| `WS` | `/ws/events` | Real-time WebSocket event stream | None | Bidirectional JSON event stream |

---

## 7. The 16 Strictly Typed Backend Events

| # | Event Name | Source Node / Component | Visual & System Effect |
| :--- | :--- | :--- | :--- |
| 1 | `TASK_CREATED` | API Routes | Task added to database; HUD task counter increments; card appears on Task Board. |
| 2 | `AGENT_ASSIGNED` | Orchestrator Node | Assigned agent character leaves desk and walks to Manager Jordan for briefing. |
| 3 | `AGENT_STARTED` | Execution Node | Agent returns to workstation and sits down to analyze requirements. |
| 4 | `AGENT_WORKING` | Execution Node | Agent displays typing animation; status pill turns yellow. |
| 5 | `AGENT_RETRIEVING` | RAG Node / Obsidian Node | Retrieval badge illuminates; agent displays document query speech bubble. |
| 6 | `AGENT_COMPLETED` | Execution Node | Agent completes execution and submits result payload. |
| 7 | `EVALUATION_COMPLETED`| Evaluator Node | Evaluation score badge and rationale appear in execution feed. |
| 8 | `FEEDBACK_RECEIVED` | Feedback Route | Human star rating saved to SQLite; feedback badge updates. |
| 9 | `EXPERIENCE_CREATED` | Experience Node / Context | Distilled lesson saved to Experience Bank; EXP counter increments. |
| 10 | `AGENT_CREATED` | Agent Factory | New character sprite walks into office from entrance doorway and takes assigned desk. |
| 11 | `AGENT_ARCHIVED` | Factory / Exp Node | Temporary agent waves goodbye and departs through entrance doorway. |
| 12 | `TASK_COMPLETED` | Experience Node / Tools | Task marked complete; success chime plays; result rendered in UI and Task Board. |
| 13 | `TASK_FAILED` | Graph Exception | Error buzzer plays; task marked failed with failure explanation. |
| 14 | `DIRECT_CHAT_MESSAGE`| Chat / Tool Handler | Instant conversational response displayed in chat stream (bypasses Task Board). |
| 15 | `LLM_CONFIG_UPDATED` | LLM Controller | Active model indicator pill updates across UI. |
| 16 | `ROUTE_DECIDED` | 3-Way Intent Router | Internal telemetry event logging classification decision (`CHAT`, `TOOL`, or `AGENT`). |

---

## 8. Database Schema & Persistence Structure

Database: SQLite (`backend/app/database/office.db`).

```sql
-- 1. Agents Table
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    description TEXT,
    instructions TEXT,
    system_prompt TEXT,
    model TEXT,
    skills TEXT,                 -- JSON array of skill strings
    tools TEXT,                  -- JSON array of tool names
    permanent INTEGER DEFAULT 1,
    memory_enabled INTEGER DEFAULT 1,
    status TEXT DEFAULT 'idle',
    desk_id INTEGER DEFAULT 1,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    badges TEXT DEFAULT '[]',    -- JSON array of badge strings
    tasks_completed INTEGER DEFAULT 0,
    created_at TEXT
);

-- 2. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_input TEXT NOT NULL,
    assigned_agent_id TEXT,
    collaborating_agent_id TEXT,
    status TEXT NOT NULL,
    result TEXT,
    retries INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    latency_ms REAL DEFAULT 0.0,
    cost_usd REAL DEFAULT 0.0,
    artifacts TEXT,              -- JSON object
    created_at TEXT,
    completed_at TEXT
);

-- 3. Automated Evaluations Table
CREATE TABLE IF NOT EXISTS evaluations (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    success INTEGER NOT NULL,
    score REAL NOT NULL,
    reason TEXT,
    evaluated_at TEXT
);

-- 4. Human Feedback Table
CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    rating INTEGER NOT NULL,     -- 1 to 5 stars
    comment TEXT,
    created_at TEXT
);

-- 5. Organizational Experience Bank Table
CREATE TABLE IF NOT EXISTS experiences (
    id TEXT PRIMARY KEY,
    task_summary TEXT NOT NULL,
    strategy TEXT,
    what_worked TEXT,
    what_failed TEXT,
    lesson TEXT NOT NULL,
    feedback TEXT,
    created_at TEXT
);

-- 6. Agent Memory Notes Table
CREATE TABLE IF NOT EXISTS agent_memories (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    key TEXT NOT NULL,
    content TEXT NOT NULL,
    updated_at TEXT
);

-- 7. Real-Time Audit Events Table
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    agent_id TEXT,
    task_id TEXT,
    timestamp TEXT NOT NULL,
    metadata TEXT                -- JSON object
);
```

---

## 9. Automated Verification & Test Suite

The system includes a comprehensive pytest suite covering all backend subsystems:
- **`backend/tests/test_agents.py`**: Agent instantiation, system prompts, and tool binding.
- **`backend/tests/test_tools.py`**: AST safe calculator evaluation and Python sandboxing.
- **`backend/tests/test_graph.py`**: LangGraph execution cycle, bounded retries, and state transitions.
- **`backend/tests/test_rag.py`**: Vector store retrieval accuracy and document ranking.
- **`backend/tests/test_api.py`**: FastAPI routes, chat routing, and event streaming.

Run the test suite with:
```bash
pytest backend/tests
```

---
*Document Version: 2.0.0 — Comprehensive Product Requirements & Architecture Specification for Agentic AI Office.*
