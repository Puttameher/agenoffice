import assert from 'node:assert/strict'
import http from 'node:http'
import { Context } from 'file:///D:/youtube/agenoffice/vendor/deepseek-harness/vendor/cordis/src/index.ts'
import * as OfficeEvents from 'file:///D:/youtube/agenoffice/plugins/office-events/src/index.js'
import * as OfficeRoster from 'file:///D:/youtube/agenoffice/plugins/office-roster/src/index.js'
import * as OfficeGateway from 'file:///D:/youtube/agenoffice/plugins/office-gateway/src/index.js'

console.log('=== PHASE 4 ACCEPTANCE: Office Roster, Desks, Dynamic Hiring & Lifecycle ===\n')

const rootCtx = new Context()

// 1. Mount office-events & office-roster in memory
console.log('[TEST 1] Testing Cordis mounting and service exposure...')
const eventsFork = rootCtx.plugin(OfficeEvents, { dbPath: ':memory:' })
const rosterFork = rootCtx.plugin(OfficeRoster, { dbPath: ':memory:' })

await new Promise(r => setTimeout(r, 100))

assert.ok(rootCtx.officeEvents, 'ctx.officeEvents must be registered')
assert.ok(rootCtx.officeRoster, 'ctx.officeRoster must be registered')
console.log('[PASS] Mounted OfficeEvents and OfficeRoster onto Cordis root context.\n')

const roster = rootCtx.officeRoster
const events = rootCtx.officeEvents

// 2. Test Core 5 Office Employees initialization
console.log('[TEST 2] Verifying 5 Core Office Employees initialization...')
const initialAgents = roster.listAgents()
assert.strictEqual(initialAgents.length, 5, 'Must have exactly 5 active core employees on boot')

const employeeIds = initialAgents.map(a => a.id).sort()
assert.deepStrictEqual(employeeIds, ['browser', 'coding', 'knowledge', 'manager', 'research'].sort())

const manager = roster.getAgent('manager')
assert.strictEqual(manager.name, 'Jordan')
assert.strictEqual(manager.deskId, 0)
assert.strictEqual(manager.permanent, true)
assert.strictEqual(manager.status, 'idle')

const alex = roster.getAgent('coding')
assert.strictEqual(alex.name, 'Alex')
assert.strictEqual(alex.deskId, 1)
assert.strictEqual(alex.color, '#3b82f6')
assert.strictEqual(alex.permanent, true)

const nova = roster.getAgent('research')
assert.strictEqual(nova.name, 'Nova')
assert.strictEqual(nova.deskId, 2)
assert.strictEqual(nova.color, '#a855f7')

const rio = roster.getAgent('knowledge')
assert.strictEqual(rio.name, 'Rio')
assert.strictEqual(rio.deskId, 3)
assert.strictEqual(rio.color, '#f97316')

const kai = roster.getAgent('browser')
assert.strictEqual(kai.name, 'Kai')
assert.strictEqual(kai.deskId, 4)
assert.strictEqual(kai.color, '#10b981')

console.log('[PASS] Verified 5 core employees: Jordan (Desk 0), Alex (Desk 1), Nova (Desk 2), Rio (Desk 3), Kai (Desk 4).\n')

// 3. Test Workstation Desk Allocation & Free List
console.log('[TEST 3] Testing Workstation Desk Allocation...')
const nextDesk = roster.findAvailableDesk()
assert.strictEqual(nextDesk, 5, 'Next available workstation desk must be #5')
console.log(`[PASS] Desk allocation checked: Desks 1-4 occupied by core team, Desk #${nextDesk} is next free.\n`)

// 4. Test Dynamic Specialist Hiring & Desk Assignment
console.log('[TEST 4] Testing Dynamic Specialist Hiring...')
let createdEventReceived = null
const unsubEvents = events.subscribe(ev => {
  if (ev.type === 'agent.created') {
    createdEventReceived = ev
  }
})

// Hire specialist 1: Mika (Content Agent)
const mika = roster.hireAgent({
  id: 'mika',
  name: 'Mika',
  role: 'Content & Documentation Specialist',
  description: 'Specializes in technical documentation and developer guides.',
  skills: ['technical_writing', 'documentation'],
  tools: ['file_reader', 'calculator'],
  permanent: false
})

assert.strictEqual(mika.name, 'Mika')
assert.strictEqual(mika.deskId, 5, 'Mika must be assigned to Desk 5')
assert.strictEqual(mika.permanent, false)
assert.ok(createdEventReceived, 'agent.created event must be emitted')
assert.strictEqual(createdEventReceived.data.name, 'Mika')
console.log(`[PASS] Hired specialist Mika -> Assigned Workstation Desk #${mika.deskId}. Event agent.created verified.`)

// Hire specialist 2: Zane (Design Agent)
const zane = roster.hireAgent({
  id: 'zane',
  name: 'Zane',
  role: 'UI/UX Design Specialist',
  description: 'Focuses on pixel-art layout and user interface mockups.',
  skills: ['ui_design', 'layout'],
  tools: ['calculator'],
  permanent: false
})
assert.strictEqual(zane.deskId, 6, 'Zane must be assigned to Desk 6')
console.log(`[PASS] Hired specialist Zane -> Assigned Workstation Desk #${zane.deskId}. All 6 workstations now occupied.`)

// Test workstation limit: All 6 occupied
const fullDesk = roster.findAvailableDesk()
assert.strictEqual(fullDesk, null, 'No workstations should be free after desks 1-6 are occupied')

let errorWhenFull = false
try {
  roster.hireAgent({ name: 'OverflowAgent', role: 'Tester' })
} catch (err) {
  errorWhenFull = true
  console.log('[PASS] Caught expected capacity error when desks are full:', err.message)
}
assert.ok(errorWhenFull, 'Must throw error when hiring with zero free desks')
console.log()

// 5. Test Status Transitions & Gamified Stats
console.log('[TEST 5] Testing Status Transitions & Gamified Stats...')
let statusEventReceived = null
events.subscribe(ev => {
  if (ev.type === 'agent.status' && ev.data?.agentId === 'coding') {
    statusEventReceived = ev
  }
})

const workingAlex = roster.setAgentStatus('coding', 'working', 'Executing test suites', 'task-999')
assert.strictEqual(workingAlex.status, 'working')
assert.strictEqual(workingAlex.activity, 'Executing test suites')
assert.strictEqual(workingAlex.currentTaskId, 'task-999')
assert.ok(statusEventReceived, 'agent.status event must be emitted')
assert.strictEqual(statusEventReceived.data.status, 'working')
assert.strictEqual(statusEventReceived.data.deskId, 1)

// Reset Alex to idle
roster.setAgentStatus('coding', 'idle', 'ready', null)

// Record task completion & XP
const leveledAlex = roster.recordTaskCompletion('coding', { success: true, xpGain: 120 })
assert.strictEqual(leveledAlex.tasksCompleted, 1)
assert.strictEqual(leveledAlex.xp, 120)
assert.strictEqual(leveledAlex.level, 2, 'Level must be Math.floor(120/100) + 1 = 2')
console.log(`[PASS] Agent status transition and leveling verified: Alex XP=${leveledAlex.xp}, Level=${leveledAlex.level}.\n`)

// 6. Test Subagent Session Linkage
console.log('[TEST 6] Testing Continuable Subagent Linkage...')
const subagentSession = await roster.createSubagentSession('research', 'Investigate DeepSeek Harness architecture', {
  parentSessionId: 'session-main-001',
  taskId: 'task-101'
})
assert.ok(subagentSession.childId.startsWith('subagent-research-'), 'Subagent childId must follow format')
assert.strictEqual(subagentSession.agentId, 'research')
assert.strictEqual(subagentSession.status, 'active')

const updatedNova = roster.getAgent('research')
assert.strictEqual(updatedNova.status, 'working')
assert.ok(updatedNova.activity.includes('Investigate DeepSeek'))
console.log(`[PASS] Continuable subagent session created: childId=${subagentSession.childId}, Nova status=${updatedNova.status}.\n`)

// 7. Test Archival & Workstation Desk Release
console.log('[TEST 7] Testing Specialist Archival & Workstation Release...')
// Protection test: cannot archive core permanent employee
let caughtPermanentError = false
try {
  roster.archiveAgent('manager')
} catch (err) {
  caughtPermanentError = true
  console.log('[PASS] Caught expected protection error on permanent employee:', err.message)
}
assert.ok(caughtPermanentError, 'Permanent employees must not be archivable')

// Archive Mika (was on Desk 5)
let archivedEventReceived = null
events.subscribe(ev => {
  if (ev.type === 'agent.archived') {
    archivedEventReceived = ev
  }
})

const archivedMika = roster.archiveAgent('mika')
assert.strictEqual(archivedMika.status, 'archived')
assert.strictEqual(archivedMika.deskId, null, 'Desk must be released on archival')
assert.ok(archivedEventReceived, 'agent.archived event must be emitted')
assert.strictEqual(archivedEventReceived.data.freedDeskId, 5)

// Check that Desk 5 is now available again!
const freedDesk = roster.findAvailableDesk()
assert.strictEqual(freedDesk, 5, 'Desk #5 must be available after archiving Mika')
console.log(`[PASS] Specialist Mika archived, Workstation Desk #5 successfully released and returned to pool.\n`)

// 8. Test Gateway REST API Integration
console.log('[TEST 8] Testing Gateway REST Endpoints for Roster...')
const TEST_PORT = 3093
const gatewayFork = rootCtx.plugin(OfficeGateway, { port: TEST_PORT, host: '127.0.0.1' })
await new Promise(r => setTimeout(r, 200))

function httpRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
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
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} })
        } catch {
          resolve({ status: res.statusCode, body: data })
        }
      })
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

// GET /api/agents
const listRes = await httpRequest('GET', '/api/agents')
assert.strictEqual(listRes.status, 200)
assert.ok(Array.isArray(listRes.body.agents))
// 5 core + 1 active visitor (Zane, since Mika was archived)
assert.strictEqual(listRes.body.agents.length, 6)
console.log(`[PASS] GET /api/agents returned ${listRes.body.agents.length} active agents.`)

// GET /api/agents/coding
const getAlexRes = await httpRequest('GET', '/api/agents/coding')
assert.strictEqual(getAlexRes.status, 200)
assert.strictEqual(getAlexRes.body.agent.name, 'Alex')
console.log(`[PASS] GET /api/agents/coding returned Alex (Level ${getAlexRes.body.agent.level}).`)

// POST /api/agents (Hire Taro onto freed desk 5)
const hireRes = await httpRequest('POST', '/api/agents', {
  id: 'taro',
  name: 'Taro',
  role: 'Operations & Reliability Specialist',
  tools: ['calculator'],
  permanent: false
})
assert.strictEqual(hireRes.status, 201)
assert.strictEqual(hireRes.body.agent.name, 'Taro')
assert.strictEqual(hireRes.body.agent.deskId, 5, 'Taro should take freed desk 5')
console.log(`[PASS] POST /api/agents hired Taro onto freed Desk #${hireRes.body.agent.deskId}.`)

// POST /api/agents/taro/status
const statusRes = await httpRequest('POST', '/api/agents/taro/status', {
  status: 'reviewing',
  activity: 'Auditing server reliability logs',
  taskId: 'task-777'
})
assert.strictEqual(statusRes.status, 200)
assert.strictEqual(statusRes.body.agent.status, 'reviewing')
console.log(`[PASS] POST /api/agents/taro/status updated status to '${statusRes.body.agent.status}'.`)

// DELETE /api/agents/zane
const deleteRes = await httpRequest('DELETE', '/api/agents/zane')
assert.strictEqual(deleteRes.status, 200)
assert.strictEqual(deleteRes.body.agent.status, 'archived')
console.log(`[PASS] DELETE /api/agents/zane archived specialist Zane.\n`)

// Teardown
eventsFork.dispose()
rosterFork.dispose()
gatewayFork.dispose()

console.log('=== PHASE 4 ACCEPTANCE: ALL GATES PASSED! ===')
process.exit(0)
