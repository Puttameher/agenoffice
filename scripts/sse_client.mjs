#!/usr/bin/env node
/**
 * scripts/sse_client.mjs
 *
 * Connects to the office gateway SSE endpoint (http://127.0.0.1:3081/api/events)
 * and prints events live to stdout with color-coded tags.
 * Supports optional --last-id flag to test replay.
 */

import http from 'node:http'

const port = process.env.OFFICE_PORT || 3081
const url = `http://127.0.0.1:${port}/api/events`

const args = process.argv.slice(2)
let lastEventId = null
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--last-id' && args[i + 1]) {
    lastEventId = args[i + 1]
    i++
  }
}

console.log(`[SSE Client] Connecting to ${url}${lastEventId ? ' with Last-Event-ID: ' + lastEventId : ''}...`)

const headers = {}
if (lastEventId) {
  headers['Last-Event-ID'] = lastEventId
}

const req = http.get(url, { headers }, (res) => {
  if (res.statusCode !== 200) {
    console.error(`[SSE Client] Connection failed with status code ${res.statusCode}`)
    process.exit(1)
  }

  console.log(`[SSE Client] Connected! Streaming events... (Ctrl+C to stop)\n`)

  let buffer = ''
  res.on('data', (chunk) => {
    buffer += chunk.toString()
    const lines = buffer.split('\n\n')
    buffer = lines.pop()

    for (const block of lines) {
      if (!block.trim() || block.startsWith(':')) {
        // Comment or heartbeat
        if (block.includes('heartbeat')) {
          console.log(`[HEARTBEAT] 💓 ${new Date().toISOString()}`)
        }
        continue
      }

      let eventId = ''
      let eventType = ''
      let eventData = ''

      for (const line of block.split('\n')) {
        if (line.startsWith('id: ')) eventId = line.slice(4).trim()
        else if (line.startsWith('event: ')) eventType = line.slice(7).trim()
        else if (line.startsWith('data: ')) eventData = line.slice(6).trim()
      }

      try {
        const parsed = JSON.parse(eventData)
        console.log(`[EVENT #${eventId}] [${eventType}] agent=${parsed.agent || '-'} taskId=${parsed.taskId || '-'}`)
        console.log(`  Data:`, JSON.stringify(parsed.data, null, 2))
      } catch {
        console.log(`[EVENT #${eventId}] [${eventType}]: ${eventData}`)
      }
    }
  })

  res.on('end', () => {
    console.log('[SSE Client] Stream closed by server.')
    process.exit(0)
  })
})

req.on('error', (err) => {
  console.error('[SSE Client] Request error:', err.message)
  process.exit(1)
})
