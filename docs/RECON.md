# DeepSeek Harness (dsh) Reconnaissance & Verification Report

## Environment & Locked Versions
- **Operating System**: Windows 11 (win32 x64)
- **Node.js**: `v22.15.0`
- **npm**: `10.9.2`
- **pnpm**: `12.14.0` (global) / `11.28.5` (workspace lockfile)
- **DeepSeek Harness (`dsh`) Source**: `vendor/deepseek-harness`
- **Pinned dsh Version**: `0.2.1-rc.2`
- **Pinned Git SHA**: `687f282e8625c6b8d11ff58211a90524be2e4317`
- **TypeSafe SDK Version**: `@typesafe-ai/sdk@0.7.0` (pinned)

---

## 1. 13-Row Beliefs Verification Table

| # | Belief | Status | File Path & Code Evidence |
|---|---|---|---|
| 1 | Written in TypeScript, pnpm monorepo, powered by Cordis framework; "everything is a plugin" | **PASS** | `vendor/deepseek-harness/AGENTS.md:L1-3`, `docs/architecture.md:L7-12`, `pnpm-workspace.yaml` |
| 2 | Runs with `npx @deepseek-ai/dsh web` (Web UI at 127.0.0.1:3080) or from source (`pnpm install && pnpm dsh web`) | **PASS** | `vendor/deepseek-harness/README.md:L25-35`, `apps/cli/package.json:L14-16`, `packages/bundle/web-app/cordis.patch.yml` |
| 3 | Profile stacks bundles; patch file (`cordis.patch.yml`) replaces/inserts rows; `dsh --profile web --dump-config` prints tree | **PASS** | `vendor/deepseek-harness/docs/architecture.md:L13-40`, `apps/cli/src/dump-config.ts:L23-43`, `apps/cli/src/profile-boot.ts` |
| 4 | Extension points: `ctx.llm`, `ctx.tools`, `ctx.agents`, `ctx.subagents`, `ctx.sessions`, `ctx.jobs`, `ctx.goals`, `ctx.commands`, `ctx.fs`, `ctx.shell`, `ctx.terminals`, `ctx.sandbox` | **PASS** | `vendor/deepseek-harness/docs/architecture.md:L142-164` ("Where new behavior goes" table) |
| 5 | Durable facts are session events appended to log and broadcast on `session/event`; live hooks are `agent/*`, `tools/*`, `subagent/*` | **PASS** | `vendor/deepseek-harness/docs/architecture.md:L67-78`, `docs/event-producer-consumer.md`, `packages/core/session/src/events.ts` |
| 6 | "Model-visible means logged"; new durable state means extending `SessionEventMap` | **PASS** | `vendor/deepseek-harness/docs/architecture.md:L124`, `packages/core/session/src/events.ts:L45-80` |
| 7 | Subagents: providers `spawn`, `fork`, `acp`, `codex`, `claude-code`, `dsh-sdk`. One-shot runs accept `outputSchema`, `toolFilter`, `persona`, `maxDepth`. Continuable children are durable sessions | **PASS** | `vendor/deepseek-harness/docs/subsystems/subagent.md`, `packages/subagent/subagent-spawn-in-process` |
| 8 | Standard profile includes file editing, shell, file and web search, skills, planning, goals, subagents, workflows | **PASS** | `vendor/deepseek-harness/packages/bundle/base/cordis.patch.yml`, `packages/bundle/web-app/presets/standard.patch.yml` |
| 9 | Web UI can be extended with Chat nodes and client bundles; community UI plugins exist (task board, sidebar, HUD) | **PASS** | `vendor/deepseek-harness/docs/architecture.md:L157`, `docs/cookbook/extension-cookbook.md` |
| 10 | Community ecosystem: `dsh-memento` (typed `ctx.memory` with SQLite), `dsh-browser`, `dsh-continual-evolve`, search providers | **PASS** | Verified via npm registries, awesome-dsh indexes, and GitHub repositories |
| 11 | `dsh plugin --profile web add <package>` installs a plugin bundle | **PASS** | `vendor/deepseek-harness/apps/cli/src/plugin.ts:L30-80`, `docs/cli-help.md` |
| 12 | dsh ships an MCP client (`@deepseek-ai/dsh-mcp-client`) usable to mount MCP servers | **PASS** | `vendor/deepseek-harness/packages/mcp/client/package.json`, `docs/subsystems/mcp.md` |
| 13 | `SAFETY.md`: experimental preview, least privilege, VM/container recommended; sandboxing reduces but doesn't eliminate risk | **PASS** | `vendor/deepseek-harness/SAFETY.md:L1-45` |

---

## 2. LLM Adapters and Configuration
- **Native Adapters Available**:
  - `@deepseek-ai/dsh-llm-deepseek`: official DeepSeek chat completions API (`https://api.deepseek.com`). Reads `DEEPSEEK_API_KEY` and optional `DEEPSEEK_BASE_URL`.
  - `@deepseek-ai/dsh-llm-pi-ai`: multi-provider adapter supporting OpenAI-compatible endpoints (OpenRouter, Groq, Ollama) via standard endpoint/key configurations.
- **Office Setup**:
  - OpenRouter and Groq keys present in `.env`.
  - For our `office-agent` router and fallback LLM, we support direct TypeSafe Jev (`TYPESAFE_API_KEY` against `https://api.typesafe.ai/v1/systemone`) and an OpenAI-compatible fallback (`DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`, or `GROQ_API_KEY`).

---

## 3. Plugin Architecture & Declarations
- **Profile Declaration**: Stored under `$DSH_HOME/profiles/<name>/package.json` with schema:
  ```json
  {
    "name": "office-profile",
    "dsh": {
      "profile": {
        "bundles": [
          "@deepseek-ai/dsh-base",
          "@deepseek-ai/dsh-web-app",
          "office-bundle"
        ]
      }
    }
  }
  ```
- **Bundle Declaration**: Package declaring:
  ```json
  {
    "name": "office-bundle",
    "dsh": {
      "bundle": {
        "patch": ["./cordis.patch.yml"]
      }
    }
  }
  ```
- **Cordis Patch Format**: Uses standard YAML specifying either row replacements (by `id`) or row additions (`insert: [...]`).
- **HMR & Hot Reload**: Coordinated via `@deepseek-ai/dsh-hmr`. In development, file updates under registered roots trigger safe plugin reloads and disposer unwind cycles.

---

## 4. Community Plugin Survey & Reuse Log

| Category | Candidates | Vetted Status | Decision & Rationale |
|---|---|---|---|
| **Memory** | `dsh-memento`, `dsh-memory-evolve`, `memory-mcp-server` | `dsh-memento` provides clean typed `ctx.memory` SQLite WAL seam. | **ADOPT `dsh-memento` pattern** for the local SQLite seam; pair with Chroma client and Obsidian vault markdown structure. |
| **Browser** | `dsh-browser`, Playwright MCP, Browser-Use bridge | `dsh-browser` and Playwright MCP are vetted. | **ADOPT Playwright via MCP / native wrapper** with dedicated persistent profile under `data/browser_profile`. Drop Selenium. |
| **Web Search** | `@deepseek-ai/dsh-web-search-deepseek`, Tavily MCP, DuckDuckGo/Exa | `dsh-web-search-deepseek` / fetch tools in base. | **REUSE base web search** + fallback search provider via MCP/HTTP. |
| **Skills Evolution**| `dsh-continual-evolve`, Native SKILL.md store | `dsh-continual-evolve` validates trajectories via benchmark loop. | **REUSE SKILL.md schema**; manage learned corrections in `data/skills-learned/`. |

---

## 5. Windows vs Linux Strategy
- **File Paths**: Use Node `node:path` with forward slashes for URLs and standard path normalization for Windows drives (`C:\`, `D:\`).
- **Disk Storage Strategy**: System drive `C:` has limited space; set npm cache to `D:\npm-cache` and pnpm store to `D:\pnpm-store` to prevent `ENOSPC`.
- **Shell Tools**: On Windows, prioritize `powershell.exe` / `pwsh` (`@deepseek-ai/dsh-tool-pwsh`) over bash, with fallback to bash if git-bash / WSL is available.
- **Process Management**: Handle Windows-specific task killing (`taskkill /F /PID` or process signals) with graceful timeout guards.
