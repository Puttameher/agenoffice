# Learning Map

Plain explanations of DeepSeek Harness (`dsh`) core concepts for long-term maintainability and onboarding.

---

### 1. Cordis Plugin & Effect Lifecycle
- **Explanation**: Cordis is an inversion-of-control framework where features are plugins mounted to a shared context (`ctx`). Services and event listeners registered by a plugin are tracked as effects that automatically unwind and clean up when the plugin unloads.
- **Reference**: `vendor/deepseek-harness/docs/cordis-primer.md`

### 2. Profiles and Bundles
- **Explanation**: A profile is a named configuration layering bundle manifests (`package.json` -> `dsh.profile.bundles`) and patch files (`cordis.patch.yml`). Bundles provide declarative rows describing which plugins to mount, and profiles can override any row without modifying upstream code.
- **Reference**: `vendor/deepseek-harness/docs/architecture.md` (Profiles and bundles section)

### 3. Capability Seams
- **Explanation**: A seam is an abstract interface consisting of a Service Definition (declaring the contract), a Service Provider (the concrete implementation, e.g. SQLite or Chroma), and a Consumer (e.g. an agent tool). Swapping one provider changes behavior across the entire harness without code forks.
- **Reference**: `vendor/deepseek-harness/docs/capability-seams.md`

### 4. Session Event Log & Replay
- **Explanation**: All model-visible facts, turn states, and tool results are append-only serialized records in a session log (`SessionEvent`). System state can be reconstructed by reading historical events, allowing interruption recovery, forks, and consistent UI streaming.
- **Reference**: `vendor/deepseek-harness/docs/subsystems/session.md`

### 5. Guarded Tool Execution Pipeline
- **Explanation**: When the model invokes a tool, execution passes through serial hooks: `tools/pre-execute` (permission and sandbox verification), `tools/execute` (execution), and `tools/post-execute` (result formatting/redaction). High-risk actions can require explicit user confirmation.
- **Reference**: `vendor/deepseek-harness/docs/tool-execution-pipeline.md`

### 6. Subagents (Continuable vs One-Shot)
- **Explanation**: Subagents allow an agent to delegate work. One-shot subagents run with isolated personas and strict JSON schemas, disposing upon completion; continuable subagents maintain persistent child session logs and can receive follow-ups.
- **Reference**: `vendor/deepseek-harness/docs/subsystems/subagent.md`

### 7. TypeSafe Jev System One Decisions
- **Explanation**: A non-autoregressive decision model taking state and structured questions (Noul, Choice, Score) and returning schema-constrained labels with calibrated confidence. Used in our router and memory pipeline to avoid free-form hallucinations.
- **Reference**: `docs/RECON.md` and TypeSafe AI documentation (`docs.typesafe.ai`)

### 8. Cordis Strict vs Non-Strict Service Injection
- **Explanation**: By default, Cordis enforces strict dependency boundaries: a plugin cannot access property `ctx[name]` unless it is declared in its `inject` metadata. To conditionally consume an optional service without crashing if absent, plugins use `ctx.get(name, false)` which disables strict throwing and returns `undefined` when the service is not yet loaded.
- **Reference**: `vendor/deepseek-harness/vendor/cordis/src/reflect.ts`

### 9. Confidence Calibration & Safety Escalation
- **Explanation**: In high-reliability agent routing, raw probability outputs are binned into calibrated confidence thresholds. If confidence falls below the escalation boundary (< 0.70) or if a prompt triggers a safety rule (`risky_action === true`), the request automatically escalates to a higher supervisory layer (`MANAGER`) for human-in-the-loop oversight.
- **Reference**: `plugins/office-router/src/index.js` and `docs/CHECKPOINT.md`

### 10. Agent Workstation Allocation & Specialist Lifecycle
- **Explanation**: The 2D office representation models a physical spatial layout: a Manager Suite (Desk 0) and 6 Open Workstations (Desks 1-6). The 5 core employees permanently occupy Desks 0-4 and cannot be deleted. Dynamic visitor specialists hired for ad-hoc tasks claim open workstations (Desks 5 and 6) from a pool, transition through state lifecycles (`idle` -> `working` -> `reviewing`), accumulate XP/levels upon task completion, and release their desks back to the workstation pool when archived.
- **Reference**: `plugins/office-roster/src/index.js` and `frontend/src/office/officeManager.js`

### 11. Headless Browser Seam & Subprocess Sandboxing
- **Explanation**: Playwright automation binds directly to the OS browser channel (`msedge` on Windows, or `chromium`), bypassing external binary download dependencies. Tools run within guarded wrappers that enforce process timeouts, path traversal restrictions (`..` directory containment), and command blocklists. Tool lifecycle events (`tool.call`, `tool.result`) project directly into the unified event bus, linking execution back to the invoking agent and task ID.
- **Reference**: `plugins/office-tools/src/index.js` and `docs/CHECKPOINT.md`

### 12. Multi-Step Task State Machine & Quality Evaluation
- **Explanation**: Complex goals require systematic phase separation: `pending` -> `planning` -> `running` -> `evaluating` -> `completed`. Manager Jordan formulates a multi-step plan assigning domain roles (Coding, Research, Knowledge, Browser) and optional peer review collaboration. Atomic step outputs and latencies are recorded in SQLite (`office_task_steps`), followed by automated quality scoring and structured artifact extraction (executive summaries, code snippets, and analytical latency charts).
- **Reference**: `plugins/office-tasks/src/index.js` and `docs/CHECKPOINT.md`
