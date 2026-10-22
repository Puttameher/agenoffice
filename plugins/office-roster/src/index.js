/**
 * office-roster plugin
 *
 * Office Roster Management:
 * - 5 Core Office Employees:
 *   1. Jordan (Manager / Orchestrator, desk 0, #38bdf8)
 *   2. Alex (Coding Agent, desk 1, #3b82f6)
 *   3. Nova (Research Agent, desk 2, #a855f7)
 *   4. Rio (Knowledge & Memory Agent, desk 3, #f97316)
 *   5. Kai (Browser Automation Agent, desk 4, #10b981)
 * - Workstation Management:
 *   6 Workstations (Desks 1-6) + Manager Suite (Desk 0).
 *   Desks 5 and 6 (and any freed desks) accommodate dynamic visitor / contractor specialists.
 * - Dynamic Agent Hiring & Archival with Workstation Allocation.
 * - Agent Status Lifecycle: idle, working, reviewing, collaborating, resting, offline, archived.
 * - Continuable Subagent Linkage: Integrates with ctx.subagents when available.
 * - Persistence: SQLite backing store (office_agents) with automatic seeding.
 * - Cordis Service: Exposes ctx.officeRoster and emits agent.* events via officeEvents.
 */

import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { Service } from 'file:///D:/youtube/agenoffice/vendor/deepseek-harness/vendor/cordis/src/index.ts'

export const name = 'office-roster'
export const inject = ['officeEvents']

export const CORE_EMPLOYEES = [
  {
    id: 'manager',
    name: 'Jordan',
    role: 'Manager / Orchestrator',
    description: 'Coordinates office workflow, breaks down complex tasks, delegates to specialist agents, and evaluates output quality.',
    instructions: 'Analyze multi-step goals, synthesize plan, orchestrate execution across Alex, Nova, Rio, and Kai, and ensure quality standards.',
    skills: ['task_decomposition', 'workflow_orchestration', 'quality_assurance', 'agent_coordination'],
    tools: ['calculator', 'file_reader'],
    deskId: 0,
    color: '#38bdf8',
    permanent: true
  },
  {
    id: 'coding',
    name: 'Alex',
    role: 'Coding Agent',
    description: 'Full-stack software engineering, script authoring, debugging, shell execution, and test automation.',
    instructions: 'Write clean, robust code, execute tests, debug errors systematically, and verify solutions.',
    skills: ['python', 'javascript', 'debugging', 'testing', 'shell_execution'],
    tools: ['python_runner', 'calculator'],
    deskId: 1,
    color: '#3b82f6',
    permanent: true
  },
  {
    id: 'research',
    name: 'Nova',
    role: 'Research Agent',
    description: 'Deep web research, factual synthesis, literature review, competitive intelligence, and structured reporting.',
    instructions: 'Gather facts from authoritative sources, synthesize structured reports with citations, and verify claims.',
    skills: ['web_research', 'fact_checking', 'market_intelligence', 'literature_synthesis'],
    tools: ['browser', 'calculator'],
    deskId: 2,
    color: '#a855f7',
    permanent: true
  },
  {
    id: 'knowledge',
    name: 'Rio',
    role: 'Knowledge & Memory Agent',
    description: 'Organizational memory, Obsidian markdown vault curator, cross-task learning extraction, and quantitative analysis.',
    instructions: 'Maintain persistent knowledge base, retrieve relevant prior learnings, and curate durable lessons in Obsidian.',
    skills: ['obsidian_vault', 'memory_retrieval', 'learning_extraction', 'quantitative_analysis'],
    tools: ['obsidian', 'calculator', 'file_reader'],
    deskId: 3,
    color: '#f97316',
    permanent: true
  },
  {
    id: 'browser',
    name: 'Kai',
    role: 'Browser Automation Agent',
    description: 'Playwright headless browser navigation, DOM interaction, web scraping, form filling, and visual verification.',
    instructions: 'Navigate web applications, interact with UI elements, verify page state, and capture screenshots.',
    skills: ['playwright_navigation', 'dom_extraction', 'form_interaction', 'visual_verification'],
    tools: ['browser', 'form_filler'],
    deskId: 4,
    color: '#10b981',
    permanent: true
  }
]

export const VALID_STATUSES = [
  'idle',
  'working',
  'reviewing',
  'collaborating',
  'resting',
  'offline',
  'archived'
]

export class OfficeRoster extends Service {
  constructor(ctx, config = {}) {
    super(ctx, 'officeRoster', true)
    this.config = config

    // Setup SQLite persistence for agents
    const dbPath = config.dbPath || join(process.cwd(), 'data', 'events.sqlite')
    if (dbPath !== ':memory:') {
      const dir = join(dbPath, '..')
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
    }
    this.db = new DatabaseSync(dbPath)
    this.initDb()
    this.seedCoreEmployees()

    // Subagent sessions active map: childId -> sessionInfo
    this.subagentSessions = new Map()
  }

  initDb() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS office_agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        description TEXT,
        instructions TEXT,
        skills_json TEXT NOT NULL DEFAULT '[]',
        tools_json TEXT NOT NULL DEFAULT '[]',
        desk_id INTEGER,
        color TEXT NOT NULL DEFAULT '#3b82f6',
        permanent INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'idle',
        activity TEXT NOT NULL DEFAULT 'ready',
        current_task_id TEXT,
        level INTEGER NOT NULL DEFAULT 1,
        xp INTEGER NOT NULL DEFAULT 0,
        tasks_completed INTEGER NOT NULL DEFAULT 0,
        badges_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_agents_status ON office_agents(status);
      CREATE INDEX IF NOT EXISTS idx_agents_desk ON office_agents(desk_id);
    `)
  }

  seedCoreEmployees() {
    const checkStmt = this.db.prepare('SELECT id FROM office_agents WHERE id = ?')
    const insertStmt = this.db.prepare(`
      INSERT INTO office_agents (
        id, name, role, description, instructions, skills_json, tools_json,
        desk_id, color, permanent, status, activity, current_task_id,
        level, xp, tasks_completed, badges_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const nowIso = new Date().toISOString()
    for (const emp of CORE_EMPLOYEES) {
      const existing = checkStmt.get(emp.id)
      if (!existing) {
        insertStmt.run(
          emp.id,
          emp.name,
          emp.role,
          emp.description || '',
          emp.instructions || '',
          JSON.stringify(emp.skills || []),
          JSON.stringify(emp.tools || []),
          emp.deskId,
          emp.color || '#3b82f6',
          emp.permanent ? 1 : 0,
          'idle',
          'ready',
          null,
          1,
          0,
          0,
          JSON.stringify([]),
          nowIso,
          nowIso
        )
      }
    }
  }

  _rowToAgent(row) {
    if (!row) return null
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      description: row.description,
      instructions: row.instructions,
      skills: JSON.parse(row.skills_json || '[]'),
      tools: JSON.parse(row.tools_json || '[]'),
      deskId: row.desk_id,
      color: row.color,
      permanent: Boolean(row.permanent),
      status: row.status,
      activity: row.activity,
      currentTaskId: row.current_task_id,
      level: row.level,
      xp: row.xp,
      tasksCompleted: row.tasks_completed,
      badges: JSON.parse(row.badges_json || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  listAgents(includeArchived = false) {
    const query = includeArchived
      ? 'SELECT * FROM office_agents ORDER BY desk_id ASC, created_at ASC'
      : "SELECT * FROM office_agents WHERE status != 'archived' ORDER BY desk_id ASC, created_at ASC"
    const rows = this.db.prepare(query).all()
    return rows.map(r => this._rowToAgent(r))
  }

  getAgent(id) {
    const row = this.db.prepare('SELECT * FROM office_agents WHERE id = ?').get(id)
    return this._rowToAgent(row)
  }

  findAvailableDesk() {
    // Workstations 1 through 6 are available (0 is Jordan's Manager Suite)
    const activeAgents = this.listAgents(false)
    const occupiedDesks = new Set(activeAgents.map(a => a.deskId).filter(d => d !== null && d !== undefined))
    for (let desk = 1; desk <= 6; desk++) {
      if (!occupiedDesks.has(desk)) {
        return desk
      }
    }
    return null
  }

  hireAgent(spec = {}) {
    if (!spec.name || !spec.role) {
      throw new Error('Agent name and role are required to hire an agent.')
    }

    // Determine desk assignment
    let deskId = spec.deskId
    if (deskId === undefined || deskId === null) {
      deskId = this.findAvailableDesk()
    } else {
      // Validate requested desk is free
      const activeAgents = this.listAgents(false)
      const isOccupied = activeAgents.some(a => a.deskId === deskId)
      if (isOccupied) {
        throw new Error(`Workstation desk #${deskId} is already occupied.`)
      }
    }

    if (deskId === null) {
      throw new Error('All 6 workstation desks are currently occupied. Archive a specialist first.')
    }

    const id = spec.id || `agent_${spec.name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${randomUUID().slice(0, 8)}`
    const nowIso = new Date().toISOString()
    const color = spec.color || (deskId === 5 ? '#eab308' : deskId === 6 ? '#64748b' : '#3b82f6')
    const permanent = Boolean(spec.permanent ?? false)

    const insertStmt = this.db.prepare(`
      INSERT INTO office_agents (
        id, name, role, description, instructions, skills_json, tools_json,
        desk_id, color, permanent, status, activity, current_task_id,
        level, xp, tasks_completed, badges_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    insertStmt.run(
      id,
      spec.name,
      spec.role,
      spec.description || '',
      spec.instructions || '',
      JSON.stringify(spec.skills || ['general']),
      JSON.stringify(spec.tools || ['calculator']),
      deskId,
      color,
      permanent ? 1 : 0,
      'idle',
      'ready for assignments',
      null,
      1,
      0,
      0,
      JSON.stringify([]),
      nowIso,
      nowIso
    )

    const agent = this.getAgent(id)

    // Emit agent.created event
    const events = this.ctx?.get('officeEvents', false) || this.ctx?.officeEvents
    if (events) {
      events.emit({
        type: 'agent.created',
        agent: agent.name,
        data: agent
      })
    }

    return agent
  }

  archiveAgent(id) {
    const agent = this.getAgent(id)
    if (!agent) {
      throw new Error(`Agent not found: ${id}`)
    }
    if (agent.permanent) {
      throw new Error(`Cannot archive permanent core employee: ${agent.name}`)
    }

    const prevDeskId = agent.deskId
    const nowIso = new Date().toISOString()

    this.db.prepare(`
      UPDATE office_agents
      SET status = 'archived', activity = 'archived', desk_id = NULL, current_task_id = NULL, updated_at = ?
      WHERE id = ?
    `).run(nowIso, id)

    const updated = this.getAgent(id)

    // Emit agent.archived event
    const events = this.ctx?.get('officeEvents', false) || this.ctx?.officeEvents
    if (events) {
      events.emit({
        type: 'agent.archived',
        agent: agent.name,
        data: {
          agentId: id,
          freedDeskId: prevDeskId
        }
      })
    }

    return updated
  }

  setAgentStatus(id, status, activity = null, taskId = null) {
    if (!VALID_STATUSES.includes(status)) {
      throw new Error(`Invalid status '${status}'. Must be one of: ${VALID_STATUSES.join(', ')}`)
    }

    const agent = this.getAgent(id)
    if (!agent) {
      throw new Error(`Agent not found: ${id}`)
    }

    const newActivity = activity !== null ? activity : (status === 'idle' ? 'ready' : agent.activity)
    const newTaskId = taskId !== undefined ? taskId : (status === 'idle' ? null : agent.currentTaskId)
    const nowIso = new Date().toISOString()

    this.db.prepare(`
      UPDATE office_agents
      SET status = ?, activity = ?, current_task_id = ?, updated_at = ?
      WHERE id = ?
    `).run(status, newActivity, newTaskId, nowIso, id)

    const updated = this.getAgent(id)

    // Emit agent.status event
    const events = this.ctx?.get('officeEvents', false) || this.ctx?.officeEvents
    if (events) {
      events.emit({
        type: 'agent.status',
        taskId: newTaskId,
        agent: agent.name,
        data: {
          agentId: id,
          status,
          activity: newActivity,
          taskId: newTaskId,
          deskId: agent.deskId
        }
      })
    }

    return updated
  }

  recordTaskCompletion(id, { success = true, xpGain = 25 } = {}) {
    const agent = this.getAgent(id)
    if (!agent) {
      throw new Error(`Agent not found: ${id}`)
    }

    const newTasksCompleted = agent.tasksCompleted + 1
    const newXp = agent.xp + (success ? xpGain : Math.floor(xpGain / 4))
    const newLevel = Math.floor(newXp / 100) + 1
    const nowIso = new Date().toISOString()

    this.db.prepare(`
      UPDATE office_agents
      SET tasks_completed = ?, xp = ?, level = ?, updated_at = ?
      WHERE id = ?
    `).run(newTasksCompleted, newXp, newLevel, nowIso, id)

    return this.getAgent(id)
  }

  /**
   * Links or creates a subagent child session for the given employee.
   * If ctx.subagents is mounted in the harness, prepares continuable delegation.
   */
  async createSubagentSession(agentId, prompt, options = {}) {
    const agent = this.getAgent(agentId)
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`)
    }

    const childId = `subagent-${agent.id}-${randomUUID().slice(0, 8)}`
    const sessionInfo = {
      childId,
      agentId: agent.id,
      agentName: agent.name,
      parentSessionId: options.parentSessionId || null,
      taskId: options.taskId || null,
      prompt,
      status: 'active',
      startedAt: new Date().toISOString()
    }

    this.subagentSessions.set(childId, sessionInfo)

    // If subagents service is available in Cordis, bridge to it
    const subagentsService = this.ctx?.get('subagents', false)
    if (subagentsService && typeof subagentsService.startActivation === 'function') {
      try {
        const activation = await subagentsService.startActivation({
          provider: 'spawn-in-process',
          label: `${agent.name}: ${prompt.slice(0, 30)}`,
          childId,
          request: {
            prompt: [{ type: 'text', text: prompt }],
            ...options
          },
          delivery: 'caller'
        })
        sessionInfo.activation = activation
      } catch (err) {
        console.warn(`[office-roster] Could not start subagent activation: ${err.message}`)
      }
    }

    // Set agent status to working
    this.setAgentStatus(agent.id, 'working', `Executing subtask: ${prompt.slice(0, 40)}...`, options.taskId)

    return sessionInfo
  }

  close() {
    try {
      this.db.close()
    } catch {}
  }
}

export function apply(ctx, config = {}) {
  ctx.plugin(OfficeRoster, config)
}
