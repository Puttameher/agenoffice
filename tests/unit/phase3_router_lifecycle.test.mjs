import assert from 'node:assert/strict'
import http from 'node:http'
import { Context } from 'file:///D:/youtube/agenoffice/vendor/deepseek-harness/vendor/cordis/src/index.ts'
import * as OfficeEvents from 'file:///D:/youtube/agenoffice/plugins/office-events/src/index.js'
import * as OfficeRouter from 'file:///D:/youtube/agenoffice/plugins/office-router/src/index.js'
import * as OfficeGateway from 'file:///D:/youtube/agenoffice/plugins/office-gateway/src/index.js'
import {
  JevBackend,
  LlmFallbackBackend,
  applyEscalationPolicy,
  ShadowEvaluator,
  AuthenticationError,
  ROUTE_DIRECT,
  ROUTE_TOOL,
  ROUTE_MANAGER
} from 'file:///D:/youtube/agenoffice/plugins/office-router/src/index.js'

console.log('=== PHASE 3 ACCEPTANCE: Router, Jev / Fallback, Escalation & Gateway Wiring ===\n')

const rootCtx = new Context()

// 1. Mount office-events & office-router in memory
console.log('[TEST 1] Testing Cordis mounting and service exposure...')
const eventsFork = rootCtx.plugin(OfficeEvents, { dbPath: ':memory:' })
const routerFork = rootCtx.plugin(OfficeRouter, { dbPath: ':memory:', confidenceThreshold: 0.70 })

await new Promise(r => setTimeout(r, 100))

assert.ok(rootCtx.officeEvents, 'ctx.officeEvents must be registered')
assert.ok(rootCtx.officeRouter, 'ctx.officeRouter must be registered')
console.log('[PASS] Mounted OfficeEvents and OfficeRouter onto Cordis root context.\n')

// 2. Test Jev Backend Authentication error handling and Fallback
console.log('[TEST 2] Testing Jev authentication error handling & fallback...')
const badJev = new JevBackend({ apiKey: 'invalid-key-test', baseUrl: 'https://api.typesafe.ai' })
let caughtAuthError = false
try {
  await badJev.evaluate({ message: 'test' })
} catch (err) {
  if (err instanceof AuthenticationError || err.name === 'AuthenticationError') {
    caughtAuthError = true
    console.log('[PASS] Caught expected AuthenticationError from unauthorized JevBackend:', err.message)
  }
}
assert.ok(caughtAuthError, 'JevBackend must throw AuthenticationError when unauthorized')

const fallback = new LlmFallbackBackend()
const fallbackRes = await fallback.evaluate({ message: 'Hello assistant' })
assert.ok(fallbackRes.route, 'Fallback must produce a valid route')
assert.ok(typeof fallbackRes.confidence === 'number', 'Fallback must provide confidence')
console.log(`[PASS] Fallback backend evaluated successfully: route=${fallbackRes.route}, conf=${fallbackRes.confidence.toFixed(2)}\n`)

// 3. Test Escalation Policy
console.log('[TEST 3] Testing Escalation Policy rules...')
// A: Low confidence direct -> tool
const lowConfDirect = {
  route: ROUTE_DIRECT,
  confidence: 0.55,
  probabilities: { direct: 0.55, tool: 0.30, manager: 0.15 },
  riskyAction: false,
  multiStep: false
}
const esc1 = applyEscalationPolicy(lowConfDirect, 0.70)
assert.equal(esc1.route, ROUTE_TOOL, 'Low confidence DIRECT must escalate to TOOL')
assert.equal(esc1.escalated, true, 'Escalated flag must be true')
console.log('[PASS] Escalation rule 1 passed (Low conf DIRECT -> TOOL):', esc1.escalationReason)

// B: Low confidence tool -> manager
const lowConfTool = {
  route: ROUTE_TOOL,
  confidence: 0.60,
  probabilities: { direct: 0.10, tool: 0.60, manager: 0.30 },
  riskyAction: false,
  multiStep: false
}
const esc2 = applyEscalationPolicy(lowConfTool, 0.70)
assert.equal(esc2.route, ROUTE_MANAGER, 'Low confidence TOOL must escalate to MANAGER')
assert.equal(esc2.escalated, true)
console.log('[PASS] Escalation rule 2 passed (Low conf TOOL -> MANAGER):', esc2.escalationReason)

// C: Risky action -> manager
const riskyDirect = {
  route: ROUTE_DIRECT,
  confidence: 0.99,
  probabilities: { direct: 0.99, tool: 0.01, manager: 0.00 },
  riskyAction: true,
  multiStep: false
}
const esc3 = applyEscalationPolicy(riskyDirect, 0.70)
assert.equal(esc3.route, ROUTE_MANAGER, 'Risky action must immediately escalate to MANAGER')
assert.equal(esc3.escalated, true)
console.log('[PASS] Escalation rule 3 passed (Risky action -> MANAGER):', esc3.escalationReason)

// 4. Test SQLite Decision Storage
console.log('\n[TEST 4] Testing SQLite decision logging...')
const routedDecision = await rootCtx.officeRouter.route('calculate 450 * 2', { taskId: 'task-test-math' })
assert.ok(routedDecision, 'Router must return a decision')

const loggedDecisions = rootCtx.officeRouter.db.prepare('SELECT * FROM office_decisions').all()
assert.ok(loggedDecisions.length >= 1, 'SQLite table office_decisions must contain stored records')
const lastDecision = loggedDecisions[loggedDecisions.length - 1]
assert.equal(lastDecision.prompt, 'calculate 450 * 2')
console.log(`[PASS] SQLite stored decision: id=${lastDecision.id}, route=${lastDecision.route}, conf=${lastDecision.confidence}\n`)

// 5. Test Gateway Integration & SSE Event Emission with Router
console.log('[TEST 5] Testing Gateway Wiring & Dynamic Routing over SSE...')
const TEST_PORT = 3091
const gatewayFork = rootCtx.plugin(OfficeGateway, { port: TEST_PORT, host: '127.0.0.1' })

// Wait for gateway to bind
for (let i = 0; i < 30; i++) {
  try {
    await new Promise((resolve, reject) => {
      const r = http.get(`http://127.0.0.1:${TEST_PORT}/api/metrics`, () => resolve())
      r.on('error', reject)
    })
    break
  } catch {
    await new Promise(r => setTimeout(r, 50))
  }
}
console.log('[INFO] Gateway server listening on port', TEST_PORT)

const sseEvents = []
const sseReq = http.get(`http://127.0.0.1:${TEST_PORT}/api/events`, (res) => {
  let buffer = ''
  res.on('data', chunk => {
    buffer += chunk.toString()
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop()
    for (const block of blocks) {
      if (!block.trim() || block.startsWith(':')) continue
      let eventType = ''
      let eventData = ''
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) eventType = line.slice(7).trim()
        if (line.startsWith('data: ')) eventData = line.slice(6).trim()
      }
      try {
        sseEvents.push(JSON.parse(eventData))
      } catch {}
    }
  })
})

await new Promise(r => setTimeout(r, 100))

// Post complex request to /api/chat
const postData = JSON.stringify({ message: 'Build an end-to-end Python pipeline, run tests and summarize' })
const chatRes = await new Promise((resolve, reject) => {
  const req = http.request(`http://127.0.0.1:${TEST_PORT}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (res) => {
    let raw = ''
    res.on('data', c => { raw += c })
    res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }))
  })
  req.on('error', reject)
  req.write(postData)
  req.end()
})

console.log('[PASS] POST /api/chat returned:', chatRes.body)
assert.equal(chatRes.status, 200)
assert.ok(chatRes.body.taskId)
assert.equal(chatRes.body.route, ROUTE_MANAGER, 'Complex task must route to manager')

// Wait for SSE events
await new Promise(r => setTimeout(r, 400))
sseReq.destroy()

const routeDecisionEvent = sseEvents.find(e => e.type === 'route.decision')
assert.ok(routeDecisionEvent, 'Gateway must emit route.decision event')
assert.equal(routeDecisionEvent.agent, 'Router')
assert.equal(routeDecisionEvent.data.route, ROUTE_MANAGER)
console.log('[PASS] Verified route.decision event over SSE stream:', {
  agent: routeDecisionEvent.agent,
  route: routeDecisionEvent.data.route,
  confidence: routeDecisionEvent.data.confidence,
  backend: routeDecisionEvent.data.backend
})

// Teardown
eventsFork.dispose()
routerFork.dispose()
gatewayFork.dispose()

console.log('\n=== PHASE 3 ACCEPTANCE: ALL UNIT & INTEGRATION GATES PASSED! ===')
process.exit(0)
