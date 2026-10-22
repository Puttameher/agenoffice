/**
 * office-memory plugin
 *
 * Dual-Loop Organizational Knowledge & Memory Pipeline:
 * - Loop 1 (Short-term): Agent-specific episodic memory and scratchpad notes (office_memories)
 * - Loop 2 (Long-term): Cross-agent experience distillation and lesson retrieval (office_experiences)
 * - Obsidian Markdown Vault: File-based vault curator (vault/ directory) with YAML frontmatter, [[wikilinks]], tags, and graph topology
 * - Skill Promotion Engine: Distills recurring successful procedures into durable skills/<name>/SKILL.md
 * - Cordis Service: Exposes ctx.officeMemory and emits memory.* and skill.* events via officeEvents
 */

import { DatabaseSync } from 'node:sqlite'
import { join, resolve, isAbsolute, basename } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { Service } from 'file:///D:/youtube/agenoffice/vendor/deepseek-harness/vendor/cordis/src/index.ts'

export const name = 'office-memory'
export const inject = ['officeEvents']

export function titleToFilename(title) {
  const safe = (title || 'untitled').replace(/[<>:"/\\|?*]/g, '').trim()
  return (safe || 'untitled') + '.md'
}

export function extractWikilinks(content) {
  if (!content || typeof content !== 'string') return []
  const matches = content.match(/\[\[([^\]]+)\]\]/g) || []
  return matches.map(m => m.slice(2, -2).trim())
}

export class OfficeMemory extends Service {
  constructor(ctx, config = {}) {
    super(ctx, 'officeMemory', true)
    this.config = config

    // Setup SQLite persistence for memories, experiences, and promoted skills
    const dbPath = config.dbPath || join(process.cwd(), 'data', 'events.sqlite')
    if (dbPath !== ':memory:') {
      const dir = join(dbPath, '..')
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
    }
    this.db = new DatabaseSync(dbPath)
    this.initDb()

    // Setup vault directory (Obsidian markdown vault)
    this.vaultDir = config.vaultDir ? resolve(config.vaultDir) : join(process.cwd(), 'vault')
    if (!existsSync(this.vaultDir)) {
      mkdirSync(this.vaultDir, { recursive: true })
    }

    // Setup skills directory (Promoted procedures)
    this.skillsDir = config.skillsDir ? resolve(config.skillsDir) : join(process.cwd(), 'skills')
    if (!existsSync(this.skillsDir)) {
      mkdirSync(this.skillsDir, { recursive: true })
    }

    // Auto-seed default vault notes and skills if configured or when using persistent DB
    if (config.seed === true || (config.seed !== false && dbPath !== ':memory:')) {
      try {
        this.seedDefaults()
      } catch (err) {
        // Warning only
      }
    }
  }

  initDb() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS office_memories (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        key TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_memories_agent ON office_memories(agent_id);

      CREATE TABLE IF NOT EXISTS office_experiences (
        id TEXT PRIMARY KEY,
        task_summary TEXT NOT NULL,
        strategy TEXT NOT NULL,
        what_worked TEXT NOT NULL,
        what_failed TEXT NOT NULL,
        lesson TEXT NOT NULL,
        feedback TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_experiences_created ON office_experiences(created_at);

      CREATE TABLE IF NOT EXISTS office_skills (
        name TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        agent TEXT NOT NULL,
        description TEXT NOT NULL,
        procedure TEXT NOT NULL,
        required_tools_json TEXT NOT NULL DEFAULT '[]',
        version INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)
  }

  // =========================================================================
  // LOOP 1: SHORT-TERM EPISODIC AGENT MEMORY
  // =========================================================================

  saveAgentMemory(agentId, key, content) {
    if (!agentId || !key) {
      throw new Error('agentId and key are required to save agent memory')
    }
    const id = `mem-${randomUUID().slice(0, 8)}`
    const nowIso = new Date().toISOString()

    this.db.prepare(`
      INSERT INTO office_memories (id, agent_id, key, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, agentId, key, content || '', nowIso)

    return { id, agentId, key, content, createdAt: nowIso }
  }

  getAgentMemories(agentId) {
    const rows = this.db.prepare('SELECT * FROM office_memories WHERE agent_id = ? ORDER BY created_at ASC').all(agentId)
    return rows.map(r => ({
      id: r.id,
      agentId: r.agent_id,
      key: r.key,
      content: r.content,
      createdAt: r.created_at
    }))
  }

  // =========================================================================
  // LOOP 2: LONG-TERM ORGANIZATIONAL EXPERIENCE DISTILLATION
  // =========================================================================

  saveExperience(spec = {}) {
    if (!spec.taskSummary || !spec.lesson) {
      throw new Error('taskSummary and lesson are required to save experience')
    }

    const id = `exp-${randomUUID().slice(0, 8)}`
    const nowIso = new Date().toISOString()

    this.db.prepare(`
      INSERT INTO office_experiences (id, task_summary, strategy, what_worked, what_failed, lesson, feedback, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      spec.taskSummary,
      spec.strategy || 'Direct execution',
      spec.whatWorked || 'Task completed successfully',
      spec.whatFailed || 'None',
      spec.lesson,
      spec.feedback || null,
      nowIso
    )

    const exp = {
      id,
      taskSummary: spec.taskSummary,
      strategy: spec.strategy || 'Direct execution',
      whatWorked: spec.whatWorked || 'Task completed successfully',
      whatFailed: spec.whatFailed || 'None',
      lesson: spec.lesson,
      feedback: spec.feedback || null,
      createdAt: nowIso
    }

    const events = this.ctx?.get('officeEvents', false) || this.ctx?.officeEvents
    if (events) {
      events.emit({
        type: 'memory.experience_stored',
        agent: 'Rio',
        data: exp
      })
    }

    return exp
  }

  getRelevantExperiences(query = '', limit = 3) {
    const all = this.db.prepare('SELECT * FROM office_experiences ORDER BY created_at DESC LIMIT 50').all()
    if (!query || all.length === 0) {
      return all.slice(0, limit).map(r => this._rowToExperience(r))
    }

    const words = new Set(query.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2))
    const scored = all.map(r => {
      const summaryText = `${r.task_summary} ${r.strategy} ${r.lesson}`.toLowerCase()
      let overlap = 0
      for (const w of words) {
        if (summaryText.includes(w)) overlap++
      }
      return { score: overlap, row: r }
    })

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, limit).map(s => this._rowToExperience(s.row))
  }

  _rowToExperience(r) {
    if (!r) return null
    return {
      id: r.id,
      taskSummary: r.task_summary,
      strategy: r.strategy,
      whatWorked: r.what_worked,
      whatFailed: r.what_failed,
      lesson: r.lesson,
      feedback: r.feedback,
      createdAt: r.created_at
    }
  }

  // =========================================================================
  // OBSIDIAN MARKDOWN VAULT OPERATIONS (vault/)
  // =========================================================================

  createNote(spec = {}) {
    if (!spec.title) {
      throw new Error('Note title is required')
    }

    const title = spec.title.trim()
    const filename = titleToFilename(title)
    const filePath = join(this.vaultDir, filename)
    const tags = Array.isArray(spec.tags) ? spec.tags : []
    const links = Array.isArray(spec.links) ? spec.links : []
    const agent = spec.agent || 'Rio'
    const nowIso = new Date().toISOString()

    // Build markdown note with YAML frontmatter
    let frontmatter = `---\ntitle: "${title}"\ndate: ${nowIso}\nagent: ${agent}\ntags: [${tags.map(t => `"${t}"`).join(', ')}]\n---\n\n`
    let body = spec.content || `# ${title}\n\n`

    if (links.length > 0 && !body.includes('## Related Notes')) {
      body += `\n\n## Related Notes\n` + links.map(l => `- [[${l}]]`).join('\n') + '\n'
    }

    const fullContent = frontmatter + body
    writeFileSync(filePath, fullContent, 'utf8')

    const noteMeta = {
      title,
      filename,
      filePath,
      agent,
      tags,
      links: Array.from(new Set([...links, ...extractWikilinks(body)])),
      sizeBytes: Buffer.byteLength(fullContent),
      createdAt: nowIso
    }

    const events = this.ctx?.get('officeEvents', false) || this.ctx?.officeEvents
    if (events) {
      events.emit({
        type: 'memory.note_created',
        agent: 'Rio',
        data: noteMeta
      })
    }

    return noteMeta
  }

  readNote(title) {
    if (!title) throw new Error('Note title is required')
    const filename = titleToFilename(title)
    const filePath = join(this.vaultDir, filename)

    if (!existsSync(filePath)) {
      // Try case-insensitive lookup
      const files = readdirSync(this.vaultDir).filter(f => f.endsWith('.md'))
      const match = files.find(f => f.toLowerCase() === filename.toLowerCase())
      if (!match) return null
      return this._parseNoteFile(join(this.vaultDir, match))
    }

    return this._parseNoteFile(filePath)
  }

  _parseNoteFile(filePath) {
    const raw = readFileSync(filePath, 'utf8')
    const filename = basename(filePath)
    const title = filename.replace(/\.md$/, '')

    let frontmatter = {}
    let body = raw

    if (raw.startsWith('---')) {
      const parts = raw.split('---')
      if (parts.length >= 3) {
        const yamlStr = parts[1]
        body = parts.slice(2).join('---').trim()
        const lines = yamlStr.split('\n')
        for (const line of lines) {
          const colonIdx = line.indexOf(':')
          if (colonIdx > 0) {
            const k = line.slice(0, colonIdx).trim()
            const v = line.slice(colonIdx + 1).trim()
            if (k === 'tags') {
              frontmatter[k] = v.replace(/[\[\]"]/g, '').split(',').map(t => t.trim()).filter(Boolean)
            } else {
              frontmatter[k] = v.replace(/^"|"$/g, '')
            }
          }
        }
      }
    }

    const links = extractWikilinks(body)
    const backlinks = this._findBacklinks(title)

    return {
      title,
      filename,
      filePath,
      frontmatter,
      content: body,
      links,
      backlinks,
      sizeBytes: Buffer.byteLength(raw)
    }
  }

  _findBacklinks(targetTitle) {
    const backlinks = []
    const targetWikilink = `[[${targetTitle}]]`.toLowerCase()
    const files = readdirSync(this.vaultDir).filter(f => f.endsWith('.md'))

    for (const f of files) {
      const noteTitle = f.replace(/\.md$/, '')
      if (noteTitle.toLowerCase() === targetTitle.toLowerCase()) continue
      try {
        const content = readFileSync(join(this.vaultDir, f), 'utf8')
        if (content.toLowerCase().includes(targetWikilink)) {
          backlinks.push(noteTitle)
        }
      } catch {}
    }
    return backlinks
  }

  appendNote(title, text) {
    const note = this.readNote(title)
    if (!note) {
      return this.createNote({ title, content: text })
    }

    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const updatedRaw = readFileSync(note.filePath, 'utf8') + `\n\n### Update (${timestamp})\n${text}\n`
    writeFileSync(note.filePath, updatedRaw, 'utf8')

    return this.readNote(title)
  }

  searchNotes(query = '') {
    const q = (query || '').toLowerCase().trim()
    const files = readdirSync(this.vaultDir).filter(f => f.endsWith('.md'))
    const results = []

    for (const f of files) {
      const note = this._parseNoteFile(join(this.vaultDir, f))
      const fullText = `${note.title} ${note.content} ${(note.frontmatter.tags || []).join(' ')}`.toLowerCase()
      if (!q || fullText.includes(q)) {
        const idx = fullText.indexOf(q)
        const start = Math.max(0, idx - 40)
        const excerpt = idx >= 0 ? note.content.slice(start, start + 120) : note.content.slice(0, 120)
        results.push({
          title: note.title,
          tags: note.frontmatter.tags || [],
          links: note.links,
          excerpt: excerpt.replace(/\s+/g, ' ').trim() + '...'
        })
      }
    }

    return results
  }

  getGraphData() {
    const files = readdirSync(this.vaultDir).filter(f => f.endsWith('.md'))
    const nodes = []
    const edges = []
    const nodeIds = new Set()

    for (const f of files) {
      const note = this._parseNoteFile(join(this.vaultDir, f))
      nodeIds.add(note.title)
      nodes.push({
        id: note.title,
        label: note.title,
        tags: note.frontmatter.tags || [],
        agent: note.frontmatter.agent || 'Rio'
      })
    }

    for (const f of files) {
      const note = this._parseNoteFile(join(this.vaultDir, f))
      for (const link of note.links) {
        if (nodeIds.has(link)) {
          edges.push({
            from: note.title,
            to: link
          })
        }
      }
    }

    return { nodes, edges }
  }

  // =========================================================================
  // SKILL PROMOTION ENGINE (skills/<name>/SKILL.md)
  // =========================================================================

  promoteSkill(spec = {}) {
    if (!spec.name || !spec.procedure) {
      throw new Error('Skill name and procedure are required for skill promotion')
    }

    const skillKey = spec.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-')
    const skillDir = join(this.skillsDir, skillKey)
    if (!existsSync(skillDir)) {
      mkdirSync(skillDir, { recursive: true })
    }

    const skillFilePath = join(skillDir, 'SKILL.md')
    const category = spec.category || 'General Automation'
    const agent = spec.agent || 'Alex'
    const description = spec.description || `Specialized procedural skill for ${spec.name}.`
    const requiredTools = Array.isArray(spec.requiredTools) ? spec.requiredTools : ['calculator']
    const nowIso = new Date().toISOString()

    const markdownDoc = `---
name: ${skillKey}
description: "${description}"
category: "${category}"
agent: "${agent}"
version: 1
tools: [${requiredTools.map(t => `"${t}"`).join(', ')}]
---

# ${spec.name}

**Category**: ${category}  
**Agent**: ${agent}  

## Description
${description}

## Capabilities
${(spec.capabilities || ['Systematic task automation', 'Self-verifying procedure']).map(c => `- ${c}`).join('\n')}

## Procedure
${spec.procedure}

## Required Tools
${requiredTools.map(t => `- \`${t}\``).join('\n')}
`

    writeFileSync(skillFilePath, markdownDoc, 'utf8')

    // Persist to SQLite
    this.db.prepare(`
      INSERT OR REPLACE INTO office_skills (
        name, category, agent, description, procedure, required_tools_json, version, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      skillKey,
      category,
      agent,
      description,
      spec.procedure,
      JSON.stringify(requiredTools),
      1,
      'active',
      nowIso,
      nowIso
    )

    const skillRecord = {
      name: skillKey,
      category,
      agent,
      description,
      procedure: spec.procedure,
      requiredTools,
      version: 1,
      status: 'active',
      path: skillFilePath,
      createdAt: nowIso
    }

    const events = this.ctx?.get('officeEvents', false) || this.ctx?.officeEvents
    if (events) {
      events.emit({
        type: 'skill.promoted',
        agent: 'Rio',
        data: skillRecord
      })
    }

    return skillRecord
  }

  listSkills() {
    const rows = this.db.prepare("SELECT * FROM office_skills WHERE status = 'active' ORDER BY name ASC").all()
    return rows.map(r => ({
      name: r.name,
      category: r.category,
      agent: r.agent,
      description: r.description,
      procedure: r.procedure,
      requiredTools: JSON.parse(r.required_tools_json || '[]'),
      version: r.version,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }))
  }

  seedDefaults() {
    // 1. Seed initial Obsidian vault knowledge notes if vault is empty
    const existingNotes = readdirSync(this.vaultDir).filter(f => f.endsWith('.md'))
    if (existingNotes.length === 0) {
      this.createNote({
        title: 'Office Architecture',
        agent: 'Jordan',
        tags: ['architecture', 'cordis', 'core'],
        content: '# Office Architecture\n\nThe AgenOffice platform is an autonomous agentic workplace built on top of the [[Cordis Microkernel]].\n\n## Core Principles\n- **Modularity**: Every capability is a standalone Cordis plugin with reversible lifecycle.\n- **Dual-Loop Memory**: Seamlessly ties short-term scratchpads to long-term organizational wisdom. See [[Dual-Loop Memory]].\n- **Multi-Agent Roster**: Five permanent employees collaborate across specialized desks. See [[Agent Roster]].\n- **Zero-Install Tooling**: Fast, native automation engines including [[Playwright Automation]].'
      })

      this.createNote({
        title: 'Dual-Loop Memory',
        agent: 'Rio',
        tags: ['memory', 'knowledge', 'architecture'],
        content: '# Dual-Loop Memory\n\nDual-Loop Memory provides continuous cognitive evolution across tasks.\n\n- **Loop 1 (Episodic)**: Key-value agent working memories, active branch notes, and scratchpad preferences.\n- **Loop 2 (Organizational)**: Distills lessons (`taskSummary`, `strategy`, `whatWorked`, `whatFailed`, `lesson`) stored in SQLite and indexed for similarity search.\n- **Human Knowledge Vault**: Markdown notes with YAML frontmatter, backlinks, and tags living in the user\'s Obsidian [[Office Architecture]].'
      })

      this.createNote({
        title: 'Cordis Microkernel',
        agent: 'Alex',
        tags: ['cordis', 'microkernel', 'lifecycle'],
        content: '# Cordis Microkernel\n\nCordis is the reactive dependency injection framework powering AgenOffice.\n\n- Inversion of Control with strict service isolation (`ctx.officeEvents`, `ctx.officeRoster`, `ctx.officeMemory`).\n- Hot-reloadable plugins with `ctx.effect` unwinding.\n- Type-safe service contracts and cross-plugin event dispatch.'
      })

      this.createNote({
        title: 'Agent Roster',
        agent: 'Jordan',
        tags: ['roster', 'agents'],
        content: '# Agent Roster\n\nOur permanent office staff operates across dedicated physical desks:\n\n- **Jordan** (Desk 0): Executive Manager & Decomposition Orchestrator.\n- **Alex** (Desk 1): Lead Full-Stack Software Engineer & Computational Specialist.\n- **Nova** (Desk 2): Market Research & Business Intelligence Analyst.\n- **Rio** (Desk 3): Knowledge Base Curator & [[Dual-Loop Memory]] Architect.\n- **Kai** (Desk 4): Web Automation & Headless [[Playwright Automation]] Pilot.\n\nDynamic visitor specialists are hired onto Desks 5 & 6 as needed.'
      })

      this.createNote({
        title: 'Playwright Automation',
        agent: 'Kai',
        tags: ['browser', 'automation', 'tools'],
        content: '# Playwright Automation\n\nAutonomous web navigation and verification engine operated by Kai.\n\n- Uses native Microsoft Edge channel to eliminate external browser download delays.\n- Features full DOM content scraping, deterministic typing, click interactions, and full-page PNG screenshots.\n- Governed by safety policies documented in [[Office Architecture]].'
      })
    }

    // 2. Seed initial procedural skills if empty
    const skillCount = this.db.prepare("SELECT count(*) as count FROM office_skills").get()?.count || 0
    if (skillCount === 0) {
      this.promoteSkill({
        name: 'extract-invoice',
        category: 'Document Processing',
        agent: 'Rio',
        description: 'Parses tabular invoice documents and calculates line totals with tax verification.',
        procedure: '1. Read invoice file from workspace using file_reader.\n2. Extract line items, quantities, and unit prices.\n3. Compute subtotal and apply tax rate using calculator.\n4. Output validated structured JSON receipt.',
        requiredTools: ['file_reader', 'calculator']
      })

      this.promoteSkill({
        name: 'fill-forms',
        category: 'Web Automation',
        agent: 'Kai',
        description: 'Navigates to web application portals and systematically fills multi-input forms.',
        procedure: '1. Navigate to target URL via browser_navigate.\n2. Locate form input selectors and type required field values with browser_type.\n3. Submit form using browser_click.\n4. Inspect page state and capture screenshot artifact.',
        requiredTools: ['browser_navigate', 'browser_type', 'browser_click', 'browser_screenshot']
      })

      this.promoteSkill({
        name: 'research-company',
        category: 'Market Intelligence',
        agent: 'Nova',
        description: 'Conducts competitive research and synthesizes market profile reports.',
        procedure: '1. Navigate to company website and about pages.\n2. Extract executive leadership, core product offerings, and recent press releases.\n3. Read internal knowledge notes to benchmark against known industry metrics.\n4. Synthesize research brief and publish to Obsidian vault.',
        requiredTools: ['browser_navigate', 'browser_content', 'file_reader']
      })

      this.promoteSkill({
        name: 'apply-to-jobs',
        category: 'Automation Workflow',
        agent: 'Kai',
        description: 'Automates job application submissions and candidate tracking.',
        procedure: '1. Read applicant resume and credentials using file_reader.\n2. Open job posting page via browser_navigate.\n3. Populate candidate information with browser_type.\n4. Verify submission confirmation and record status.',
        requiredTools: ['browser_navigate', 'browser_type', 'file_reader']
      })
    }
  }

  close() {
    try {
      this.db.close()
    } catch {}
  }
}

export function apply(ctx, config = {}) {
  ctx.plugin(OfficeMemory, config)
}
