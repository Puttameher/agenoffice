import assert from 'node:assert/strict'
import http from 'node:http'
import { Context } from 'file:///D:/youtube/agenoffice/vendor/deepseek-harness/vendor/cordis/src/index.ts'
import * as OfficeEvents from 'file:///D:/youtube/agenoffice/plugins/office-events/src/index.js'
import * as OfficeRoster from 'file:///D:/youtube/agenoffice/plugins/office-roster/src/index.js'
import * as OfficeTools from 'file:///D:/youtube/agenoffice/plugins/office-tools/src/index.js'
import * as OfficeGateway from 'file:///D:/youtube/agenoffice/plugins/office-gateway/src/index.js'
import { SafeCalculator } from 'file:///D:/youtube/agenoffice/plugins/office-tools/src/index.js'

console.log('=== PHASE 5 ACCEPTANCE: Browser Agent (Kai) & Office Tools Pipeline ===\n')

const rootCtx = new Context()

// 1. Mount Cordis plugins
console.log('[TEST 1] Testing Cordis mounting and tool registry exposure...')
const eventsFork = rootCtx.plugin(OfficeEvents, { dbPath: ':memory:' })
const rosterFork = rootCtx.plugin(OfficeRoster, { dbPath: ':memory:' })
const toolsFork = rootCtx.plugin(OfficeTools, {})

await new Promise(r => setTimeout(r, 100))

assert.ok(rootCtx.officeEvents, 'ctx.officeEvents must be registered')
assert.ok(rootCtx.officeRoster, 'ctx.officeRoster must be registered')
assert.ok(rootCtx.officeTools, 'ctx.officeTools must be registered')
console.log('[PASS] Mounted OfficeEvents, OfficeRoster, and OfficeTools onto Cordis root context.\n')

const tools = rootCtx.officeTools
const events = rootCtx.officeEvents

// Verify 8 registered tools
const registeredTools = tools.listTools()
assert.strictEqual(registeredTools.length, 8, 'Must expose 8 office tools')
const toolNames = registeredTools.map(t => t.name).sort()
const expectedTools = [
  'browser_click',
  'browser_content',
  'browser_navigate',
  'browser_screenshot',
  'browser_type',
  'calculator',
  'file_reader',
  'python_runner'
].sort()
assert.deepStrictEqual(toolNames, expectedTools)
console.log('[PASS] Verified 8 registered tools:', toolNames.join(', '), '\n')

// 2. Safe Calculator Tool
console.log('[TEST 2] Testing Safe Math Calculator...')
// Test AST-free mathematical parser directly
const calc1 = SafeCalculator.evaluate('120 * (1 + 0.05) ^ 3')
assert.ok(Math.abs(calc1 - 138.915) < 0.001)

const calc2 = SafeCalculator.evaluate('sqrt(144) + round(pi * 10)')
assert.strictEqual(calc2, 12 + 31)

// Test via execute pipeline with events
let toolCallEvent = null
let toolResultEvent = null
events.subscribe(ev => {
  if (ev.type === 'tool.call') toolCallEvent = ev
  if (ev.type === 'tool.result') toolResultEvent = ev
})

const calcExec = await tools.execute('calculator', { expression: '2 ^ 10 + 50' }, { agent: 'Alex', taskId: 'task-c1' })
assert.strictEqual(calcExec.success, true)
assert.strictEqual(calcExec.result.result, 1074)
assert.ok(toolCallEvent, 'tool.call event must be emitted')
assert.strictEqual(toolCallEvent.data.tool, 'calculator')
assert.strictEqual(toolCallEvent.agent, 'Alex')
assert.ok(toolResultEvent, 'tool.result event must be emitted')
assert.strictEqual(toolResultEvent.data.result.result, 1074)

// Zero division error check
let caughtDivZero = false
try {
  SafeCalculator.evaluate('100 / 0')
} catch (e) {
  caughtDivZero = true
  assert.ok(e.message.includes('Division by zero'))
}
assert.ok(caughtDivZero, 'Must catch division by zero')
console.log('[PASS] Safe Calculator verified with operator precedence, math functions, and event dispatch.\n')

// 3. Subprocess Python Runner Tool (Alex)
console.log('[TEST 3] Testing Python Runner in safe subprocess...')
const pythonScript = `
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a

print(f"Fibonacci(10): {fibonacci(10)}")
`
const pyRes = await tools.execute('python_runner', { code: pythonScript }, { agent: 'Alex', taskId: 'task-p1' })
assert.strictEqual(pyRes.success, true)
assert.ok(pyRes.result.stdout.includes('Fibonacci(10): 55'))
assert.strictEqual(pyRes.result.exitCode, 0)
assert.ok(pyRes.result.durationMs >= 0)
console.log(`[PASS] Python Runner executed in ${pyRes.durationMs}ms, stdout: '${pyRes.result.stdout}'.`)

// Test dangerous command rejection
let caughtForbidden = false
try {
  await tools.execute('python_runner', { code: 'import os; shutdown /s /t 0' }, { agent: 'Alex' })
} catch (err) {
  caughtForbidden = true
  console.log('[PASS] Caught expected security policy violation:', err.message)
}
assert.ok(caughtForbidden, 'Must reject forbidden system commands')
console.log()

// 4. Safe File Reader Tool
console.log('[TEST 4] Testing Safe File Reader & Path Traversal Guard...')
const fileRes = await tools.execute('file_reader', { path: 'README.md' }, { agent: 'Jordan' })
assert.strictEqual(fileRes.success, true)
assert.ok(fileRes.result.content.length > 50)

// Test path traversal rejection
let caughtTraversal = false
try {
  await tools.execute('file_reader', { path: '../../../../windows/system.ini' }, { agent: 'Jordan' })
} catch (err) {
  caughtTraversal = true
  console.log('[PASS] Caught expected path traversal block:', err.message)
}
assert.ok(caughtTraversal, 'Must block directory traversal attempts')
console.log()

// 5. Playwright Browser Automation Tool (Kai)
console.log('[TEST 5] Testing Playwright Browser Tool (Kai)...')

// A: Navigate to a responsive HTML fixture
const testHtml = `data:text/html,<!DOCTYPE html>
<html>
<head><title>Office AI Control Room</title></head>
<body>
  <h1 id="headline">AI Agent Workstation</h1>
  <p id="desc">Active browser automation testing</p>
  <input id="agent-input" type="text" value="" />
  <button id="submit-btn" onclick="document.getElementById('desc').innerText = 'Action Verified!'">Verify</button>
</body>
</html>`

const navRes = await tools.execute('browser_navigate', { url: testHtml }, { agent: 'Kai', taskId: 'task-b1' })
assert.strictEqual(navRes.success, true)
assert.strictEqual(navRes.result.title, 'Office AI Control Room')
console.log(`[PASS] Browser navigated to fixture page: title='${navRes.result.title}'.`)

// B: Extract page content
const contentRes = await tools.execute('browser_content', {}, { agent: 'Kai' })
assert.strictEqual(contentRes.success, true)
assert.ok(contentRes.result.text.includes('AI Agent Workstation'))
assert.ok(contentRes.result.text.includes('Active browser automation'))
console.log('[PASS] browser_content extracted text successfully.')

// C: Type into input element
const typeRes = await tools.execute('browser_type', {
  selector: '#agent-input',
  text: 'Kai Automated Input 2026'
}, { agent: 'Kai' })
assert.strictEqual(typeRes.success, true)
assert.strictEqual(typeRes.result.currentValue, 'Kai Automated Input 2026')
console.log(`[PASS] browser_type filled input value='${typeRes.result.currentValue}'.`)

// D: Click button to verify DOM interaction
const clickRes = await tools.execute('browser_click', { selector: '#submit-btn' }, { agent: 'Kai' })
assert.strictEqual(clickRes.success, true)

const updatedContent = await tools.execute('browser_content', { selector: '#desc' }, { agent: 'Kai' })
assert.strictEqual(updatedContent.result.text, 'Action Verified!')
console.log('[PASS] browser_click verified DOM mutation: text="Action Verified!".')

// E: Capture screenshot
const screenshotPath = 'scratch/test_kai_screenshot.png'
const shotRes = await tools.execute('browser_screenshot', { path: screenshotPath }, { agent: 'Kai' })
assert.strictEqual(shotRes.success, true)
assert.ok(shotRes.result.sizeBytes > 1000, 'Screenshot buffer must have non-zero size')
assert.ok(shotRes.result.base64, 'Screenshot must return base64 data')
console.log(`[PASS] browser_screenshot captured PNG (${shotRes.result.sizeBytes} bytes) to ${shotRes.result.savedPath}.\n`)

// 6. Gateway REST Tool Execution
console.log('[TEST 6] Testing Gateway REST Tool Endpoints...')
const TEST_PORT = 3094
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

// GET /api/tools
const getToolsRes = await httpRequest('GET', '/api/tools')
assert.strictEqual(getToolsRes.status, 200)
assert.strictEqual(getToolsRes.body.tools.length, 8)
console.log(`[PASS] GET /api/tools returned ${getToolsRes.body.tools.length} available tools.`)

// POST /api/tools/execute (Calculator)
const execCalcRes = await httpRequest('POST', '/api/tools/execute', {
  tool: 'calculator',
  params: { expression: '50 * 4 + 10' },
  agent: 'Alex'
})
assert.strictEqual(execCalcRes.status, 200)
assert.strictEqual(execCalcRes.body.result.result, 210)
console.log(`[PASS] POST /api/tools/execute ran calculator: result=${execCalcRes.body.result.result}.`)

// POST /api/tools/execute (Browser Content)
const execBrowserRes = await httpRequest('POST', '/api/tools/execute', {
  tool: 'browser_content',
  params: { selector: '#headline' },
  agent: 'Kai'
})
assert.strictEqual(execBrowserRes.status, 200)
assert.strictEqual(execBrowserRes.body.result.text, 'AI Agent Workstation')
console.log(`[PASS] POST /api/tools/execute ran browser_content: text='${execBrowserRes.body.result.text}'.\n`)

// Teardown
await tools.dispose()
eventsFork.dispose()
rosterFork.dispose()
toolsFork.dispose()
gatewayFork.dispose()

console.log('=== PHASE 5 ACCEPTANCE: ALL GATES PASSED! ===')
process.exit(0)
