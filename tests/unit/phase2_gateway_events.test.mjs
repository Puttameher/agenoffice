import assert from 'node:assert/strict'
import http from 'node:http'
import { Context } from 'file:///D:/youtube/agenoffice/vendor/deepseek-harness/vendor/cordis/src/index.ts'
import * as OfficeEvents from 'file:///D:/youtube/agenoffice/plugins/office-events/src/index.js'
import * as OfficeGateway from 'file:///D:/youtube/agenoffice/plugins/office-gateway/src/index.js'

console.log('=== PHASE 2 ACCEPTANCE: Event Gateway, Redaction & Replay ===')

const TEST_PORT = 3089
const rootCtx = new Context()

// Mount office-events
const eventsFork = rootCtx.plugin(OfficeEvents, { dbPath: ':memory:' })
// Mount office-gateway
const gatewayFork = rootCtx.plugin(OfficeGateway, { port: TEST_PORT, host: '127.0.0.1' })

// Wait for gateway server to bind and be ready
let ready = false
for (let i = 0; i < 30; i++) {
  try {
    await new Promise((resolve, reject) => {
      const r = http.get(`http://127.0.0.1:${TEST_PORT}/api/metrics`, res => {
        ready = true
        resolve()
      })
      r.on('error', reject)
    })
    break
  } catch {
    await new Promise(r => setTimeout(r, 50))
  }
}
assert.ok(ready, 'Gateway server must be listening')
console.log('[PASS] Gateway server is bound and ready on port', TEST_PORT)

// 1. Secret Redaction Test
console.log('\n[TEST 1] Secret Redaction Verification...')
const rawSecretEvent = {
  type: 'tool.called',
  taskId: 'task-sec-1',
  agent: 'Coding',
  data: {
    command: 'curl -H "Authorization: Bearer sk-or-v1-abcdef0123456789abcdef0123456789" https://api.com',
    groqKey: 'gsk_FAKE_KEY_FOR_TESTING_ONLY_NOT_REAL_00000000000000000000',
    secretToken: 'supersecretpassword123',
    normalText: 'safe text'
  }
}
const emitted = rootCtx.officeEvents.emit(rawSecretEvent)
console.log('[EVIDENCE] Emitted redacted event:', JSON.stringify(emitted.data, null, 2))

assert.ok(!JSON.stringify(emitted.data).includes('sk-or-v1-abcdef'), 'OpenAI/OpenRouter key must be redacted')
assert.ok(!JSON.stringify(emitted.data).includes('gsk_0gjV4BX'), 'Groq key must be redacted')
assert.equal(emitted.data.secretToken, '[REDACTED]', 'Secret field must be redacted')
assert.equal(emitted.data.normalText, 'safe text', 'Normal text must be preserved')
console.log('[PASS] Secret redaction gate passed!')

// 2. SSE Stream & POST /api/chat Acceptance Gate
console.log('\n[TEST 2] Live SSE Stream & Chat Lifecycle Gate...')

const receivedEvents = []
const sseReq = http.get(`http://127.0.0.1:${TEST_PORT}/api/events`, (res) => {
  assert.equal(res.statusCode, 200)
  assert.equal(res.headers['content-type'], 'text/event-stream')

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
        const parsed = JSON.parse(eventData)
        receivedEvents.push(parsed)
      } catch {}
    }
  })
})

await new Promise(r => setTimeout(r, 100))

// Post chat message
console.log('[ACTION] Sending POST /api/chat: {"message":"say hi in 5 words"}...')
const postData = JSON.stringify({ message: 'say hi in 5 words' })
const chatRes = await new Promise((resolve, reject) => {
  const req = http.request(`http://127.0.0.1:${TEST_PORT}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (res) => {
    let body = ''
    res.on('data', d => { body += d })
    res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }))
  })
  req.on('error', reject)
  req.write(postData)
  req.end()
})

console.log('[PASS] POST /api/chat response:', chatRes)
assert.equal(chatRes.status, 200)
assert.ok(chatRes.data.taskId, 'Response must contain taskId')
assert.equal(chatRes.data.route, 'direct', 'Initial route should be direct')

// Wait for async processing events to arrive over SSE
await new Promise(r => setTimeout(r, 300))

console.log(`[PASS] Received ${receivedEvents.length} events over live SSE stream:`)
for (const ev of receivedEvents) {
  console.log(`  - #${ev.id} [${ev.type}] agent=${ev.agent || '-'}`)
}

const eventTypes = receivedEvents.map(e => e.type)
assert.ok(eventTypes.includes('task.started'), 'Must receive task.started')
assert.ok(eventTypes.includes('route.decision'), 'Must receive route.decision')
assert.ok(eventTypes.includes('agent.status'), 'Must receive agent.status')
assert.ok(eventTypes.includes('task.step'), 'Must receive task.step')
assert.ok(eventTypes.includes('artifact.created'), 'Must receive artifact.created')
assert.ok(eventTypes.includes('task.finished'), 'Must receive task.finished')

// Close initial SSE client
sseReq.destroy()

// 3. Disconnect / Reconnect Replay Test using Last-Event-ID
console.log('\n[TEST 3] Disconnect / Reconnect Replay Test (Last-Event-ID)...')
const lastIdBeforeDisconnect = receivedEvents[receivedEvents.length - 1].id

// Emit 2 new events while client is disconnected
rootCtx.officeEvents.emit({
  type: 'agent.status',
  agent: 'Research',
  data: { status: 'idle', activity: 'standby' }
})
rootCtx.officeEvents.emit({
  type: 'artifact.created',
  agent: 'Knowledge',
  data: { kind: 'text', title: 'Offline Note', content: 'Saved while disconnected' }
})

// Reconnect with Last-Event-ID
console.log(`[ACTION] Reconnecting SSE client with Last-Event-ID: ${lastIdBeforeDisconnect}...`)
const replayedEvents = []
await new Promise((resolve, reject) => {
  const reconnectReq = http.get(`http://127.0.0.1:${TEST_PORT}/api/events`, {
    headers: { 'Last-Event-ID': String(lastIdBeforeDisconnect) }
  }, (res) => {
    assert.equal(res.statusCode, 200)
    let buffer = ''
    res.on('data', chunk => {
      buffer += chunk.toString()
      const blocks = buffer.split('\n\n')
      buffer = blocks.pop()
      for (const block of blocks) {
        if (!block.trim() || block.startsWith(':')) continue
        let eventData = ''
        for (const line of block.split('\n')) {
          if (line.startsWith('data: ')) eventData = line.slice(6).trim()
        }
        try {
          replayedEvents.push(JSON.parse(eventData))
          if (replayedEvents.length >= 2) {
            reconnectReq.destroy()
            resolve()
          }
        } catch {}
      }
    })
  })
  reconnectReq.on('error', (err) => {
    // If destroyed on purpose, resolve
    if (replayedEvents.length >= 2) resolve()
    else reject(err)
  })
})

console.log(`[PASS] Successfully replayed ${replayedEvents.length} missed events:`)
for (const ev of replayedEvents) {
  console.log(`  - Replayed #${ev.id} [${ev.type}] agent=${ev.agent}`)
  assert.ok(ev.id > lastIdBeforeDisconnect, `Replayed event id (${ev.id}) must be greater than lastId (${lastIdBeforeDisconnect})`)
}
assert.equal(replayedEvents.length, 2)
console.log('[PASS] Disconnect / Reconnect replay gate passed!')

// 4. Endpoints verification (/api/agents, /api/tasks, /api/metrics)
console.log('\n[TEST 4] Validating REST endpoints...')
async function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${TEST_PORT}${path}`, res => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(data) }))
    }).on('error', reject)
  })
}

const agentsRes = await getJson('/api/agents')
assert.equal(agentsRes.status, 200)
assert.ok(Array.isArray(agentsRes.json.agents))
assert.equal(agentsRes.json.agents.length, 7)
console.log('[PASS] /api/agents returns roster with 7 agents')

const tasksRes = await getJson('/api/tasks')
assert.equal(tasksRes.status, 200)
assert.ok(Array.isArray(tasksRes.json.tasks))
assert.equal(tasksRes.json.tasks[0].status, 'done')
console.log('[PASS] /api/tasks returns completed task')

const metricsRes = await getJson('/api/metrics')
assert.equal(metricsRes.status, 200)
assert.equal(metricsRes.json.metrics.tasksTotal, 1)
assert.equal(metricsRes.json.metrics.tasksSuccessful, 1)
console.log('[PASS] /api/metrics tracks completed tasks accurately')

// Teardown
console.log('\n[ACTION] Tearing down forks...')
await gatewayFork.dispose()
await eventsFork.dispose()

console.log('=== PHASE 2 ACCEPTANCE: ALL GATES PASSED ===')
process.exit(0)
