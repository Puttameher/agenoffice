# Reuse Log

Every capability evaluated from DeepSeek Harness core and community plugins is logged here prior to building custom implementations.

## Evaluations

### 1. Agent Loop & Coordination
- **Candidate**: DeepSeek Harness Core (`@deepseek-ai/dsh-agent`, `@deepseek-ai/dsh-agent-loop`)
- **Status**: **REUSED**
- **Evaluation**: Provides robust turn/step cycle, model request assembly, streaming, failure handling, and session logging out of the box. No custom loop needed.

### 2. Guarded Tool Execution Pipeline
- **Candidate**: DeepSeek Harness Tools Seam (`@deepseek-ai/dsh-tools`, `@deepseek-ai/dsh-user-approval`, `@deepseek-ai/dsh-tool-pwsh`, `@deepseek-ai/dsh-tool-fs`)
- **Status**: **REUSED**
- **Evaluation**: Complete `tools/pre-execute` -> `tools/execute` -> `tools/post-execute` pipeline with user approval gating, sandbox policies, and structured schema generation.

### 3. Subagents & Delegation
- **Candidate**: DeepSeek Harness Subagent Providers (`@deepseek-ai/dsh-subagent`, `@deepseek-ai/dsh-subagent-spawn-in-process`, `@deepseek-ai/dsh-tool-subagent`)
- **Status**: **REUSED**
- **Evaluation**: Supports one-shot agents with `outputSchema`, `toolFilter`, `persona`, and continuable children sessions with interrupt/follow-up lifecycles.

### 4. Browser Automation
- **Candidate**: Playwright via `@deepseek-ai/dsh-mcp-client` & dedicated Chromium runner
- **Status**: **REUSED / ADOPTED**
- **Evaluation**: Headless Chromium with persistent profile under `data/browser_profile` provides clean, reliable DOM interaction and screenshot capture. Dropped legacy Selenium.

### 5. Memory Seam
- **Candidate**: `dsh-memento` SQLite WAL pattern + Chroma vector store + Obsidian vault
- **Status**: **HYBRID (REUSED PATTERN + BUILT PLUGIN)**
- **Evaluation**: Adopted the typed `ctx.memory` lifecycle from `dsh-memento` for session state, backed by our `office-memory` multi-store engine (Chroma embeddings, SQLite FTS5, and local markdown vault).

### 6. Router & System One Decisions
- **Candidate**: TypeSafe Jev (`@typesafe-ai/sdk`) with DeepSeek LLM fallback
- **Status**: **BUILT PLUGIN (`office-router`)**
- **Evaluation**: Nothing in dsh core handles calibrated System One confidence routing. Built thin plugin wrapping `DecisionBackend`.

### 7. Office Event Pipeline
- **Candidate**: Mapping dsh `session/event`, `agent/*`, `tools/*` to `OfficeEvent`
- **Status**: **BUILT PLUGIN (`office-events`)**
- **Evaluation**: Reuses dsh's internal event hooks, serializes them through an Event Processor to SSE/WebSocket matching the frontend contract.
