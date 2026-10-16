# Jev Office: Architecture Research & Technology Specifications

**Document Version:** 1.0.0  
**Date:** October 2026  
**Status:** Complete (Phase 0 Deliverable)  
**Author:** Jev Office Agent Architecture Team  

---

## 1. Executive Summary & Verification Sources

This research document grounds the architecture of **Jev Office**, a local-first multi-agent assistant backend engineered for Python 3.12+, FastAPI, LangGraph, and TypeSafe AI's Jev decision model, adapted to the existing 2D pixel-art office dashboard.

### Verified Primary Sources & Endpoints
1. **TypeSafe AI Official Documentation & API**:
   - Web: `https://docs.typesafe.ai` (append `.md` for raw markdown spec)
   - Core API Endpoint: `POST https://api.typesafe.ai/v1/systemone`
   - Model Alias: `jev-latest`
   - Python SDK: `typesafe-sdk` (`pip install typesafe-sdk`, import via `typesafe_sdk`)
   - Alternative Free Gateways:
     - Vercel AI Gateway: `typesafe-ai/jev` (`@ai-sdk/typesafe-ai`)
     - Cloudflare Workers AI: `typesafe/jev`
   - Distinction: Distinct from OpenRouter's `typesafe/jev-router` (a community router proxy).
2. **Nous Research Hermes Agent & OpenClaw**:
   - Hermes Agent Repository & Documentation (`nousresearch.com`, `agentskills.io` standard)
   - OpenClaw Architecture Specification (`openclaw.ai`, gateway and subagent execution policies)
3. **Current Stable Package Ecosystem**:
   - `langgraph`: `1.2.15+` (StateGraph, conditional edges, SQLite/MemorySaver checkpointing)
   - `fastapi`: `0.115.10+` & `uvicorn`: `0.34.0+` (WebSocket and SSE support)
   - `pydantic`: `2.10.6+` (v2 core schemas, strict validation)
   - `litellm`: `1.84.0+` (Universal OpenAI-compatible proxy; pins past compromised versions `1.82.7`/`1.82.8`)
   - `chromadb`: `1.5.9+` (Vector store with persistent disk SQLite backend)
   - `playwright`: `1.50.0+` (Async browser automation)
   - `typesafe-sdk`: `0.7.5+` (Official TypeSafe System One client, verified live from PyPI)

---

## 2. Deep Dive: Jev by TypeSafe AI (System One Decision Model)

### 2.1 Nature: System One vs. Generative LLMs
Jev is **not a text-generating LLM**. It implements Kahneman-style "System 1" cognition: instant, intuitive, typed classifications calculated in a single forward pass without autoregressive token generation.
- **Latency**: 40ms–120ms typical response time (vs. 800ms–3000ms for LLM function calling).
- **Determinism**: Evaluates raw context (`state`) against typed questions, outputting discrete labels, scales, and calibrated probabilities.

### 2.2 Question Primitives
Jev accepts three core primitive question types:
1. **`choice`**: Discrete categorization among bounded options.
   - Inputs: `instructions`, `criteria` (mapping of option keys to definitions).
   - Outputs: `choice` (top option key), `probabilities` (full distribution dictionary), and `confidence` float `[0.0, 1.0]`.
2. **`score`**: Continuous or ordinal scale rating.
   - Inputs: `instructions`, `criteria` (ordered list of anchors).
   - Outputs: `score` (weighted numerical value), `probabilities`, and `confidence`.
3. **`noul`**: Calibrated boolean probability of a factual or logical condition being true.
   - Inputs: `instructions`.
   - Outputs: `noul` (calibrated float probability between `0.0` and `1.0`).

### 2.3 Wire Protocol (`POST /v1/systemone`)

#### Request Payload:
```json
{
  "model": "jev-latest",
  "state": {
    "user_message": "Can you check the latest SEC 10-K filing for Apple and summarize cash flows?",
    "active_agents": ["Alex (Coder)", "Nova (Researcher)", "Rio (Analyst)"],
    "tools_available": ["browser", "filesystem", "calculator", "terminal"]
  },
  "questions": {
    "route": {
      "type": "choice",
      "instructions": "Determine the optimal execution path for this user request.",
      "criteria": {
        "DIRECT": "Single-turn conversational response or direct memory query requiring no external tools or multi-step execution",
        "TOOL": "Atomic, single-tool execution (e.g. simple calculator or standalone shell command)",
        "MANAGER": "Multi-step research, browsing, code generation, verification, or multi-agent orchestration"
      }
    },
    "complexity": {
      "type": "score",
      "instructions": "Rate the technical and operational complexity of this task.",
      "criteria": ["Trivial / Conversational", "Moderate / Single Tool", "Complex / Multi-Step Workflow"]
    },
    "needs_tools": {
      "type": "noul",
      "instructions": "Does completing this request require external tools like browser, shell, or file access?"
    },
    "needs_multistep": {
      "type": "noul",
      "instructions": "Does completing this request require a plan with multiple dependent steps or peer evaluation?"
    }
  }
}
```

#### Response Payload:
```json
{
  "model": "jev-latest",
  "answers": {
    "route": {
      "type": "choice",
      "choice": "MANAGER",
      "probabilities": {
        "DIRECT": 0.04,
        "TOOL": 0.11,
        "MANAGER": 0.85
      },
      "confidence": 0.85
    },
    "complexity": {
      "type": "score",
      "score": 2.2,
      "probabilities": {
        "0": 0.05,
        "1": 0.15,
        "2": 0.80
      },
      "confidence": 0.80
    },
    "needs_tools": {
      "type": "noul",
      "noul": 0.94
    },
    "needs_multistep": {
      "type": "noul",
      "noul": 0.88
    }
  },
  "usage": {
    "input_tokens": 142,
    "output_tokens": 28
  }
}
```

### 2.4 Pydantic Routing Schema & Decider Interface
```python
from pydantic import BaseModel, Field
from typing import Literal, List, Dict

class RoutingDecision(BaseModel):
    route: Literal["DIRECT", "TOOL", "MANAGER"]
    confidence: float = Field(ge=0.0, le=1.0)
    intent: str
    complexity_score: float = Field(default=0.0)
    needs_tools: bool = False
    needs_multistep: bool = False
    required_tools: List[str] = Field(default_factory=list)
    suggested_agents: List[str] = Field(default_factory=list)
    raw_probabilities: Dict[str, float] = Field(default_factory=dict)
```

**Escalation Rule**: If `route == "DIRECT"` but `confidence < 0.70`, escalate to `TOOL`. If `route == "TOOL"` and `needs_multistep` probability > 0.50 or confidence < 0.70, escalate to `MANAGER`.

---

## 3. Architecture Lessons from Hermes Agent & OpenClaw

### 3.1 Bounded Memory & Context Compression (Hermes Agent)
- **Principle**: Dumping conversational history blindly degrades reasoning and spikes costs.
- **Implementation**:
  - Keep active LangGraph working state ephemeral.
  - Store episodic summaries (Task Episodes) with objective, tool inputs/outputs, and evaluator outcome.
  - Semantic memory in ChromaDB is indexed by embedded summary, querying only top-K (k=3) relevant experiences.

### 3.2 Memory "Nudges"
- Rather than inserting entire dialogs, inject targeted 1-line constraints derived from prior user feedback or failure modes into the system prompt:
  ```markdown
  [RECALLED PREFERENCE]: User prefers concise markdown tables without preamble.
  [PAST PITFALL]: When scraping Yahoo Finance, rely on Playwright waiting for selector '.table-loaded'.
  ```

### 3.3 Skill Auto-Generation & Catalog Loading (Hermes / agentskills.io)
- **Trajectory Mining**: After a Manager workflow completes with score > 0.85, the trajectory evaluator inspects if novel tool choreography was executed.
- **Skill File Standard**: Saved under `skills/<skill_name>/SKILL.md` with YAML frontmatter:
  ```markdown
  ---
  name: SEC Filings Extraction
  description: Autonomous procedure for downloading and parsing 10-K filings using Playwright
  version: 1.0.0
  required_tools: [browser, filesystem]
  tags: [finance, research]
  ---
  # SEC Filings Extraction Procedure
  ...
  ```
- **Progressive Disclosure**: Agents receive only the name and description in system prompts. The full markdown procedure is loaded into context only when the agent decides to invoke that skill.

### 3.4 Subagent Execution & Gateway Security (OpenClaw)
- **Coordinator-Subagent Hierarchy**: Manager Jordan acts as coordinator. Subagents (temporary specialists) receive an isolated task state, execute inside scoped tool boundaries, and return a typed final report. Subagents cannot communicate peer-to-peer without coordinator routing.
- **Permission Gating Modes**:
  - `allow`: Safe read-only tools (calculator, read file in workspace).
  - `ask`: Dangerous commands (shell commands matching `rm`, `pip install`, destructive write outside workspace).
  - Emits `PERMISSION_REQUESTED` event over WebSocket; halts task until `/api/tasks/{id}/approve` or WS confirmation is received.

---

## 4. Technology Stack & API Stability (2026 Verified)

| Technology | Verified Version | Stability Notes & Usage Pattern |
| :--- | :--- | :--- |
| **Python** | `3.12+` | Asyncio native, modern typing annotations. |
| **FastAPI** | `0.115.10+` | Native async route handlers, WebSocket support, lifespan context manager. |
| **Uvicorn** | `0.34.0+` | ASGI web server with WebSocket protocol support. |
| **Pydantic** | `2.10.6+` | V2 syntax (`model_validate`, `model_dump`, typed Field constraints). |
| **LangGraph** | `1.2.15+` | StateGraph, SQLiteSaver / MemorySaver checkpoints, conditional routing edges. |
| **LiteLLM** | `1.84.0+` | Provider-agnostic client (OpenAI, Ollama, OpenRouter, Groq). Pins >=1.84.0 for security. |
| **ChromaDB** | `1.5.9+` | Local vector storage (`PersistentClient(path="./vault/chroma")`). |
| **Playwright** | `1.50.0+` | Python async API (`async_playwright()`), Chromium headless automation. |
| **TypeSafe SDK** | `0.4.x+` | `typesafe-sdk`, `TypeSafeClient`, `Choice`, `Score`, `Noul`. |
| **Obsidian Vault** | Local Files | Plain `.md` files + YAML frontmatter + `[[wikilinks]]` in `vault/`. |

---

## 5. Existing Frontend Contract Analysis & Reconciliation

### 5.1 Frontend Architecture (`frontend/src/`)
- Pure client-side HTML5 Canvas, modern Vanilla JS modules, and CSS.
- **WebSocket Route**: `ws://<host>:<port>/api/ws/events`.
- **REST Endpoints Expected**:
  - `POST /api/chat`: Dispatch message, returns `{ task_id, reply? }`.
  - `GET /api/tasks/{id}`: Fetch task details, evaluation score, and result.
  - `GET /api/agents`: Returns list of `AgentConfig`.
  - `GET /api/organization/state`: Returns agents count, tasks completed, active task metrics.
  - `GET /api/skills`: Returns loaded skills.
  - `GET /api/experiences`: Returns distilled organizational memory.
  - `POST /api/feedback`: Records 1–5 star rating and comment.
  - `GET /api/llm/config` & `POST /api/llm/config`: LLM model configuration.

### 5.2 Event Contract Reconciliation
Detailed event specifications are codified in [docs/EVENTS.md](file:///d:/youtube/agenoffice/docs/EVENTS.md). The backend event bus will emit uppercase event types (`TASK_CREATED`, `AGENT_ASSIGNED`, `AGENT_WORKING`, `EVALUATION_COMPLETED`, `TASK_COMPLETED`, etc.) to trigger the 2D office character animations, speech bubbles, and HUD updates seamlessly.

---

## 6. Assumptions Disproven or Clarified During Research

1. **Jev Output Format (`Noul`)**:
   - *Prompt Assumption*: "It returns typed Choice / Score / Noul (boolean) answers with probabilities."
   - *Clarification*: The `noul` primitive in TypeSafe's API returns a calibrated float probability `0.0 <= noul <= 1.0` (e.g. `{"type": "noul", "noul": 0.88}`), not a plain boolean literal. The application code applies a threshold (e.g., `>= 0.5`) to convert this into a boolean flag while preserving the underlying confidence metric.
2. **Frontend Event Transport Protocol**:
   - *Prompt Assumption*: "FastAPI (/api/chat, /api/tasks, /api/events via SSE or WebSocket)".
   - *Clarification*: The existing frontend code in `frontend/src/main.js` connects strictly via **WebSocket** (`ws://${host}/api/ws/events`), not SSE. We will provide the required WebSocket endpoint first, and add an SSE endpoint (`/api/events`) as an auxiliary feed for CLI consumers.
3. **Event Naming Convention**:
   - *Prompt Assumption*: Suggested lowercase event names (`task_started`, `agent_status`, etc.).
   - *Clarification*: The existing 2D frontend's event listener switch-case checks for uppercase enum strings: `TASK_CREATED`, `AGENT_ASSIGNED`, `AGENT_WORKING`, `EVALUATION_COMPLETED`, `EXPERIENCE_CREATED`, `TASK_COMPLETED`. Emitting uppercase types ensures immediate, full visual fidelity in the office animation without modifying the user's frontend.
4. **LiteLLM Supply Chain Advisory**:
   - *Verification*: Versions `1.82.7` and `1.82.8` experienced a security incident in late March 2026. `litellm` must be pinned to `>= 1.84.0`.

---

## 7. Pinned Dependency List (`backend/requirements.txt`)

```text
# Web Framework & Server
fastapi>=0.115.10
uvicorn[standard]>=0.34.0
websockets>=13.1
pydantic>=2.10.6
pydantic-settings>=2.7.1
python-multipart>=0.0.20

# Decision Intelligence & Routing
typesafe-sdk>=0.7.5
httpx>=0.28.1

# Agent Graph & LLM Orchestration
langgraph>=1.2.15
langgraph-checkpoint>=2.0.16
langchain-core>=0.3.35
litellm>=1.84.0

# Vector Memory & Document Processing
chromadb>=1.5.9
sentence-transformers>=3.4.1

# Automation & Tools
playwright>=1.50.0
beautifulsoup4>=4.13.3
pyyaml>=6.0.2
pillow>=11.1.0

# Testing
pytest>=8.3.4
pytest-asyncio>=0.25.3
```

---

## 8. 10-Line Summary of Architectural Decisions

1. **Jev-First Routing**: Every incoming user prompt is first evaluated by a fast System One `Decider` (TypeSafe API or LLM structured output fallback).
2. **Three-Way Branching**: The decider classifies intent into `DIRECT` (conversational/quick reply), `TOOL` (single tool execution), or `MANAGER` (multi-step LangGraph workflow).
3. **Graceful Degradation**: If `TYPESAFE_API_KEY` is missing or times out, the system automatically falls back to `LLMDecider` using structured JSON output from LiteLLM.
4. **Confidence Escalation**: Low confidence routing (< 0.70) automatically escalates along the safety hierarchy (`DIRECT` → `TOOL` → `MANAGER`).
5. **Config-Driven Agents**: Permanent agents are defined in pure YAML files under `backend/app/agents/config/`, allowing zero-code agent additions.
6. **Isolated Temporary Specialists**: When workforce skills are missing, dynamic temporary agents are spawned with specialized prompts and auto-archived upon task completion.
7. **Safe Tool Sandboxing**: Terminal and filesystem tools are strictly confined to `workspaces/sandbox/`, requiring explicit approval events for high-risk operations.
8. **Hermes-Style Progressive Skills**: Procedures are saved as versioned markdown files with YAML frontmatter, loaded into agent context only on demand.
9. **Two-Tier Persistent Memory**: Semantic retrieval via ChromaDB paired with a human-auditable plain markdown Obsidian vault in `vault/`.
10. **Native WebSocket Streaming**: Central async event bus dispatches typed JSON event envelopes to synchronize the 2D office canvas, speech bubbles, and HUD metrics.
