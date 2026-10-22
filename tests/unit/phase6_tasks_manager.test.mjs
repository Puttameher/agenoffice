import assert from 'node:assert/strict'
import http from 'node:http'
import { Context } from 'file:///D:/youtube/agenoffice/vendor/deepseek-harness/vendor/cordis/src/index.ts'
import * as OfficeEvents from 'file:///D:/youtube/agenoffice/plugins/office-events/src/index.js'
import * as OfficeRoster from 'file:///D:/youtube/agenoffice/plugins/office-roster/src/index.js'
import * as OfficeTools from 'file:///D:/youtube/agenoffice/plugins/office-tools/src/index.js'
import * as OfficeTasks from 'file:///D:/youtube/agenoffice/plugins/office-tasks/src/index.js'
import * as OfficeGateway from 'file:///D:/youtube/agenoffice/plugins/office-gateway/src/index.js'

console.log('=== PHASE 6 ACCEPTANCE: Manager Agent & Multi-Step Task Flow ===\n')

const rootCtx = new Context()

// 1. Mount Cordis plugins
console.log('[TEST 1] Testing Cordis mounting and task manager exposure...')
const eventsFork = rootCtx.plugin(OfficeEvents, { dbPath: ':memory:' })
const rosterFork = rootCtx.plugin(OfficeRoster, { dbPath: ':memory:' })
const toolsFork = rootCtx.plugin(OfficeTools, {})
const tasksFork = rootCtx.plugin(OfficeTasks, { dbPath: ':memory:' })

await new Promise(r => setTimeout(r, 100))

assert.ok(rootCtx.officeEvents, 'ctx.officeEvents must be registered')
assert.ok(rootCtx.officeRoster, 'ctx.officeRoster must be registered')
assert.ok(rootCtx.officeTools, 'ctx.officeTools must be registered')
assert.ok(rootCtx.officeTasks, 'ctx.officeTasks must be registered')
console.log('[PASS] Mounted OfficeEvents, OfficeRoster, OfficeTools, and OfficeTasks onto Cordis context.\n')

const tasksService = rootCtx.officeTasks
const events = rootCtx.officeEvents
const roster = rootCtx.officeRoster

// 2. Task Creation & Initialization
console.log('[TEST 2] Testing Task Creation & State Initialization...')
let taskStartedEvent = null
events.subscribe(ev => {
  if (ev.type === 'task.started') taskStartedEvent = ev
})

const task1 = tasksService.createTask('Compute compound interest for 1000 at 5% over 10 periods')
assert.ok(task1.id.startsWith('task-'))
assert.strictEqual(task1.status, 'pending')
assert.strictEqual(task1.executionState, 'pending')
assert.ok(taskStartedEvent, 'task.started event must be emitted')
assert.strictEqual(taskStartedEvent.data.taskId, task1.id)
console.log(`[PASS] Task created: id=${task1.id}, initial state='pending', task.started event verified.\n`)

// 3. Multi-Agent Decomposition & Planning
console.log('[TEST 3] Testing Decomposition & Multi-Agent Planning...')
const plannedTask1 = tasksService.planTask(task1.id)
assert.strictEqual(plannedTask1.executionState, 'planning')
assert.strictEqual(plannedTask1.assignedAgentId, 'coding')
assert.ok(plannedTask1.plan.length >= 2, 'Plan must contain multiple steps')

// Verify step assignments
const step1 = plannedTask1.plan[0]
assert.strictEqual(step1.agentId, 'manager')
assert.ok(step1.action.includes('architecture'))

const step2 = plannedTask1.plan[1]
assert.strictEqual(step2.agentId, 'coding')
assert.strictEqual(step2.tool, 'calculator')
console.log(`[PASS] Solo Task planned: assigned to Alex (Coding), tool='${step2.tool}', steps=${plannedTask1.plan.length}.`)

// Test Collaborative Team Planning
const task2 = tasksService.createTask('Collab team: Research market trends and write a python summary report')
const plannedTask2 = tasksService.planTask(task2.id)
assert.strictEqual(plannedTask2.assignedAgentId, 'coding')
assert.strictEqual(plannedTask2.collaboratingAgentId, 'knowledge')
assert.ok(plannedTask2.plan.some(p => p.agentId === 'knowledge'), 'Plan must involve knowledge agent')
console.log(`[PASS] Collaborative Task planned: Lead=${plannedTask2.assignedAgentId}, Peer Reviewer=${plannedTask2.collaboratingAgentId}.\n`)

// 4. Execution Pipeline & Subagent Step Logs
console.log('[TEST 4] Testing Multi-Step Subagent Execution & Tool Invocations...')
const executedTask1 = await tasksService.executeTask(task1.id)
assert.strictEqual(executedTask1.status, 'done')
assert.strictEqual(executedTask1.executionState, 'completed')
assert.ok(executedTask1.durationMs >= 0)

// Verify step logs in SQLite
const steps = tasksService.getTaskSteps(task1.id)
assert.strictEqual(steps.length, plannedTask1.plan.length)
for (const s of steps) {
  assert.strictEqual(s.status, 'completed')
  assert.ok(s.output, 'Step must produce output')
}
console.log(`[PASS] Executed all ${steps.length} steps in ${executedTask1.durationMs}ms. Step logs verified in SQLite.`)

// Verify tool usage in step 2
const mathStep = steps.find(s => s.toolUsed === 'calculator')
assert.ok(mathStep, 'Must execute calculator tool in step')
console.log(`[PASS] Calculator tool verified in step #${mathStep.stepNumber}: output='${mathStep.output}'.\n`)

// 5. Evaluation & Artifact Generation
console.log('[TEST 5] Testing Quality Evaluation & Structured Artifacts...')
assert.ok(executedTask1.evaluation, 'Task must contain evaluation object')
assert.strictEqual(executedTask1.evaluation.success, true)
assert.ok(executedTask1.evaluation.score >= 0.95, 'Evaluation score must be >= 0.95')

assert.ok(executedTask1.artifacts, 'Task must contain artifacts')
assert.ok(executedTask1.artifacts.summary, 'Must contain summary artifact')
assert.ok(executedTask1.artifacts.code, 'Must contain code artifact')
assert.ok(executedTask1.artifacts.chart, 'Must contain chart artifact')
console.log(`[PASS] Evaluated quality score: ${executedTask1.evaluation.score}. Artifacts: summary, code (${executedTask1.artifacts.code.language}), chart (${executedTask1.artifacts.chart.type}).\n`)

// 6. Participating Agents XP Award & Status Reset
console.log('[TEST 6] Testing Agent XP Progression & State Reset...')
const alex = roster.getAgent('coding')
assert.strictEqual(alex.status, 'idle', 'Agent must return to idle upon task completion')
assert.ok(alex.tasksCompleted >= 1, 'Alex tasks_completed must be incremented')
assert.ok(alex.xp >= 35, 'Alex XP must be incremented')
console.log(`[PASS] Agent Alex status reset to 'idle'. TasksCompleted=${alex.tasksCompleted}, XP=${alex.xp}, Level=${alex.level}.\n`)

// 7. Gateway REST API Integration
console.log('[TEST 7] Testing Gateway REST Endpoints for Tasks & Chat...')
const TEST_PORT = 3095
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

// GET /api/tasks
const listTasksRes = await httpRequest('GET', '/api/tasks')
assert.strictEqual(listTasksRes.status, 200)
assert.ok(Array.isArray(listTasksRes.body.tasks))
assert.ok(listTasksRes.body.tasks.length >= 2)
console.log(`[PASS] GET /api/tasks returned ${listTasksRes.body.tasks.length} tasks from SQLite database.`)

// GET /api/tasks/:id
const getTaskRes = await httpRequest('GET', `/api/tasks/${task1.id}`)
assert.strictEqual(getTaskRes.status, 200)
assert.strictEqual(getTaskRes.body.task.id, task1.id)
assert.ok(Array.isArray(getTaskRes.body.steps))
assert.strictEqual(getTaskRes.body.steps.length, steps.length)
console.log(`[PASS] GET /api/tasks/${task1.id} returned task details and all ${getTaskRes.body.steps.length} execution steps.`)

// POST /api/chat triggers task run via officeTasks
console.log('[TEST 8] Testing POST /api/chat end-to-end task execution...')
let chatFinishedEvent = null
events.subscribe(ev => {
  if (ev.type === 'task.finished') chatFinishedEvent = ev
})

const chatRes = await httpRequest('POST', '/api/chat', {
  message: 'Write a python script to calculate fibonacci sequence'
})
assert.strictEqual(chatRes.status, 200)
assert.ok(chatRes.body.taskId)
console.log(`[PASS] POST /api/chat initiated task: taskId=${chatRes.body.taskId}, route=${chatRes.body.route}.`)

// Wait for task to finish via setImmediate
let retries = 0
let finishedTask = null
while (retries < 20) {
  await new Promise(r => setTimeout(r, 200))
  finishedTask = tasksService.getTask(chatRes.body.taskId)
  if (finishedTask && finishedTask.status === 'done') break
  retries++
}

assert.ok(finishedTask, 'Task must be recorded in tasksService')
assert.strictEqual(finishedTask.status, 'done', 'Chat task must transition to done')
assert.strictEqual(finishedTask.executionState, 'completed')
assert.ok(finishedTask.artifacts.code, 'Must produce code artifact')
console.log(`[PASS] Chat task completed end-to-end: status='${finishedTask.status}', artifacts generated.\n`)

// Teardown
eventsFork.dispose()
rosterFork.dispose()
toolsFork.dispose()
tasksFork.dispose()
gatewayFork.dispose()

console.log('=== PHASE 6 ACCEPTANCE: ALL GATES PASSED! ===')
process.exit(0)
