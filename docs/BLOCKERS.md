# Blockers & Anti-Stuck Protocol Log

If an identical failure occurs twice, stop immediately, log here with:
- Symptom
- Minimal reproduction
- Two hypotheses
- What was tried
- Smallest alternative

## Active Blockers
*None currently.*

## Resolved Issues
1. **Drive C Disk Exhaustion (`ENOSPC`)**:
   - **Symptom**: `npm install` failed with `ENOSPC: no space left on device, write`. Drive C had only ~10MB free.
   - **Fix**: Cleared npm cache (`npm cache clean --force`), freed 2.6GB on C:, and permanently relocated npm global cache to `D:\npm-cache` and pnpm store to `D:\pnpm-store` (Drive D has >320GB free space).
2. **Interactive TTY Prompt Hang in pnpm**:
   - **Symptom**: `pnpm install` stopped at interactive prompt `? Verifying lockfile against supply-chain policies`.
   - **Fix**: Sent Enter newline input via `send_input`, allowing installation to proceed in background.
