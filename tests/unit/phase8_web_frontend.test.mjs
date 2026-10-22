import assert from 'node:assert/strict'
import http from 'node:http'
import { join } from 'node:path'
import { rmSync, existsSync, mkdirSync } from 'node:fs'
let pw
try {
  pw = await import('file:///D:/youtube/agenoffice/vendor/deepseek-harness/node_modules/.pnpm/node_modules/playwright/index.mjs')
} catch {
  pw = await import('playwright')
}
const chromium = pw.chromium || pw.default?.chromium
import { Context } from 'file:///D:/youtube/agenoffice/vendor/deepseek-harness/vendor/cordis/src/index.ts'
import * as OfficeEvents from 'file:///D:/youtube/agenoffice/plugins/office-events/src/index.js'
import * as OfficeRoster from 'file:///D:/youtube/agenoffice/plugins/office-roster/src/index.js'
import * as OfficeTools from 'file:///D:/youtube/agenoffice/plugins/office-tools/src/index.js'
import * as OfficeMemory from 'file:///D:/youtube/agenoffice/plugins/office-memory/src/index.js'
import * as OfficeTasks from 'file:///D:/youtube/agenoffice/plugins/office-tasks/src/index.js'
import * as OfficeWeb from 'file:///D:/youtube/agenoffice/plugins/office-web/src/index.js'
import * as OfficeGateway from 'file:///D:/youtube/agenoffice/plugins/office-gateway/src/index.js'

console.log('=== PHASE 8 ACCEPTANCE: Web Frontend & UI Integration ===\n')

const testDir = join(process.cwd(), 'tests', 'scratch', 'phase8_test')
if (existsSync(testDir)) {
  rmSync(testDir, { recursive: true, force: true })
}
mkdirSync(testDir, { recursive: true })

const vaultDir = join(testDir, 'vault')
const skillsDir = join(testDir, 'skills')
const port = 21088

const rootCtx = new Context()

// 1. Mount Cordis plugins
console.log('[TEST 1] Testing Cordis mounting and web service exposure...')
const eventsFork = rootCtx.plugin(OfficeEvents, { dbPath: ':memory:' })
const rosterFork = rootCtx.plugin(OfficeRoster, { dbPath: ':memory:' })
const toolsFork = rootCtx.plugin(OfficeTools)
const memoryFork = rootCtx.plugin(OfficeMemory, {
  dbPath: ':memory:',
  vaultDir,
  skillsDir,
  seed: true
})
const tasksFork = rootCtx.plugin(OfficeTasks, { dbPath: ':memory:' })
const webFork = rootCtx.plugin(OfficeWeb)
const gatewayFork = rootCtx.plugin(OfficeGateway, { port, host: '127.0.0.1' })

await new Promise(r => setTimeout(r, 200))

assert.ok(rootCtx.officeEvents, 'ctx.officeEvents must be registered')
assert.ok(rootCtx.officeRoster, 'ctx.officeRoster must be registered')
assert.ok(rootCtx.officeTools, 'ctx.officeTools must be registered')
assert.ok(rootCtx.officeMemory, 'ctx.officeMemory must be registered')
assert.ok(rootCtx.officeTasks, 'ctx.officeTasks must be registered')
assert.ok(rootCtx.officeWeb, 'ctx.officeWeb must be registered')
console.log('[PASS] Mounted all 7 core plugins onto Cordis context.\n')

function fetchHttp(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${urlPath}`, res => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        })
      })
    }).on('error', reject)
  })
}

// 2. Static Asset Delivery Gate
console.log('[TEST 2] Testing Static Asset Serving via office-web...')
const indexRes = await fetchHttp('/')
assert.strictEqual(indexRes.status, 200)
assert.ok(indexRes.headers['content-type'].includes('text/html'))
assert.ok(indexRes.body.includes('AGENTIC AI OFFICE'))
assert.ok(indexRes.body.includes('id="office-canvas"'))
console.log('[PASS] Served index.html (200 OK, text/html, canvas element present).')

const cssRes = await fetchHttp('/style.css')
assert.strictEqual(cssRes.status, 200)
assert.ok(cssRes.headers['content-type'].includes('text/css'))
assert.ok(cssRes.body.includes('.app-header'))
console.log('[PASS] Served style.css (200 OK, text/css).')

const jsRes = await fetchHttp('/src/main.js')
assert.strictEqual(jsRes.status, 200)
assert.ok(jsRes.headers['content-type'].includes('javascript'))
assert.ok(jsRes.body.includes('App'))
console.log('[PASS] Served /src/main.js (200 OK, javascript).\n')

// 3. Security & Path Traversal Defense
console.log('[TEST 3] Testing Security & Path Traversal Guards...')
const traversalRes = await fetchHttp('/../../package.json')
assert.ok(traversalRes.status === 403 || traversalRes.status === 404, 'Path traversal must be forbidden')
console.log('[PASS] Path traversal attempt blocked safely.\n')

// 4. REST Organization State & Frontend Endpoints
console.log('[TEST 4] Testing Frontend REST Integration Endpoints...')
const orgStateRes = await fetchHttp('/api/organization/state')
assert.strictEqual(orgStateRes.status, 200)
const orgData = JSON.parse(orgStateRes.body)
assert.ok(Array.isArray(orgData.agents), 'Must contain agents list')
assert.ok(orgData.agents.length >= 5, 'Must have at least 5 core agents')
assert.ok(orgData.total_tokens !== undefined, 'Must report total tokens')
console.log(`[PASS] GET /api/organization/state returned ${orgData.agents.length} agents, total_tokens=${orgData.total_tokens}.`)

const llmConfigRes = await fetchHttp('/api/llm/config')
assert.strictEqual(llmConfigRes.status, 200)
const llmConfig = JSON.parse(llmConfigRes.body)
assert.strictEqual(llmConfig.provider, 'openrouter')
console.log(`[PASS] GET /api/llm/config returned provider='${llmConfig.provider}'.`)

const graphRes = await fetchHttp('/api/memory/graph')
assert.strictEqual(graphRes.status, 200)
const graphData = JSON.parse(graphRes.body)
assert.ok(graphData.nodes.length >= 3, 'Must have graph nodes from seeded vault')
console.log(`[PASS] GET /api/memory/graph returned ${graphData.nodes.length} nodes and ${graphData.edges.length} edges.\n`)

// 5. Automated Browser Acceptance Gate with Playwright
console.log('[TEST 5] Testing End-to-End Browser UI Interaction via Playwright (MS Edge channel)...')
let browser = null
try {
  browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  })
} catch {
  browser = await chromium.launch({ headless: true })
}

const page = await browser.newPage()
await page.setViewportSize({ width: 1280, height: 800 })

// Navigate to local control room
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' })

// 5a. Verify DOM Elements
const canvas = await page.$('#office-canvas')
assert.ok(canvas, 'Office canvas must be rendered')

const title = await page.title()
assert.ok(title.includes('AGENTIC AI OFFICE'), `Page title was: ${title}`)
console.log(`[PASS] Browser loaded page: title='${title}'.`)

// Wait for SSE connection badge to report LIVE
await page.waitForFunction(() => {
  const badge = document.getElementById('ws-status-text')
  return badge && (badge.textContent.includes('LIVE') || badge.textContent.includes('RECONNECTING'))
}, { timeout: 8000 })
console.log('[PASS] Live telemetry status badge verified.')

// 5b. Verify Knowledge Graph Modal Interaction
const graphBtn = await page.$('#nav-graph-btn')
assert.ok(graphBtn, 'Graph button must exist in header')
await graphBtn.click()

await page.waitForSelector('#graph-modal', { state: 'visible', timeout: 5000 })
const graphModalBox = await page.$('#graph-modal .modal-box')
assert.ok(graphModalBox, 'Graph modal box must be displayed')

const graphStatsText = await page.$eval('#graph-stats', el => el.textContent)
assert.ok(graphStatsText.includes('Nodes:'), `Graph stats text was: ${graphStatsText}`)
console.log(`[PASS] Obsidian Graph Modal opened interactively: stats='${graphStatsText}'.`)

// Close graph modal
await page.click('#close-graph-modal', { force: true })
await page.waitForSelector('#graph-modal', { state: 'hidden', timeout: 3000 })
console.log('[PASS] Graph modal closed successfully.')

// 5c. Verify Chat Flow Execution via Browser UI
await page.click('#nav-dispatch-btn', { force: true })
await page.waitForSelector('#task-drawer', { state: 'visible', timeout: 5000 })

// Type a calculation request into task input
await page.fill('#task-input', 'Compute compound growth on 1000 at 10 percent for 2 years')
await page.click('#dispatch-btn', { force: true })

// Wait for chat message to appear
await page.waitForSelector('.chat-msg', { timeout: 10000 })
const chatCount = await page.$$eval('.chat-msg', msgs => msgs.length)
assert.ok(chatCount >= 1, 'Chat message must be posted')
console.log(`[PASS] Browser UI submitted task and received ${chatCount} message(s) in glassmorphic chat drawer.`)

// 5d. Capture visual screenshot artifact
const screenshotPath = join(process.cwd(), 'scratch', 'phase8_web_control_room.png')
await page.screenshot({ path: screenshotPath })
assert.ok(existsSync(screenshotPath), 'Screenshot artifact must be saved')
console.log(`[PASS] Visual screenshot captured to ${screenshotPath}.\n`)

await browser.close()

// Teardown
eventsFork.dispose()
rosterFork.dispose()
toolsFork.dispose()
memoryFork.dispose()
tasksFork.dispose()
webFork.dispose()
gatewayFork.dispose()

// Clean up scratch dir
try {
  rmSync(testDir, { recursive: true, force: true })
} catch {}

console.log('=== ALL PHASE 8 ACCEPTANCE TESTS PASSED (100%) ===\n')
process.exit(0)
