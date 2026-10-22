# What We Reused vs What We Built

A transparent manifest mapping each architectural requirement to the reused DeepSeek Harness component or custom plugin.

## Reused from DeepSeek Harness (`dsh`)

| Component / Capability | Harness Package / Seam | Role in Office Agent |
|---|---|---|
| **Plugin Framework** | `@deepseek-ai/cordis` | Kernel providing service dependency injection, event hooks, and effect lifecycle unwinding |
| **Agent Loop** | `@deepseek-ai/dsh-agent-loop` | Drives turns, steps, model requests, and assistant streams |
| **Session Logging** | `@deepseek-ai/dsh-session`, `@deepseek-ai/dsh-session-persistence-jsonl` | Append-only durable event log and session replay |
| **Tool Pipeline** | `@deepseek-ai/dsh-tools`, `@deepseek-ai/dsh-user-approval` | Scoped tool registration, schema projection, execution guards, and user approval gates |
| **Subagents** | `@deepseek-ai/dsh-subagent`, `@deepseek-ai/dsh-subagent-spawn-in-process` | Continuable child sessions and schema-constrained one-shot subagents |
| **Model Adapters** | `@deepseek-ai/dsh-llm`, `@deepseek-ai/dsh-llm-deepseek` | Model invocation, streaming, retry, and token metering |
| **Filesystem & Shell** | `@deepseek-ai/dsh-fs-local`, `@deepseek-ai/dsh-tool-pwsh` | Local workspace operations and powershell command execution |
| **MCP Integration** | `@deepseek-ai/dsh-mcp-client` | Standard MCP tool server integration |

---

## Built by Us (Thin Office Plugins)

| Plugin Name | Location | Architectural Responsibility |
|---|---|---|
| **`office-gateway`** | `plugins/office-gateway/` | Express/HTTP + SSE endpoint contract (`/api/chat`, `/api/events`, `/api/tasks`, `/api/agents`, `/api/metrics`, `/api/skills`, `/api/memory`) |
| **`office-events`** | `plugins/office-events/` | Bridges dsh internal lifecycle events into formatted, sanitized `OfficeEvent` stream with SQLite persistence |
| **`office-router`** | `plugins/office-router/` | TypeSafe Jev System One decision engine with DeepSeek LLM fallback, confidence gating, and shadow mode |
| **`office-roster`** | `plugins/office-roster/` | Manages 5 visible office employees (Manager, Research, Coding, Browser, Knowledge) as continuable subagents and handles visitor temporary agents |
| **`office-tasks`** | `plugins/office-tasks/` | Tracks durable TaskState, step decomposition, verification subagent checks, and bounded retries |
| **`office-tools`** | `plugins/office-tools/` | Clipboard, screenshot, and system tool capabilities with approval requirements |
| **`office-web`** | `plugins/office-web/` | Tracks browser/search activity, projects employee sprites to `working`/`idle`, and outputs structured research reports |
| **`office-memory`** | `plugins/office-memory/` | Episode grouping, LLM compression, Jev triage (ignore/memory/skill), Chroma + SQLite FTS5 + Obsidian vault stores |
| **`office-skills`** | `plugins/office-skills/` | Built-in SKILL.md procedures, learned skills staging, and execution safety vetting |
