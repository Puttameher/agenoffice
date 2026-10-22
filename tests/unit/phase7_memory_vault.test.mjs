import assert from 'node:assert/strict'
import http from 'node:http'
import { join } from 'node:path'
import { rmSync, existsSync, mkdirSync } from 'node:fs'
import { Context } from 'file:///D:/youtube/agenoffice/vendor/deepseek-harness/vendor/cordis/src/index.ts'
import * as OfficeEvents from 'file:///D:/youtube/agenoffice/plugins/office-events/src/index.js'
import * as OfficeRoster from 'file:///D:/youtube/agenoffice/plugins/office-roster/src/index.js'
import * as OfficeTools from 'file:///D:/youtube/agenoffice/plugins/office-tools/src/index.js'
import * as OfficeTasks from 'file:///D:/youtube/agenoffice/plugins/office-tasks/src/index.js'
import * as OfficeMemory from 'file:///D:/youtube/agenoffice/plugins/office-memory/src/index.js'
import * as OfficeGateway from 'file:///D:/youtube/agenoffice/plugins/office-gateway/src/index.js'

console.log('=== PHASE 7 ACCEPTANCE: Knowledge & Memory Pipeline ===\n')

const testDir = join(process.cwd(), 'tests', 'scratch', 'phase7_test')
if (existsSync(testDir)) {
  rmSync(testDir, { recursive: true, force: true })
}
mkdirSync(testDir, { recursive: true })

const vaultDir = join(testDir, 'vault')
const skillsDir = join(testDir, 'skills')

const rootCtx = new Context()

// 1. Mount Cordis plugins
console.log('[TEST 1] Testing Cordis mounting and memory service exposure...')
const eventsFork = rootCtx.plugin(OfficeEvents, { dbPath: ':memory:' })
const rosterFork = rootCtx.plugin(OfficeRoster, { dbPath: ':memory:' })
const toolsFork = rootCtx.plugin(OfficeTools)
const memoryFork = rootCtx.plugin(OfficeMemory, {
  dbPath: ':memory:',
  vaultDir,
  skillsDir
})
const tasksFork = rootCtx.plugin(OfficeTasks, { dbPath: ':memory:' })

await new Promise(r => setTimeout(r, 100))

assert.ok(rootCtx.officeEvents, 'ctx.officeEvents must be registered')
assert.ok(rootCtx.officeRoster, 'ctx.officeRoster must be registered')
assert.ok(rootCtx.officeTools, 'ctx.officeTools must be registered')
assert.ok(rootCtx.officeMemory, 'ctx.officeMemory must be registered')
assert.ok(rootCtx.officeTasks, 'ctx.officeTasks must be registered')
console.log('[PASS] Mounted OfficeEvents, OfficeRoster, OfficeTools, OfficeMemory, and OfficeTasks onto Cordis context.\n')

const memoryService = rootCtx.officeMemory
const events = rootCtx.officeEvents

// 2. Obsidian Markdown Vault Note Operations
console.log('[TEST 2] Testing Obsidian Vault note creation, frontmatter, wikilinks, and backlinks...')
let noteCreatedEvent = null
events.subscribe(ev => {
  if (ev.type === 'memory.note_created') noteCreatedEvent = ev
})

// Create Note A
const noteA = memoryService.createNote({
  title: 'Architecture Strategy',
  agent: 'Jordan',
  tags: ['architecture', 'roadmap'],
  content: 'Our core architecture relies on [[Cordis Microkernel]] and [[Dual-Loop Memory]].'
})

assert.strictEqual(noteA.title, 'Architecture Strategy')
assert.ok(noteA.filename.endsWith('.md'))
assert.ok(noteCreatedEvent, 'memory.note_created event must be emitted')
assert.strictEqual(noteCreatedEvent.data.title, 'Architecture Strategy')

// Create Note B referencing Note A
const noteB = memoryService.createNote({
  title: 'Dual-Loop Memory',
  agent: 'Rio',
  tags: ['memory', 'knowledge'],
  content: 'Dual-Loop Memory implements short-term episodic memory and long-term experience distillation. See [[Architecture Strategy]].',
  links: ['Architecture Strategy']
})

assert.strictEqual(noteB.title, 'Dual-Loop Memory')

// Create Note C
const noteC = memoryService.createNote({
  title: 'Cordis Microkernel',
  agent: 'Alex',
  tags: ['core', 'cordis'],
  content: 'Provides dependency injection and reactive lifecycle plugins.'
})

// Read Note A and verify backlinks
const readA = memoryService.readNote('Architecture Strategy')
assert.ok(readA, 'Note A must be readable')
assert.strictEqual(readA.frontmatter.title, 'Architecture Strategy')
assert.deepStrictEqual(readA.frontmatter.tags, ['architecture', 'roadmap'])
assert.ok(readA.links.includes('Cordis Microkernel'), 'Must extract wikilink to Cordis Microkernel')
assert.ok(readA.links.includes('Dual-Loop Memory'), 'Must extract wikilink to Dual-Loop Memory')
assert.ok(readA.backlinks.includes('Dual-Loop Memory'), 'Dual-Loop Memory must appear as a backlink')

// Append to Note C
const updatedC = memoryService.appendNote('Cordis Microkernel', 'Service registry allows hot swapping.')
assert.ok(updatedC.content.includes('Service registry allows hot swapping.'))
console.log('[PASS] Vault note creation, frontmatter parsing, wikilinks, backlinks, and append verified.\n')

// 3. Vault Graph View Topology
console.log('[TEST 3] Testing Obsidian Vault graph topology...')
const graph = memoryService.getGraphData()
assert.ok(Array.isArray(graph.nodes), 'Graph must have nodes')
assert.ok(Array.isArray(graph.edges), 'Graph must have edges')
assert.ok(graph.nodes.length >= 3, 'Must have at least 3 nodes')

const nodeTitles = graph.nodes.map(n => n.id)
assert.ok(nodeTitles.includes('Architecture Strategy'))
assert.ok(nodeTitles.includes('Dual-Loop Memory'))
assert.ok(nodeTitles.includes('Cordis Microkernel'))

assert.ok(graph.edges.length >= 2, 'Must have graph edges linking notes')
console.log(`[PASS] Graph topology built: ${graph.nodes.length} nodes, ${graph.edges.length} edges.\n`)

// 4. Dual-Loop Memory Pipeline
console.log('[TEST 4] Testing Dual-Loop Memory: Loop 1 (Short-term) and Loop 2 (Long-term)...')
// Loop 1: Short-term episodic memory
const mem1 = memoryService.saveAgentMemory('Alex', 'active_branch', 'feature/phase-7-memory')
const mem2 = memoryService.saveAgentMemory('Alex', 'preferred_linter', 'biome')
assert.strictEqual(mem1.agentId, 'Alex')
assert.strictEqual(mem1.key, 'active_branch')

const alexMems = memoryService.getAgentMemories('Alex')
assert.strictEqual(alexMems.length, 2)
assert.strictEqual(alexMems[0].key, 'active_branch')
assert.strictEqual(alexMems[1].key, 'preferred_linter')
console.log('[PASS] Loop 1 (Short-term agent memory) saved and retrieved successfully.')

// Loop 2: Long-term cross-agent experience distillation
let expEvent = null
events.subscribe(ev => {
  if (ev.type === 'memory.experience_stored') expEvent = ev
})

const exp1 = memoryService.saveExperience({
  taskSummary: 'Deploy Playwright browser runner on Windows',
  strategy: 'Use native Microsoft Edge channel to bypass external binary download',
  whatWorked: 'Edge channel msedge starts fast without downloading 150MB chromium',
  whatFailed: 'Default chromium download failed due to proxy and permissions',
  lesson: 'Always specify channel: msedge on Windows environments for zero-install Playwright',
  feedback: 'Task finished with 100% reliability'
})

assert.ok(exp1.id.startsWith('exp-'))
assert.ok(expEvent, 'memory.experience_stored event must be emitted')
assert.strictEqual(expEvent.data.id, exp1.id)

const relevantExps = memoryService.getRelevantExperiences('Playwright browser on Windows', 2)
assert.ok(relevantExps.length > 0, 'Must retrieve relevant experiences')
assert.strictEqual(relevantExps[0].id, exp1.id)
assert.ok(relevantExps[0].lesson.includes('channel: msedge'))
console.log('[PASS] Loop 2 (Long-term experience distillation & retrieval) verified.\n')

// 5. Skill Promotion Engine
console.log('[TEST 5] Testing Skill Promotion Engine (skills/<name>/SKILL.md)...')
let skillEvent = null
events.subscribe(ev => {
  if (ev.type === 'skill.promoted') skillEvent = ev
})

const promoted = memoryService.promoteSkill({
  name: 'Playwright Fast Windows Automation',
  category: 'Browser Automation',
  agent: 'Kai',
  description: 'Automates browser workflows using native MS Edge on Windows.',
  procedure: '1. Launch browser with channel: msedge.\n2. Navigate to target URL.\n3. Snapshot page and extract title.',
  requiredTools: ['browser', 'file_reader']
})

assert.strictEqual(promoted.name, 'playwright-fast-windows-automation')
assert.ok(existsSync(promoted.path), 'SKILL.md must be written to disk')
assert.ok(skillEvent, 'skill.promoted event must be emitted')

const allSkills = memoryService.listSkills()
assert.ok(allSkills.length >= 1)
assert.strictEqual(allSkills[0].name, 'playwright-fast-windows-automation')
console.log(`[PASS] Skill promoted: ${promoted.name} generated at ${promoted.path}.\n`)

// 6. Office Gateway REST Endpoints for Memory, Graph, Notes, Experiences, Skills
console.log('[TEST 6] Testing Office Gateway REST API endpoints...')
const gatewayPort = 19177
const gatewayFork = rootCtx.plugin(OfficeGateway, { port: gatewayPort, host: '127.0.0.1' })
await new Promise(r => setTimeout(r, 200))

function requestJson(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: gatewayPort,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(JSON.stringify(body)) } : {})
      }
    }, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {}
          resolve({ status: res.statusCode, data: parsed })
        } catch (e) {
          resolve({ status: res.statusCode, raw: data })
        }
      })
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

// 6a. GET /api/memory/graph
const graphRes = await requestJson('GET', '/api/memory/graph')
assert.strictEqual(graphRes.status, 200)
assert.ok(graphRes.data.nodes.length >= 3)
assert.ok(graphRes.data.edges.length >= 2)
console.log(`[PASS] Gateway GET /api/memory/graph: ${graphRes.data.nodes.length} nodes returned.`)

// 6b. GET /api/memory/notes
const notesRes = await requestJson('GET', '/api/memory/notes?q=architecture')
assert.strictEqual(notesRes.status, 200)
assert.ok(notesRes.data.notes.length >= 1)
console.log(`[PASS] Gateway GET /api/memory/notes: searched notes successfully.`)

// 6c. POST /api/memory/notes
const newNoteRes = await requestJson('POST', '/api/memory/notes', {
  title: 'Incident Postmortem',
  agent: 'Nova',
  tags: ['postmortem', 'stability'],
  content: 'Analyzing unexpected regex loop in secret scrubber. See [[Dual-Loop Memory]].'
})
assert.strictEqual(newNoteRes.status, 201)
assert.strictEqual(newNoteRes.data.note.title, 'Incident Postmortem')
console.log(`[PASS] Gateway POST /api/memory/notes: created note '${newNoteRes.data.note.title}'.`)

// 6d. GET /api/memory/notes/:title
const readNoteRes = await requestJson('GET', '/api/memory/notes/Incident%20Postmortem')
assert.strictEqual(readNoteRes.status, 200)
assert.strictEqual(readNoteRes.data.note.title, 'Incident Postmortem')
console.log(`[PASS] Gateway GET /api/memory/notes/:title: retrieved note successfully.`)

// 6e. GET /api/memory/experiences
const expListRes = await requestJson('GET', '/api/memory/experiences?q=playwright')
assert.strictEqual(expListRes.status, 200)
assert.ok(expListRes.data.experiences.length >= 1)
console.log(`[PASS] Gateway GET /api/memory/experiences: retrieved experiences successfully.`)

// 6f. POST /api/memory/experiences
const newExpRes = await requestJson('POST', '/api/memory/experiences', {
  taskSummary: 'Python subagent timeout optimization',
  strategy: 'Set child process timeout to 3000ms with process.kill()',
  whatWorked: 'Avoided zombie processes and memory starvation',
  whatFailed: 'SIGINT hung on infinite loops',
  lesson: 'Use hard process.kill() on timeout in Windows child_process',
  feedback: 'Rock solid stability'
})
assert.strictEqual(newExpRes.status, 201)
assert.strictEqual(newExpRes.data.experience.strategy, 'Set child process timeout to 3000ms with process.kill()')
console.log(`[PASS] Gateway POST /api/memory/experiences: created experience record.`)

// 6g. GET /api/skills
const skillsRes = await requestJson('GET', '/api/skills')
assert.strictEqual(skillsRes.status, 200)
assert.ok(skillsRes.data.skills.length >= 1)
console.log(`[PASS] Gateway GET /api/skills: listed ${skillsRes.data.skills.length} skills.`)

// 6h. POST /api/skills/promote
const promoteRes = await requestJson('POST', '/api/skills/promote', {
  name: 'Safe Math Parser',
  category: 'Math & Logic',
  agent: 'Alex',
  description: 'Evaluates arithmetic expressions via recursive descent parser.',
  procedure: '1. Tokenize string.\n2. Parse expression with operator precedence.\n3. Return numerical result.',
  requiredTools: ['calculator']
})
assert.strictEqual(promoteRes.status, 201)
assert.strictEqual(promoteRes.data.skill.name, 'safe-math-parser')
console.log(`[PASS] Gateway POST /api/skills/promote: successfully promoted skill '${promoteRes.data.skill.name}'.\n`)

// 7. End-to-End Automated Memory Distillation from Task Completion
console.log('[TEST 7] Testing End-to-End Automated Task Distillation into Memory & Vault...')
const task = await rootCtx.officeTasks.runTask('Calculate compound interest on 5000 at 7 percent for 3 years')
assert.strictEqual(task.status, 'done')
assert.ok(task.evaluation.score >= 0.8)

// Verify experience stored in Loop 2
const taskExperiences = memoryService.getRelevantExperiences('compound interest', 2)
assert.ok(taskExperiences.length >= 1, 'Experience from task completion must be distilled into memory')
assert.ok(taskExperiences[0].taskSummary.includes('Calculate compound interest'))
console.log(`[PASS] Distilled task experience: id=${taskExperiences[0].id}, strategy='${taskExperiences[0].strategy}'`)

// Verify task note in Obsidian vault
const taskNote = memoryService.readNote(`Task ${task.id}`)
assert.ok(taskNote, 'Obsidian note for task execution must be created')
assert.strictEqual(taskNote.frontmatter.title, `Task ${task.id}`)
assert.ok(taskNote.content.includes('Execution Log'))
assert.ok(taskNote.links.includes('Office Architecture'))
console.log(`[PASS] Automated Obsidian note created in vault: title='${taskNote.title}'.\n`)

// Teardown
eventsFork.dispose()
rosterFork.dispose()
toolsFork.dispose()
tasksFork.dispose()
memoryFork.dispose()
gatewayFork.dispose()
memoryService.close()

// Clean up scratch dir
try {
  rmSync(testDir, { recursive: true, force: true })
} catch {}

console.log('=== ALL PHASE 7 ACCEPTANCE TESTS PASSED (100%) ===\n')
process.exit(0)
