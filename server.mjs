import { Context } from 'file:///D:/youtube/agenoffice/vendor/deepseek-harness/vendor/cordis/src/index.ts'
import * as OfficeEvents from 'file:///D:/youtube/agenoffice/plugins/office-events/src/index.js'
import * as OfficeRoster from 'file:///D:/youtube/agenoffice/plugins/office-roster/src/index.js'
import * as OfficeRouter from 'file:///D:/youtube/agenoffice/plugins/office-router/src/index.js'
import * as OfficeTools from 'file:///D:/youtube/agenoffice/plugins/office-tools/src/index.js'
import * as OfficeMemory from 'file:///D:/youtube/agenoffice/plugins/office-memory/src/index.js'
import * as OfficeTasks from 'file:///D:/youtube/agenoffice/plugins/office-tasks/src/index.js'
import * as OfficeWeb from 'file:///D:/youtube/agenoffice/plugins/office-web/src/index.js'
import * as OfficeGateway from 'file:///D:/youtube/agenoffice/plugins/office-gateway/src/index.js'

const port = Number(process.env.OFFICE_PORT || process.env.PORT || 3081)
const host = process.env.HOST || '127.0.0.1'

console.log(`[AgenOffice] Starting autonomous workplace server on http://${host}:${port} ...`)

const ctx = new Context()

// Register Core Plugins
ctx.plugin(OfficeEvents)
ctx.plugin(OfficeRoster)
ctx.plugin(OfficeRouter)
ctx.plugin(OfficeTools)
ctx.plugin(OfficeMemory, { seed: true })
ctx.plugin(OfficeTasks)
ctx.plugin(OfficeWeb)
ctx.plugin(OfficeGateway, { port, host })

console.log(`[AgenOffice] ========================================================`)
console.log(`[AgenOffice] Control Room UI is LIVE at: http://${host}:${port}/`)
console.log(`[AgenOffice] Press Ctrl+C to terminate`)
console.log(`[AgenOffice] ========================================================`)

// Keep event loop alive
process.on('SIGINT', () => {
  console.log('[AgenOffice] Shutting down...')
  process.exit(0)
})
