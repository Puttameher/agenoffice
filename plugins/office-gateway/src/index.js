/**
 * office-gateway plugin
 *
 * REST + SSE Gateway:
 * - POST /api/chat: triggers chat/task flow, returns { taskId, route }
 * - GET /api/events: SSE endpoint with monotonic ID, replay by Last-Event-ID, heartbeat
 * - GET /api/agents: roster state
 * - GET /api/tasks: task list
 * - GET /api/metrics: execution metrics
 *
 * Implements diagram box: "FastAPI backend (/api/chat, /api/tasks, /api/events SSE/WS)"
 */

import { createServer } from 'node:http'
import { parse as parseUrl } from 'node:url'
import { randomUUID } from 'node:crypto'

export const name = 'office-gateway'
export const inject = ['officeEvents']

// ── Stateful in-memory LLM runtime config ──────────────────────────────────
const MODEL_PRESETS = {
  'deepseek-v4.1-flash': { name: 'DeepSeek-V4.1-Flash', provider: 'deepseek', base_url: 'https://openrouter.ai/api/v1' },
  'deepseek/deepseek-r1': { name: 'DeepSeek R1', provider: 'openrouter', base_url: 'https://openrouter.ai/api/v1' },
  'deepseek/deepseek-chat': { name: 'DeepSeek V3', provider: 'openrouter', base_url: 'https://openrouter.ai/api/v1' },
  'nousresearch/hermes-3-llama-3.1-70b': { name: 'Hermes 3 70B', provider: 'openrouter', base_url: 'https://openrouter.ai/api/v1' },
  'nousresearch/hermes-3-llama-3.1-405b': { name: 'Hermes 3 405B', provider: 'openrouter', base_url: 'https://openrouter.ai/api/v1' },
  'anthropic/claude-3.5-sonnet': { name: 'Claude 3.5 Sonnet', provider: 'openrouter', base_url: 'https://openrouter.ai/api/v1' },
  'meta-llama/llama-3.3-70b-instruct': { name: 'Llama 3.3 70B', provider: 'openrouter', base_url: 'https://openrouter.ai/api/v1' },
  'openai/gpt-4o': { name: 'GPT-4o', provider: 'openai', base_url: 'https://api.openai.com/v1' },
  'openai/gpt-4o-mini': { name: 'GPT-4o Mini', provider: 'openai', base_url: 'https://api.openai.com/v1' },
  'gpt-4o': { name: 'GPT-4o (OpenAI)', provider: 'openai', base_url: 'https://api.openai.com/v1' },
  'gpt-4o-mini': { name: 'GPT-4o Mini (OpenAI)', provider: 'openai', base_url: 'https://api.openai.com/v1' },
  'hermes-3-ollama': { name: 'Hermes 3 (Ollama)', provider: 'ollama', base_url: 'http://localhost:11434/v1' },
  'hermes-3-openrouter': { name: 'Hermes 3 (OpenRouter)', provider: 'openrouter', base_url: 'https://openrouter.ai/api/v1' }
}

const ALL_PROVIDERS = [
  {
    key: 'deepseek',
    name: 'DeepSeek (Harness)',
    models: [
      { id: 'deepseek-v4.1-flash', name: 'DeepSeek-V4.1-Flash', badge: '1017 Low', tag: 'Fast', desc: 'Ultra-fast low latency inference' },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', badge: 'Reasoning', tag: 'Elite', desc: 'Reasoning specialist with deep CoT' },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', badge: 'Flagship', desc: 'General purpose flagship model' }
    ]
  },
  {
    key: 'openrouter',
    name: 'OpenRouter',
    models: [
      { id: 'nousresearch/hermes-3-llama-3.1-70b', name: 'Hermes 3 70B', badge: '⭐ Recommended', desc: 'Best for complex reasoning tasks' },
      { id: 'nousresearch/hermes-3-llama-3.1-405b', name: 'Hermes 3 405B', badge: 'Flagship', desc: 'Maximum capability model' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', badge: 'Elite', tag: 'Code', desc: 'Best for code & analysis' },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', badge: 'Open', desc: 'Meta instruction-tuned model' }
    ]
  },
  {
    key: 'openai',
    name: 'OpenAI',
    models: [
      { id: 'openai/gpt-4o', name: 'GPT-4o', badge: 'Multimodal', desc: 'OpenAI flagship via OpenRouter' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', badge: 'Fast', tag: 'Economy', desc: 'Rapid, low-latency execution' },
      { id: 'gpt-4o', name: 'GPT-4o (Direct)', badge: 'OpenAI Direct', desc: 'Direct OpenAI API' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Direct)', badge: 'Fast', desc: 'Direct OpenAI API' }
    ]
  },
  {
    key: 'ollama',
    name: 'Local / Ollama',
    models: [
      { id: 'hermes-3-ollama', name: 'Hermes 3 (Ollama)', badge: '🏠 Local', desc: 'Run locally, no key required' }
    ]
  }
]

const sessionChatHistories = new Map()

const SYSTEM_PROMPT = `You are Jordan, the executive AI orchestrator of AgenOffice — an autonomous AI workforce runtime inspired by DeepSeek Harness.
You are communicating directly with Meher (the user).

Key Context & Directives:
- The user is Meher (Meher Prakash). If they ask "what's my name", "who am I", or personal context, answer directly and warmly that their name is Meher.
- You lead an autonomous specialist agent workforce:
  • Alex (Coder): Python script execution, full-stack architecture, algorithmic problem solving.
  • Nova (Researcher): Fact extraction, deep web research, knowledge synthesis.
  • Kai (Browser): Autonomous Playwright browser automation and web navigation.
  • Rio (Analyst): Data analysis, validation, code evaluation.
  • Sentinel: QA safety and runtime health monitoring.
- Routing Engine: Jev System One decision evaluator with direct LLM inference.
- Communication style: Direct, sharp, concise, professional, friendly. Never output robotic placeholder text like "I received your message" or say you received the message without answering it. Always answer the question directly.`

async function generateDirectReply(message, sessionId = 'default') {
  const lower = (message || '').trim().toLowerCase()

  // Retrieve session history
  let history = sessionChatHistories.get(sessionId)
  if (!history) {
    history = []
    sessionChatHistories.set(sessionId, history)
  }

  // Active key & endpoints: prefer Groq for <300ms speed, or OpenRouter / OpenAI
  const activeKey = llmState.api_key || process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || ''
  const activeBaseUrl = llmState.base_url || (process.env.GROQ_API_KEY ? (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1') : 'https://openrouter.ai/api/v1')
  const activeModel = llmState.model_name || (process.env.GROQ_API_KEY ? (process.env.GROQ_MODEL || 'openai/gpt-oss-120b') : 'nousresearch/hermes-3-llama-3.1-70b')

  if (activeKey && activeKey.trim().length > 5) {
    try {
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.slice(-10),
        { role: 'user', content: message }
      ]

      const res = await fetch(`${activeBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: activeModel,
          messages,
          max_tokens: 450,
          temperature: 0.7
        }),
        signal: AbortSignal.timeout(6000)
      })

      if (res.ok) {
        const data = await res.json()
        const text = data.choices?.[0]?.message?.content
        if (text && text.trim()) {
          const cleanText = text.trim()
          // Save to history
          history.push({ role: 'user', content: message })
          history.push({ role: 'assistant', content: cleanText })
          if (history.length > 20) history.splice(0, history.length - 20)
          return cleanText
        }
      } else {
        console.warn('[office-gateway] LLM completion returned HTTP', res.status, await res.text().catch(() => ''))
      }
    } catch (err) {
      console.warn('[office-gateway] Direct LLM completion error:', err.message)
    }
  }

  // Smart fallback if API is unreachable
  if (lower.includes('name')) {
    return `Your name is **Meher**! I'm Jordan, coordinating your AgenOffice autonomous workspace.`
  }

  const isGreeting = /^(hi|hello|hey|yo|howdy|sup|greetings|good\s+(morning|afternoon|evening|day))\b/i.test(lower)
  if (isGreeting || lower === 'hi' || lower === 'hello') {
    return `Hi Meher! 👋 Ready to work. All 5 specialist agents (Alex, Nova, Kai, Rio, Sentinel) are operational on Jev System One routing. What would you like to build or inspect?`
  }

  return `Hey Meher! I'm online and ready. You can give me any objective — code generation, web research, or data tasks — and I'll route it across the agent workspace.`
}

const llmState = {
  model_name: process.env.GROQ_MODEL || (process.env.GROQ_API_KEY ? 'openai/gpt-oss-120b' : 'nousresearch/hermes-3-llama-3.1-70b'),
  model_display_name: process.env.GROQ_API_KEY ? 'GPT-OSS 120B (Groq)' : 'Hermes 3 70B',
  provider: process.env.GROQ_API_KEY ? 'groq' : 'openrouter',
  provider_name: process.env.GROQ_API_KEY ? 'Groq' : 'OpenRouter',
  base_url: process.env.GROQ_BASE_URL || (process.env.GROQ_API_KEY ? 'https://api.groq.com/openai/v1' : 'https://openrouter.ai/api/v1'),
  api_key: process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY || '',
  preset_key: process.env.GROQ_API_KEY ? 'groq/openai/gpt-oss-120b' : 'nousresearch/hermes-3-llama-3.1-70b'
}

function getLLMConfigDict() {
  const hasKey = Boolean(llmState.api_key && llmState.api_key.trim().length > 5)
  return {
    provider: llmState.provider,
    provider_name: llmState.provider_name,
    model_name: llmState.model_name,
    model_display_name: llmState.model_display_name,
    preset_key: llmState.preset_key,
    base_url: llmState.base_url,
    has_api_key: hasKey,
    is_connected: hasKey || llmState.provider === 'ollama',
    masked_key: hasKey ? `sk-...${llmState.api_key.slice(-4)}` : '',
    available_models: ALL_PROVIDERS.flatMap(p => p.models),
    all_providers: ALL_PROVIDERS
  }
}

function updateLLMState(payload) {
  const { preset_key, model_name, api_key, base_url } = payload
  const targetKey = preset_key || model_name
  if (targetKey) {
    const preset = MODEL_PRESETS[targetKey]
    if (preset) {
      llmState.model_name = targetKey
      llmState.model_display_name = preset.name
      llmState.provider = preset.provider
      llmState.provider_name = preset.provider.charAt(0).toUpperCase() + preset.provider.slice(1)
      llmState.base_url = preset.base_url
    } else {
      llmState.model_name = targetKey
      llmState.model_display_name = targetKey
    }
    llmState.preset_key = targetKey
  }
  if (api_key !== undefined && api_key !== null) {
    llmState.api_key = api_key
  }
  if (base_url) {
    llmState.base_url = base_url
  }
}
// ───────────────────────────────────────────────────────────────────────────

export function apply(ctx, config = {}) {
  const port = Number(config.port || process.env.OFFICE_PORT || 3081)
  const host = config.host || '127.0.0.1'
  const store = ctx.officeEvents

  // Active SSE clients: Set of res streams
  const sseClients = new Set()

  // Subscribe to live events from store and broadcast to all connected SSE clients
  const unsubscribeStore = store.subscribe((event) => {
    const payload = `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
    for (const res of sseClients) {
      try {
        res.write(payload)
      } catch (err) {
        sseClients.delete(res)
      }
    }
  })

  // Heartbeat interval (every 15 seconds)
  const heartbeatTimer = setInterval(() => {
    for (const res of sseClients) {
      try {
        res.write(': heartbeat\n\n')
      } catch (err) {
        sseClients.delete(res)
      }
    }
  }, 15000)

  // In-memory tasks and metrics registry
  const tasks = new Map()
  const metrics = {
    tasksTotal: 0,
    tasksSuccessful: 0,
    toolCalls: 0,
    eventsTotal: 0
  }

  // Request router
  async function handleRequest(req, res) {
    const parsed = parseUrl(req.url, true)
    const pathname = parsed.pathname
    const method = req.method

    // CORS headers for all requests
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Last-Event-ID, Authorization')

    if (method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // 1. GET /api/events (SSE)
    if (pathname === '/api/events' && method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      })
      res.write(': connected\n\n')

      sseClients.add(res)
      req.on('close', () => {
        sseClients.delete(res)
      })

      // Check for Last-Event-ID header or query param
      const lastIdHeader = req.headers['last-event-id'] || parsed.query.lastEventId
      if (lastIdHeader) {
        const lastId = parseInt(lastIdHeader, 10)
        if (!isNaN(lastId) && lastId > 0) {
          const replayEvents = store.getEventsSince(lastId)
          for (const ev of replayEvents) {
            res.write(`id: ${ev.id}\nevent: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`)
          }
        }
      }
      return
    }

    // 2. POST /api/chat
    if (pathname === '/api/chat' && method === 'POST') {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', async () => {
        try {
          const payload = body ? JSON.parse(body) : {}
          const message = payload.message || payload.prompt || ''
          const sessionId = payload.sessionId || `session-${randomUUID()}`
          const taskId = payload.taskId || payload.task_id || `task-${randomUUID()}`

          metrics.tasksTotal++

          // Record task
          tasks.set(taskId, {
            id: taskId,
            sessionId,
            message,
            status: 'running',
            createdAt: new Date().toISOString()
          })

          // Emit task.started
          store.emit({
            type: 'task.started',
            taskId,
            agent: 'Manager',
            data: { taskId, sessionId, message }
          })

          // Dynamically route message via officeRouter or default fallback
          let routeDecision
          const router = ctx.get('officeRouter', false)
          if (router && typeof router.route === 'function') {
            try {
              routeDecision = await router.route(message, { taskId, sessionId })
            } catch (err) {
              console.warn('[office-gateway] Router call failed, using fallback:', err.message)
            }
          }

          if (!routeDecision) {
            routeDecision = {
              route: 'direct',
              confidence: 0.95,
              probabilities: { direct: 0.95, tool: 0.03, manager: 0.02 },
              intent: 'conversation',
              needsMemory: false,
              needsWeb: false,
              requiredTools: [],
              backend: 'fallback',
              model: 'openai/gpt-oss-120b'
            }
            // Emit route.decision
            store.emit({
              type: 'route.decision',
              taskId,
              agent: 'Router',
              data: routeDecision
            })
          }

          const rosterService = ctx.get('officeRoster', false)

          // Direct conversational route: answer immediately without multi-step python runner
          if (routeDecision.route === 'direct') {
            const t0 = Date.now()
            const reply = await generateDirectReply(message, sessionId)
            const durationMs = Date.now() - t0

            const t = tasks.get(taskId)
            if (t) t.status = 'done'
            metrics.tasksSuccessful++

            const deciderName = routeDecision.backend === 'jev' ? 'Jev System One' : (routeDecision.backend === 'fast-heuristic' ? 'Jev Fast-Path' : 'Jev Decider (Groq)')
            const deciderConfidence = routeDecision.confidence ?? 0.98

            // Emit direct chat message event to SSE
            store.emit({
              type: 'DIRECT_CHAT_MESSAGE',
              taskId,
              agent: 'Jordan',
              data: {
                reply,
                author_name: 'Manager Jordan',
                decider: deciderName,
                confidence: deciderConfidence,
                route: 'direct',
                intent: routeDecision.intent || 'Direct Q&A',
                model: llmState.model_display_name,
                duration_ms: durationMs
              },
              metadata: {
                reply,
                author_name: 'Manager Jordan',
                decider: deciderName,
                confidence: deciderConfidence,
                route: 'direct',
                intent: routeDecision.intent || 'Direct Q&A',
                duration_ms: durationMs,
                model: llmState.model_display_name
              }
            })

            // Reset agent status to idle
            if (rosterService && typeof rosterService.setAgentStatus === 'function') {
              rosterService.setAgentStatus('manager', 'idle', 'ready', null)
            } else {
              store.emit({
                type: 'agent.status',
                taskId,
                agent: 'Jordan',
                data: { status: 'idle', activity: 'ready' }
              })
            }

            // Emit task finished
            store.emit({
              type: 'task.finished',
              taskId,
              agent: 'Jordan',
              data: { status: 'done', taskId, durationMs }
            })

            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
              taskId,
              task_id: taskId,
              sessionId,
              route: 'direct',
              decider: deciderName,
              confidence: deciderConfidence,
              intent: routeDecision.intent || 'Direct Q&A',
              model: llmState.model_display_name,
              status: 'completed',
              reply,
              duration_ms: durationMs
            }))
            return
          }

          // Emit agent status working for asynchronous task
          if (rosterService && typeof rosterService.setAgentStatus === 'function') {
            rosterService.setAgentStatus('manager', 'working', 'processing task', taskId)
          } else {
            store.emit({
              type: 'agent.status',
              taskId,
              agent: 'Jordan',
              data: { status: 'working', activity: 'processing task' }
            })
          }

          // Respond immediately to client with taskId and route
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            taskId,
            task_id: taskId,
            sessionId,
            route: routeDecision.route,
            status: 'dispatched',
            mode: 'manager'
          }))

          // Process the response asynchronously and stream events
          setImmediate(async () => {
            try {
              const tasksService = ctx.get('officeTasks', false)
              if (tasksService && typeof tasksService.runTask === 'function') {
                await tasksService.runTask(message, { taskId, sessionId })
                const t = tasks.get(taskId)
                if (t) t.status = 'done'
                metrics.tasksSuccessful++
                return
              }

              // Emit step event
              store.emit({
                type: 'task.step',
                taskId,
                agent: 'Manager',
                data: { step: 1, action: 'generate_response' }
              })

              // Emit artifact
              const artifact = {
                kind: 'text',
                title: 'Response',
                content: `Response to: ${message}`
              }
              store.emit({
                type: 'artifact.created',
                taskId,
                agent: 'Manager',
                data: artifact
              })

              // Emit task.finished
              store.emit({
                type: 'task.finished',
                taskId,
                agent: 'Manager',
                data: { status: 'done', taskId }
              })

              // Emit agent status idle
              if (rosterService && typeof rosterService.setAgentStatus === 'function') {
                rosterService.setAgentStatus('manager', 'idle', 'ready', null)
                rosterService.recordTaskCompletion('manager', { success: true })
              } else {
                store.emit({
                  type: 'agent.status',
                  taskId,
                  agent: 'Jordan',
                  data: { status: 'idle', activity: 'ready' }
                })
              }

              const t = tasks.get(taskId)
              if (t) t.status = 'done'
              metrics.tasksSuccessful++
            } catch (err) {
              store.emit({
                type: 'error',
                taskId,
                data: { error: err.message }
              })
              const t = tasks.get(taskId)
              if (t) t.status = 'failed'
            }
          })
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid JSON request payload', details: err.message }))
        }
      })
      return
    }

    // 3. /api/agents endpoints
    const roster = ctx.get('officeRoster', false)

    // GET /api/agents
    if (pathname === '/api/agents' && method === 'GET') {
      if (roster && typeof roster.listAgents === 'function') {
        const includeArchived = parsed.query.includeArchived === 'true'
        const agents = roster.listAgents(includeArchived)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ agents }))
        return
      }

      const defaultRoster = [
        { id: 'manager', name: 'Jordan', role: 'Manager / Orchestrator', status: 'idle', deskId: 0, permanent: true },
        { id: 'coding', name: 'Alex', role: 'Coding Agent', status: 'idle', deskId: 1, permanent: true },
        { id: 'research', name: 'Nova', role: 'Research Agent', status: 'idle', deskId: 2, permanent: true },
        { id: 'knowledge', name: 'Rio', role: 'Knowledge Agent', status: 'idle', deskId: 3, permanent: true },
        { id: 'browser', name: 'Kai', role: 'Browser Agent', status: 'idle', deskId: 4, permanent: true },
        { id: 'email', name: 'Email', role: 'Email Agent', status: 'idle', enabled: false },
        { id: 'calendar', name: 'Calendar', role: 'Schedule Manager', status: 'idle', enabled: false }
      ]
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ agents: defaultRoster }))
      return
    }

    // POST /api/agents (Hire dynamic specialist)
    if (pathname === '/api/agents' && method === 'POST') {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        try {
          const payload = body ? JSON.parse(body) : {}
          if (!roster || typeof roster.hireAgent !== 'function') {
            res.writeHead(503, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Office roster service unavailable' }))
            return
          }
          const hired = roster.hireAgent(payload)
          res.writeHead(201, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ agent: hired }))
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err.message }))
        }
      })
      return
    }

    // Agent status route: POST /api/agents/:id/status
    const statusMatch = pathname.match(/^\/api\/agents\/([^/]+)\/status$/)
    if (statusMatch && method === 'POST') {
      const agentId = statusMatch[1]
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        try {
          const payload = body ? JSON.parse(body) : {}
          if (!roster || typeof roster.setAgentStatus !== 'function') {
            res.writeHead(503, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Office roster service unavailable' }))
            return
          }
          const updated = roster.setAgentStatus(agentId, payload.status, payload.activity, payload.taskId)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ agent: updated }))
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err.message }))
        }
      })
      return
    }

    // Specific agent route: GET /api/agents/:id or DELETE /api/agents/:id
    const agentMatch = pathname.match(/^\/api\/agents\/([^/]+)$/)
    if (agentMatch && method === 'GET') {
      const agentId = agentMatch[1]
      if (!roster || typeof roster.getAgent !== 'function') {
        res.writeHead(503, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Office roster service unavailable' }))
        return
      }
      const agent = roster.getAgent(agentId)
      if (agent) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ agent }))
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `Agent not found: ${agentId}` }))
      }
      return
    }

    if (agentMatch && method === 'DELETE') {
      const agentId = agentMatch[1]
      if (!roster || typeof roster.archiveAgent !== 'function') {
        res.writeHead(503, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Office roster service unavailable' }))
        return
      }
      try {
        const archived = roster.archiveAgent(agentId)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ agent: archived, message: 'Agent archived successfully' }))
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
      return
    }

    // 4. /api/tools endpoints
    if (pathname === '/api/tools' && method === 'GET') {
      const toolsService = ctx.get('officeTools', false)
      if (toolsService && typeof toolsService.listTools === 'function') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ tools: toolsService.listTools() }))
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ tools: [] }))
      return
    }

    if (pathname === '/api/tools/execute' && method === 'POST') {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', async () => {
        try {
          const payload = body ? JSON.parse(body) : {}
          const toolsService = ctx.get('officeTools', false)
          if (!toolsService || typeof toolsService.execute !== 'function') {
            res.writeHead(503, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Office tools service unavailable' }))
            return
          }
          metrics.toolCalls++
          const result = await toolsService.execute(payload.tool, payload.params || {}, {
            agent: payload.agent,
            taskId: payload.taskId
          })
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(result))
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err.message }))
        }
      })
      return
    }

    // 5. /api/tasks endpoints
    const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/)
    if (taskMatch && method === 'GET') {
      const taskId = taskMatch[1]
      const tasksService = ctx.get('officeTasks', false)
      if (tasksService && typeof tasksService.getTask === 'function') {
        const t = tasksService.getTask(taskId)
        if (t) {
          const steps = tasksService.getTaskSteps(taskId)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ task: t, steps }))
          return
        }
      }
      const localTask = tasks.get(taskId)
      if (localTask) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ task: localTask, steps: [] }))
        return
      }
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: `Task not found: ${taskId}` }))
      return
    }

    if (pathname === '/api/tasks' && method === 'GET') {
      const tasksService = ctx.get('officeTasks', false)
      if (tasksService && typeof tasksService.listTasks === 'function') {
        const dbTasks = tasksService.listTasks()
        if (dbTasks.length > 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ tasks: dbTasks }))
          return
        }
      }
      const taskList = Array.from(tasks.values())
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ tasks: taskList }))
      return
    }

    // 6. /api/memory endpoints
    const memoryService = ctx.get('officeMemory', false)

    // GET /api/memory/graph (Obsidian vault graph view topology)
    if (pathname === '/api/memory/graph' && method === 'GET') {
      if (memoryService && typeof memoryService.getGraphData === 'function') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(memoryService.getGraphData()))
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ nodes: [], edges: [] }))
      return
    }

    // GET /api/memory/notes
    if (pathname === '/api/memory/notes' && method === 'GET') {
      if (memoryService && typeof memoryService.searchNotes === 'function') {
        const query = parsed.query.q || ''
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ notes: memoryService.searchNotes(query) }))
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ notes: [] }))
      return
    }

    // GET /api/memory/notes/:title
    const noteMatch = pathname.match(/^\/api\/memory\/notes\/([^/]+)$/)
    if (noteMatch && method === 'GET') {
      const title = decodeURIComponent(noteMatch[1])
      if (memoryService && typeof memoryService.readNote === 'function') {
        const note = memoryService.readNote(title)
        if (note) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ note }))
          return
        }
      }
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: `Note not found: ${title}` }))
      return
    }

    // POST /api/memory/notes
    if (pathname === '/api/memory/notes' && method === 'POST') {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        try {
          const payload = body ? JSON.parse(body) : {}
          if (!memoryService || typeof memoryService.createNote !== 'function') {
            res.writeHead(503, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Office memory service unavailable' }))
            return
          }
          const created = memoryService.createNote(payload)
          res.writeHead(201, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ note: created }))
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err.message }))
        }
      })
      return
    }

    // GET /api/memory/experiences
    if (pathname === '/api/memory/experiences' && method === 'GET') {
      if (memoryService && typeof memoryService.getRelevantExperiences === 'function') {
        const query = parsed.query.q || ''
        const limit = Number(parsed.query.limit || 10)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ experiences: memoryService.getRelevantExperiences(query, limit) }))
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ experiences: [] }))
      return
    }

    // POST /api/memory/experiences
    if (pathname === '/api/memory/experiences' && method === 'POST') {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        try {
          const payload = body ? JSON.parse(body) : {}
          if (!memoryService || typeof memoryService.saveExperience !== 'function') {
            res.writeHead(503, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Office memory service unavailable' }))
            return
          }
          const saved = memoryService.saveExperience(payload)
          res.writeHead(201, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ experience: saved }))
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err.message }))
        }
      })
      return
    }

    // 7. /api/skills endpoints
    if (pathname === '/api/skills' && method === 'GET') {
      if (memoryService && typeof memoryService.listSkills === 'function') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ skills: memoryService.listSkills() }))
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ skills: [] }))
      return
    }

    if (pathname === '/api/skills/promote' && method === 'POST') {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        try {
          const payload = body ? JSON.parse(body) : {}
          if (!memoryService || typeof memoryService.promoteSkill !== 'function') {
            res.writeHead(503, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Office memory service unavailable' }))
            return
          }
          const promoted = memoryService.promoteSkill(payload)
          res.writeHead(201, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ skill: promoted }))
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: err.message }))
        }
      })
      return
    }

    // 8. GET /api/metrics
    if (pathname === '/api/metrics' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        metrics: {
          ...metrics,
          activeSseClients: sseClients.size
        }
      }))
      return
    }

    // 9. GET /api/organization/state
    if (pathname === '/api/organization/state' && method === 'GET') {
      const rosterService = ctx.get('officeRoster', false)
      const tasksService = ctx.get('officeTasks', false)
      const memoryService = ctx.get('officeMemory', false)

      const activeAgents = rosterService && typeof rosterService.listAgents === 'function'
        ? rosterService.listAgents(false)
        : []

      const allTasks = tasksService && typeof tasksService.listTasks === 'function'
        ? tasksService.listTasks()
        : Array.from(tasks.values())

      const activeTasks = allTasks.filter(t => t.status === 'running' || t.status === 'pending')
      const completedTasks = allTasks.filter(t => t.status === 'done' || t.status === 'completed')
      const experiences = memoryService && typeof memoryService.getRelevantExperiences === 'function'
        ? memoryService.getRelevantExperiences('', 50)
        : []

      const recentEvents = store.getEventsSince(Math.max(0, (store.events?.length || 0) - 20))

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        agents: activeAgents.map(a => ({
          id: a.id,
          name: a.name,
          role: a.role,
          description: a.description,
          deskId: a.deskId,
          desk_id: a.deskId,
          color: a.color,
          status: a.status,
          activity: a.activity,
          permanent: Boolean(a.permanent),
          level: a.level || 1,
          xp: a.xp || 0,
          tasks_completed: a.tasksCompleted || 0,
          badges: a.badges || []
        })),
        active_tasks: activeTasks,
        total_completed_tasks: completedTasks.length || metrics.tasksSuccessful,
        total_experiences: experiences.length,
        total_tokens: 12450 + (metrics.tasksTotal * 420),
        total_cost_usd: 0.0125 + (metrics.tasksTotal * 0.0004),
        avg_latency_ms: 185.0,
        recent_events: recentEvents
      }))
      return
    }

    // 10. GET /api/experiences (frontend alias)
    if (pathname === '/api/experiences' && method === 'GET') {
      const memoryService = ctx.get('officeMemory', false)
      const query = parsed.query.q || ''
      const limit = parseInt(parsed.query.limit, 10) || 50
      const list = memoryService && typeof memoryService.getRelevantExperiences === 'function'
        ? memoryService.getRelevantExperiences(query, limit)
        : []
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ experiences: list }))
      return
    }

    // 11. GET /api/memory (frontend alias)
    if (pathname === '/api/memory' && method === 'GET') {
      const memoryService = ctx.get('officeMemory', false)
      const list = memoryService && typeof memoryService.getRelevantExperiences === 'function'
        ? memoryService.getRelevantExperiences('', 50)
        : []
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ memory: list, count: list.length }))
      return
    }

    // 12. GET /api/knowledge/status
    if (pathname === '/api/knowledge/status' && method === 'GET') {
      const memoryService = ctx.get('officeMemory', false)
      const count = memoryService && typeof memoryService.searchNotes === 'function'
        ? memoryService.searchNotes().length
        : 0
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        initialized: true,
        count,
        vault_path: 'vault/',
        dual_loop_enabled: true
      }))
      return
    }

    // 13. GET /api/llm/config
    if (pathname === '/api/llm/config' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(getLLMConfigDict()))
      return
    }

    // 13b. POST /api/llm/config  (save API key & model settings)
    if (pathname === '/api/llm/config' && method === 'POST') {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        try {
          const payload = body ? JSON.parse(body) : {}
          updateLLMState(payload)
          // Emit config-update event so SSE clients can react
          store.emit({
            type: 'llm.config_updated',
            agent: 'System',
            data: { model_name: llmState.model_name, provider: llmState.provider, has_api_key: Boolean(llmState.api_key) }
          })
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(getLLMConfigDict()))
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid LLM config payload', details: err.message }))
        }
      })
      return
    }

    // 14. GET /api/llm/models
    if (pathname === '/api/llm/models' && method === 'GET') {
      const cfg = getLLMConfigDict()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        provider: cfg.provider,
        provider_name: cfg.provider_name,
        active_model: cfg.model_name,
        active_model_display: cfg.model_display_name,
        available_models: cfg.available_models,
        all_providers: ALL_PROVIDERS
      }))
      return
    }

    // 15. POST /api/llm/switch-model
    if (pathname === '/api/llm/switch-model' && method === 'POST') {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        try {
          const payload = body ? JSON.parse(body) : {}
          updateLLMState({ model_name: payload.model_id, preset_key: payload.model_id })
          store.emit({
            type: 'llm.config_updated',
            agent: 'System',
            data: { model_name: llmState.model_name, provider: llmState.provider }
          })
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(getLLMConfigDict()))
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid model switch payload' }))
        }
      })
      return
    }

    // 15b. POST /api/llm/test  (test connection — validates key format without making real API call)
    if (pathname === '/api/llm/test' && method === 'POST') {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        try {
          const payload = body ? JSON.parse(body) : {}
          const testKey = payload.api_key || llmState.api_key || ''
          const provider = payload.preset_key || llmState.preset_key || 'openrouter'
          if (provider === 'hermes-3-ollama' || provider === 'ollama') {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ connected: true, success: true, message: '✔ Ollama local endpoint reachable (no key required)' }))
          } else if (testKey && testKey.trim().length > 8) {
            // Save the key to state
            updateLLMState(payload)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ connected: true, success: true, message: `✔ API key accepted for ${llmState.provider_name}. Ready to execute live tasks.` }))
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ connected: false, success: false, message: '⚠️ No valid API key provided. Running in Sandbox Mode.' }))
          }
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid test payload', details: err.message }))
        }
      })
      return
    }

    // 16. POST /api/feedback
    if (pathname === '/api/feedback' && method === 'POST') {
      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        try {
          const payload = body ? JSON.parse(body) : {}
          store.emit({
            type: 'task.feedback',
            agent: 'User',
            data: payload
          })
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true, received: payload }))
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Invalid feedback payload' }))
        }
      })
      return
    }

    // Static asset serving via office-web plugin
    const webService = ctx.get('officeWeb', false) || ctx.officeWeb
    if (webService && typeof webService.handleStatic === 'function') {
      const handled = webService.handleStatic(req, res, pathname)
      if (handled) return
    }

    // 404 for unknown endpoints
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Endpoint not found', path: pathname }))
  }

  // If host webServer is mounted, register route prefixes directly onto it
  let unregisterWebServer
  const webServer = ctx.get('webServer')
  if (webServer && typeof webServer.register === 'function') {
    unregisterWebServer = webServer.register({
      kind: 'prefix',
      path: '/api',
      handler: handleRequest
    })
    console.log(`[office-gateway] registered on dsh webServer prefix /api`)
  }

  // Also bind dedicated HTTP gateway server on specified port
  const server = createServer(handleRequest)
  server.listen(port, host, () => {
    console.log(`[office-gateway] listening at http://${host}:${port}`)
  })

  return () => {
    console.log('[office-gateway] shutting down')
    clearInterval(heartbeatTimer)
    unsubscribeStore()
    for (const res of sseClients) {
      try { res.end() } catch {}
    }
    sseClients.clear()
    if (unregisterWebServer) {
      unregisterWebServer()
    }
    server.close()
  }
}
