# Architecture Decisions & Log

## Architecture Summary (Restated from docs/architecture.png in 10 lines)
1. **User Ingestion**: Multimodal user inputs (chat text, voice, files, images/screenshots) enter the system through the unified backend gateway.
2. **Jev Classification**: Requests pass through the TypeSafe Jev decision model to produce calibrated, schema-constrained routing decisions (DIRECT, TOOL, or MANAGER).
3. **Direct Flow**: Conversational and simple requests bypass heavy planning, executing via the primary LLM with compressed context and personal memory RAG.
4. **Tool Flow**: Single-tool requests invoke the guarded tool execution pipeline with permission checks and structured I/O validation.
5. **Manager Flow**: Complex tasks run under a top-level Manager agent using continuous subagent delegation and one-shot verification with bounded retries.
6. **Agent Roster**: Persistent visible office employees (Manager, Researcher, Coder, Browser, Knowledge) handle domain roles, supplemented by ephemeral task-specific subagents.
7. **Tooling & Skills**: Native filesystem, terminal, clipboard, screenshot, and Playwright browser tools execute beside dynamic, reusable SKILL.md procedures.
8. **Real-Time Pipeline**: Agent lifecycles and tool calls stream through an Event Bus and Event Processor into SSE/WebSocket streams for live UI projection.
9. **Dual-Loop Memory**: Task episodes undergo LLM compression and Jev triage (ignore, retain memory, or promote skill) across Chroma vector search, an Obsidian-style markdown vault, and SQLite FTS.
10. **2D Office Visualization**: The frontend office dashboard displays real-time agent status, animated web activities, metrics, and task boards driven by backend contracts.

---

## Decision 001: Platform Foundation (DeepSeek Harness / TypeScript over Python/LangGraph)
- **Status**: ACCEPTED (Non-negotiable)
- **Context**: The previous implementation attempted to build an agent loop, event broker, session replay, subagent coordination, and sandbox approvals in Python/FastAPI/LangGraph, leading to high architectural overhead.
- **Decision**: We build entirely on DeepSeek Harness (`dsh`) on Node.js/TypeScript using Cordis plugin architecture.
- **Rationale**: `dsh` already provides the agent loop, session log, tool execution pipeline, sandbox/approvals, continuable and one-shot subagents, model adapters, and plugin mounting. Our work focuses strictly on our core differentiators: office roster, Jev router, office event contract, task state tracking, and memory/learning pipeline.
- **Selenium Scope**: Browser automation is implemented exclusively via Chromium/Playwright; Selenium is deemed a legacy non-goal and dropped from active implementation.
