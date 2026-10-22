/**
 * office-events plugin
 *
 * Event Processor:
 * - Maps harness & agent lifecycle events to typed OfficeEvents
 * - Monotonically increasing event ID
 * - Persistent storage in SQLite (node:sqlite)
 * - Replay by Last-Event-ID
 * - Secret redaction
 * - SSE broadcast
 *
 * Implements diagram box: "Execution & Event pipeline (Event Bus, Event Processor, SSE)"
 */

import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { mkdirSync, existsSync } from 'node:fs'
import { Service } from 'file:///D:/youtube/agenoffice/vendor/deepseek-harness/vendor/cordis/src/index.ts'

export const name = 'office-events'

// Secret scrubbing patterns
const SECRET_PATTERNS = [
  /(?<![a-zA-Z0-9])(?:sk-|gsk_)[a-zA-Z0-9_\-]{20,}/g,
  /(?:Bearer\s+)[a-zA-Z0-9_\-\.]{20,}/gi,
  /"(?:apiKey|token|password|secret|authorization)":\s*"[^"]+"/gi,
  /(?:OPENAI_API_KEY|GROQ_API_KEY|TYPESAFE_API_KEY|OPENROUTER_API_KEY)=([^\s\r\n]+)/gi
]

export function redactSecrets(data) {
  if (data === null || data === undefined) return data
  if (typeof data === 'string') {
    let result = data
    for (const pattern of SECRET_PATTERNS) {
      result = result.replace(pattern, '[REDACTED]')
    }
    return result
  }
  if (Array.isArray(data)) {
    return data.map(item => redactSecrets(item))
  }
  if (typeof data === 'object') {
    const result = {}
    for (const [key, val] of Object.entries(data)) {
      if (/password|secret|apikey|token|auth/i.test(key) && typeof val === 'string') {
        result[key] = '[REDACTED]'
      } else {
        result[key] = redactSecrets(val)
      }
    }
    return result
  }
  return data
}

export class OfficeEventStore extends Service {
  constructor(ctx, config = {}) {
    super(ctx, 'officeEvents', true)
    const dbPath = config.dbPath || join(process.cwd(), 'data', 'events.sqlite')
    if (dbPath !== ':memory:') {
      const dir = join(dbPath, '..')
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
    }
    this.db = new DatabaseSync(dbPath)
    this.listeners = new Set()
    this.initDb()

    // Forward harness agent / tools lifecycle if available
    ctx.on('agent/status', (agent, status) => {
      this.emit({
        type: 'agent.status',
        agent: agent?.id || 'agent',
        data: { status, activity: status === 'running' ? 'active turn' : 'idle' }
      })
    })

    ctx.on('tools/execute', (exec) => {
      this.emit({
        type: 'tool.called',
        agent: exec?.agent?.id || 'tool',
        data: { tool: exec?.name, args: redactSecrets(exec?.args) }
      })
    })

    ctx.on('tools/result', (result) => {
      this.emit({
        type: 'tool.result',
        agent: result?.agent?.id || 'tool',
        data: { tool: result?.name, output: redactSecrets(result?.output) }
      })
    })

    ctx.on('dispose', () => {
      this.close()
    })
  }

  initDb() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS office_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        type TEXT NOT NULL,
        task_id TEXT,
        agent TEXT,
        data_json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_office_events_id ON office_events(id);
      CREATE INDEX IF NOT EXISTS idx_office_events_task ON office_events(task_id);
    `)
  }

  emit(rawEvent) {
    const ts = rawEvent.ts || new Date().toISOString()
    const redactedData = redactSecrets(rawEvent.data || {})
    const dataJson = JSON.stringify(redactedData)

    const stmt = this.db.prepare(`
      INSERT INTO office_events (ts, type, task_id, agent, data_json)
      VALUES (?, ?, ?, ?, ?)
    `)
    const result = stmt.run(ts, rawEvent.type, rawEvent.taskId || null, rawEvent.agent || null, dataJson)
    const id = Number(result.lastInsertRowid)

    const event = {
      id,
      ts,
      type: rawEvent.type,
      taskId: rawEvent.taskId,
      agent: rawEvent.agent,
      data: redactedData
    }

    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (err) {
        console.error('[office-events] listener error:', err)
      }
    }

    return event
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getEventsSince(lastId = 0, limit = 500) {
    const stmt = this.db.prepare(`
      SELECT id, ts, type, task_id as taskId, agent, data_json as dataJson
      FROM office_events
      WHERE id > ?
      ORDER BY id ASC
      LIMIT ?
    `)
    const rows = stmt.all(Number(lastId) || 0, limit)
    return rows.map(r => ({
      id: r.id,
      ts: r.ts,
      type: r.type,
      taskId: r.taskId || undefined,
      agent: r.agent || undefined,
      data: JSON.parse(r.dataJson)
    }))
  }

  close() {
    this.listeners.clear()
    this.db.close()
  }
}

export function apply(ctx, config) {
  ctx.plugin(OfficeEventStore, config)
}
