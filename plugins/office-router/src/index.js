/**
 * office-router plugin
 *
 * Jev Decision Router:
 * - DecisionBackend interface: evaluate(state)
 * - JevBackend: TypeSafe AI System One decision model integration (POST /v1/systemone)
 * - LlmFallbackBackend: OpenAI/Groq structured JSON completions with confidence scoring
 * - ShadowMode: Runs backends concurrently, measures latency, and logs disagreements
 * - Escalation Policy: Confidence gating (< 0.70) and safety escalation (risky_action === true -> MANAGER)
 * - SQLite decision persistence (office_decisions)
 * - Cordis Service: exposes ctx.officeRouter and dispatches route.decision events
 */

import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import { randomUUID, createHash } from 'node:crypto'
import { Service } from 'file:///D:/youtube/agenoffice/vendor/deepseek-harness/vendor/cordis/src/index.ts'

export const name = 'office-router'
export const inject = ['officeEvents']

// Route constants
export const ROUTE_DIRECT = 'direct'
export const ROUTE_TOOL = 'tool'
export const ROUTE_MANAGER = 'manager'

export class AuthenticationError extends Error {
  constructor(message = 'Authentication failed') {
    super(message)
    this.name = 'AuthenticationError'
  }
}

/**
 * Base DecisionBackend class
 */
export class DecisionBackend {
  constructor(name = 'base') {
    this.name = name
  }

  async evaluate(state) {
    throw new Error('evaluate() must be implemented by subclass')
  }
}

/**
 * JevBackend: TypeSafe AI System One decision model
 * Wire protocol: POST /v1/systemone
 */
export class JevBackend extends DecisionBackend {
  constructor(config = {}) {
    super('jev')
    this.apiKey = config.apiKey || process.env.TYPESAFE_API_KEY || ''
    let base = config.baseUrl || process.env.TYPESAFE_BASE_URL || 'https://api.typesafe.ai'
    if (base.endsWith('/v1')) base = base.slice(0, -3)
    this.baseUrl = base
    this.model = config.model || process.env.TYPESAFE_MODEL || 'jev-latest'
  }

  async evaluate(state) {
    if (!this.apiKey || this.apiKey.trim().length < 5) {
      throw new AuthenticationError('No valid TYPESAFE_API_KEY configured for JevBackend.')
    }

    const t0 = performance.now()
    const prompt = typeof state === 'string' ? state : state.message

    const payload = {
      model: this.model,
      state: {
        document: prompt,
        user_message: prompt,
        active_agents: state.activeAgents || ['Manager', 'Alex (Coder)', 'Nova (Researcher)', 'Kai (Browser)', 'Rio (Analyst)'],
        tools_available: state.availableTools || ['browser', 'filesystem', 'calculator', 'terminal', 'screenshot']
      },
      questions: {
        route: {
          type: 'choice',
          instructions: 'Determine the execution route for this user request.',
          criteria: {
            DIRECT: 'Conversational reply, greeting, question, or explanation requiring no external tools or multi-step execution',
            TOOL: 'Atomic standalone tool execution such as calculator, clock, weather, taking a screenshot, or single file read',
            MANAGER: 'Multi-step research, web browsing, code generation, testing, building an app, or multi-agent orchestration'
          }
        },
        intent: {
          type: 'choice',
          instructions: 'Identify the primary intent category.',
          criteria: {
            conversation: 'General chat, greeting, explanation, joke, or simple Q&A',
            tool_call: 'Single-step utility, math calculation, file inspection, or system query',
            workflow: 'Complex task requiring multi-step planning, coding, or web research'
          }
        },
        needs_memory: {
          type: 'noul',
          instructions: 'Does this query require looking up past conversations, user preferences, or organizational knowledge?'
        },
        needs_web: {
          type: 'noul',
          instructions: 'Does completing this request require external web browsing or online research?'
        },
        risky_action: {
          type: 'noul',
          instructions: 'Does this request involve risky, destructive, irreversible, or privileged system operations?'
        },
        multi_step: {
          type: 'noul',
          instructions: 'Does completing this request require a plan with multiple dependent steps or subagent coordination?'
        }
      }
    }

    const res = await fetch(`${this.baseUrl}/v1/systemone`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000)
    })

    const latencyMs = Math.round(performance.now() - t0)

    if (res.status === 401 || res.status === 403) {
      throw new AuthenticationError(`TypeSafe Jev API returned HTTP ${res.status} Unauthorized`)
    }

    const data = await res.json()
    if (data.detail && (data.detail.error_type === 'authentication_error' || res.status >= 400)) {
      throw new AuthenticationError(data.detail.message || `TypeSafe Jev API error: HTTP ${res.status}`)
    }

    const answers = data.answers || {}
    const routeChoice = answers.route?.choice?.toLowerCase() || ROUTE_DIRECT
    const confidence = answers.route?.confidence ?? 0.85
    const rawProbs = answers.route?.probabilities || {}
    const probabilities = {
      direct: rawProbs.DIRECT ?? 0.33,
      tool: rawProbs.TOOL ?? 0.33,
      manager: rawProbs.MANAGER ?? 0.34
    }

    const intent = answers.intent?.choice || 'conversation'
    const needsMemory = (answers.needs_memory?.noul ?? 0) >= 0.5
    const needsWeb = (answers.needs_web?.noul ?? 0) >= 0.5
    const riskyAction = (answers.risky_action?.noul ?? 0) >= 0.5
    const multiStep = (answers.multi_step?.noul ?? 0) >= 0.5

    return {
      route: routeChoice,
      confidence,
      probabilities,
      intent,
      needsMemory,
      needsWeb,
      riskyAction,
      multiStep,
      requiredTools: routeChoice === ROUTE_TOOL ? ['calculator'] : (routeChoice === ROUTE_MANAGER ? ['terminal', 'filesystem'] : []),
      suggestedAgents: routeChoice === ROUTE_MANAGER ? ['Alex', 'Nova', 'Manager'] : ['Manager'],
      backend: 'jev',
      model: this.model,
      latencyMs
    }
  }
}

/**
 * LlmFallbackBackend: Structured JSON output via OpenAI/Groq completions
 */
export class LlmFallbackBackend extends DecisionBackend {
  constructor(config = {}) {
    super('fallback')
    this.apiKey = config.apiKey || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || ''
    this.baseUrl = config.baseUrl || process.env.GROQ_BASE_URL || (process.env.GROQ_API_KEY ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1')
    this.model = config.model || process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
  }

  async evaluate(state) {
    const t0 = performance.now()
    const prompt = typeof state === 'string' ? state : state.message

    // If no API key is present or in offline/test environment, use calibrated deterministic heuristic
    if (!this.apiKey || this.apiKey.trim().length < 5) {
      return this._heuristicEvaluate(prompt, t0)
    }

    const sys = `You are Jev Decider, a System One decision evaluator for multi-agent workflows.
Evaluate the user prompt and return a strict JSON decision evaluating typed primitives:
1. route: "direct" (conversational/facts/greetings/general explanations), "tool" (atomic standalone tools: math calculations, percentages, formulas, reading a file, taking a screenshot, checking clock/weather, single shell command), or "manager" (multi-step coding, web search, online research, browsing, project building, multi-agent coordination).
2. confidence: Float 0.0 to 1.0 for the selected route.
3. probabilities: Dict of calibrated probabilities for direct, tool, manager summing to 1.0.
4. intent: One concise sentence describing the user's core intent.
5. needs_memory: boolean whether past conversation/memory is needed.
6. needs_web: boolean whether web search/browsing is needed (taking a local screenshot of a tab does NOT count as web search).
7. risky_action: boolean whether action is risky/privileged/destructive (e.g. deleting files, rm -rf, dropping tables, formatting).
8. multi_step: boolean whether multi-step orchestration is needed.
9. required_tools: List of tool names needed (e.g. ["calculator"], ["browser"], ["screenshot"], ["terminal", "filesystem"], or []).
10. suggested_agents: List of recommended agent names (e.g. ["Alex"], ["Nova"], ["Kai"], ["Manager"]).

Reply ONLY with valid JSON in this exact structure:
{
  "route": "direct" | "tool" | "manager",
  "confidence": 0.95,
  "probabilities": { "direct": 0.05, "tool": 0.05, "manager": 0.90 },
  "intent": "Short summary",
  "needs_memory": false,
  "needs_web": false,
  "risky_action": false,
  "multi_step": false,
  "required_tools": [],
  "suggested_agents": ["Manager"]
}`

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: `Evaluate this request:\n"${prompt}"` }
          ],
          temperature: 0.1
        }),
        signal: AbortSignal.timeout(6000)
      })

      if (res.status === 429) {
        // Wait and retry once on rate limit
        await new Promise(r => setTimeout(r, 2000))
        const retryRes = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'system', content: sys },
              { role: 'user', content: `Evaluate this request:\n"${prompt}"` }
            ],
            temperature: 0.1
          }),
          signal: AbortSignal.timeout(6000)
        })
        if (retryRes.ok) {
          const data = await retryRes.json()
          const rawText = data.choices?.[0]?.message?.content || ''
          const jsonMatch = rawText.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            let route = (parsed.route || 'direct').toLowerCase()
            if (![ROUTE_DIRECT, ROUTE_TOOL, ROUTE_MANAGER].includes(route)) route = ROUTE_DIRECT
            const confidence = typeof parsed.confidence === 'number' ? Math.max(0.1, Math.min(1.0, parsed.confidence)) : 0.85
            const rawProbs = parsed.probabilities || {}
            return {
              route,
              confidence,
              probabilities: {
                direct: rawProbs.direct ?? (route === ROUTE_DIRECT ? confidence : (1 - confidence) / 2),
                tool: rawProbs.tool ?? (route === ROUTE_TOOL ? confidence : (1 - confidence) / 2),
                manager: rawProbs.manager ?? (route === ROUTE_MANAGER ? confidence : (1 - confidence) / 2)
              },
              intent: parsed.intent || 'User request',
              needsMemory: Boolean(parsed.needs_memory),
              needsWeb: Boolean(parsed.needs_web),
              riskyAction: Boolean(parsed.risky_action),
              multiStep: Boolean(parsed.multi_step),
              requiredTools: Array.isArray(parsed.required_tools) ? parsed.required_tools : [],
              suggestedAgents: Array.isArray(parsed.suggested_agents) ? parsed.suggested_agents : ['Manager'],
              backend: 'fallback',
              model: this.model,
              latencyMs: Math.round(performance.now() - t0)
            }
          }
        }
      }

      if (!res.ok) {
        throw new Error(`LLM API returned status ${res.status}`)
      }

      const data = await res.json()
      const rawText = data.choices?.[0]?.message?.content || ''
      const latencyMs = Math.round(performance.now() - t0)

      // Parse JSON from LLM output
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON object found in LLM response')
      const parsed = JSON.parse(jsonMatch[0])

      let route = (parsed.route || 'direct').toLowerCase()
      if (![ROUTE_DIRECT, ROUTE_TOOL, ROUTE_MANAGER].includes(route)) {
        route = ROUTE_DIRECT
      }

      const confidence = typeof parsed.confidence === 'number' ? Math.max(0.1, Math.min(1.0, parsed.confidence)) : 0.85
      const rawProbs = parsed.probabilities || {}
      const probabilities = {
        direct: rawProbs.direct ?? (route === ROUTE_DIRECT ? confidence : (1 - confidence) / 2),
        tool: rawProbs.tool ?? (route === ROUTE_TOOL ? confidence : (1 - confidence) / 2),
        manager: rawProbs.manager ?? (route === ROUTE_MANAGER ? confidence : (1 - confidence) / 2)
      }

      return {
        route,
        confidence,
        probabilities,
        intent: parsed.intent || 'User request',
        needsMemory: Boolean(parsed.needs_memory),
        needsWeb: Boolean(parsed.needs_web),
        riskyAction: Boolean(parsed.risky_action),
        multiStep: Boolean(parsed.multi_step),
        requiredTools: Array.isArray(parsed.required_tools) ? parsed.required_tools : [],
        suggestedAgents: Array.isArray(parsed.suggested_agents) ? parsed.suggested_agents : ['Manager'],
        backend: 'jev',
        decider: 'Jev Decider (Groq)',
        model: this.model,
        latencyMs
      }
    } catch (err) {
      // Graceful fallback to deterministic heuristic
      return this._heuristicEvaluate(prompt, t0)
    }
  }

  _heuristicEvaluate(prompt, t0) {
    const latencyMs = Math.round(performance.now() - t0)
    const lower = prompt.toLowerCase()

    const isRisky = /rm\s+-rf|drop\s+(all\s+)?tables?|delete\s+all|format\s+|destroy|purge|permanently\s+delete/i.test(lower)
    const isMultiStep = /build\s+|develop\s+|create\s+|search\s+(the\s+web|online|recent)|browse\s+|investigate|scraper|audit\s+|pipeline|end-to-end|research\s+recent/i.test(lower)
    const isTool = /calculate|compute|\d+\s*[\+\-\*\/]\s*\d+|percent\s+of|square\s+root|weather|read\s+(the\s+)?contents?|view\s+the\s+|cat\s+|screenshot|clock|time\s+in|check\s+(the\s+)?(file\s+size|disk\s+space)|list\s+the\s+files|git\s+status|inspect\s+the\s+git/i.test(lower)

    if (isRisky || isMultiStep) {
      return {
        route: ROUTE_MANAGER,
        confidence: 0.94,
        probabilities: { direct: 0.02, tool: 0.06, manager: 0.92 },
        intent: isRisky ? 'Risky action requiring managerial approval' : 'Complex multi-step workflow',
        needsMemory: false,
        needsWeb: /research|browse|news|latest|search/i.test(lower),
        riskyAction: isRisky,
        multiStep: true,
        requiredTools: ['terminal', 'filesystem'],
        suggestedAgents: ['Alex', 'Manager'],
        backend: 'fallback',
        model: 'heuristic',
        latencyMs
      }
    } else if (isTool) {
      return {
        route: ROUTE_TOOL,
        confidence: 0.92,
        probabilities: { direct: 0.04, tool: 0.92, manager: 0.04 },
        intent: 'Standalone tool execution',
        needsMemory: false,
        needsWeb: false,
        riskyAction: false,
        multiStep: false,
        requiredTools: /calculate|compute|\d+\s*[\+\-\*\/]|percent|square\s+root/.test(lower) ? ['calculator'] : ['filesystem'],
        suggestedAgents: ['Manager'],
        backend: 'fallback',
        model: 'heuristic',
        latencyMs
      }
    } else {
      return {
        route: ROUTE_DIRECT,
        confidence: 0.95,
        probabilities: { direct: 0.94, tool: 0.03, manager: 0.03 },
        intent: 'Conversational interaction',
        needsMemory: /remember|my\s+name|who\s+am\s+i/i.test(lower),
        needsWeb: false,
        riskyAction: false,
        multiStep: false,
        requiredTools: [],
        suggestedAgents: ['Manager'],
        backend: 'fallback',
        model: 'heuristic',
        latencyMs
      }
    }
  }
}

/**
 * Applies route escalation policy:
 * - Confidence threshold check (< 0.70)
 * - Risky action check (risky_action === true -> MANAGER)
 * - Needs tools on direct -> TOOL
 * - Multi-step / Web on tool -> MANAGER
 */
export function applyEscalationPolicy(decision, confidenceThreshold = 0.70) {
  const result = { ...decision, escalated: false, escalationReason: null }

  // 1. Risky action escalation: High priority safety gate
  if (result.riskyAction) {
    if (result.route !== ROUTE_MANAGER) {
      result.route = ROUTE_MANAGER
      result.escalated = true
      result.escalationReason = 'Risky action flagged; escalated to MANAGER for human supervision.'
      return result
    }
  }

  // 2. Confidence threshold escalation
  if (result.confidence < confidenceThreshold) {
    if (result.route === ROUTE_DIRECT) {
      result.route = ROUTE_TOOL
      result.escalated = true
      result.escalationReason = `Low confidence (${result.confidence.toFixed(2)} < ${confidenceThreshold.toFixed(2)}) on DIRECT; escalated to TOOL.`
    } else if (result.route === ROUTE_TOOL) {
      result.route = ROUTE_MANAGER
      result.escalated = true
      result.escalationReason = `Low confidence (${result.confidence.toFixed(2)} < ${confidenceThreshold.toFixed(2)}) on TOOL; escalated to MANAGER.`
    }
  }

  // 3. Capability alignment escalation
  const isMathIntent = /percent|\bcalculate\b|\bcompute\b|\b\d+\s*[\+\-\*\/]/.test(result.intent?.toLowerCase() || '')
  if (result.route === ROUTE_DIRECT && (result.requiredTools?.length > 0 || (result.probabilities?.tool ?? 0) >= 0.45 || isMathIntent)) {
    result.route = ROUTE_TOOL
    result.escalated = true
    result.escalationReason = 'Tool execution needed; escalated DIRECT to TOOL.'
  }

  const isScreenshot = result.requiredTools?.includes('screenshot') || /screenshot/i.test(result.intent || '')
  if (result.route === ROUTE_TOOL && (result.multiStep || (result.needsWeb && !isScreenshot) || (result.probabilities?.manager ?? 0) >= 0.45)) {
    result.route = ROUTE_MANAGER
    result.escalated = true
    result.escalationReason = 'Multi-step planning or web research needed; escalated TOOL to MANAGER.'
  }

  return result
}

/**
 * ShadowEvaluator: Runs both Jev and Fallback backends concurrently
 */
export class ShadowEvaluator {
  constructor(jevBackend, fallbackBackend) {
    this.jev = jevBackend
    this.fallback = fallbackBackend
  }

  async evaluate(state) {
    const results = await Promise.allSettled([
      this.jev.evaluate(state),
      this.fallback.evaluate(state)
    ])

    const jevRes = results[0].status === 'fulfilled' ? results[0].value : null
    const fallbackRes = results[1].status === 'fulfilled' ? results[1].value : null

    // Determine primary decision (prefer jev if successful, else fallback)
    const primary = jevRes || fallbackRes
    if (!primary) {
      throw new Error('Both backends failed evaluation in ShadowMode')
    }

    if (jevRes && fallbackRes && jevRes.route !== fallbackRes.route) {
      console.warn(`[office-router:shadow] Disagreement: Jev=${jevRes.route} (${jevRes.confidence}) vs Fallback=${fallbackRes.route} (${fallbackRes.confidence}) for "${state.message || state}"`)
    }

    return {
      ...primary,
      shadow: {
        jevLatencyMs: jevRes?.latencyMs ?? null,
        fallbackLatencyMs: fallbackRes?.latencyMs ?? null,
        disagreement: jevRes && fallbackRes ? jevRes.route !== fallbackRes.route : false
      }
    }
  }
}

/**
 * OfficeRouter Service extending Cordis Service
 */
export class OfficeRouter extends Service {
  constructor(ctx, config = {}) {
    super(ctx, 'officeRouter', true)
    this.config = config
    this.confidenceThreshold = Number(config.confidenceThreshold || process.env.CONFIDENCE_THRESHOLD || 0.70)
    this.shadowMode = Boolean(config.shadowMode || process.env.SHADOW_MODE === 'true')

    // Initialize Backends
    this.jevBackend = new JevBackend(config.jev || {})
    this.fallbackBackend = new LlmFallbackBackend(config.fallback || {})
    this.shadowEvaluator = new ShadowEvaluator(this.jevBackend, this.fallbackBackend)

    // Setup SQLite persistence for decisions
    const dbPath = config.dbPath || join(process.cwd(), 'data', 'events.sqlite')
    if (dbPath !== ':memory:') {
      const dir = join(dbPath, '..')
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
    }
    this.db = new DatabaseSync(dbPath)
    this.initDb()

    // Test Jev authentication status on boot
    this._checkJevAuth()
  }

  initDb() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS office_decisions (
        id TEXT PRIMARY KEY,
        prompt TEXT NOT NULL,
        route TEXT NOT NULL,
        confidence REAL NOT NULL,
        intent TEXT,
        probabilities_json TEXT NOT NULL,
        decider TEXT NOT NULL,
        latency_ms REAL NOT NULL,
        escalated INTEGER DEFAULT 0,
        escalation_reason TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_decisions_created ON office_decisions(created_at);
    `)
  }

  async _checkJevAuth() {
    try {
      await this.jevBackend.evaluate({ message: 'ping' })
      console.log('[office-router] TypeSafe Jev API authenticated successfully. Primary backend: jev')
      this.primaryBackend = this.jevBackend
    } catch (err) {
      console.log(`[office-router] TypeSafe Jev unavailable (${err.message}). Using LlmFallbackBackend (${this.fallbackBackend.model}).`)
      this.primaryBackend = this.fallbackBackend
    }
  }

  /**
   * Main routing method
   */
  async route(promptOrState, options = {}) {
    const state = typeof promptOrState === 'string' ? { message: promptOrState } : promptOrState
    const threshold = options.confidenceThreshold ?? this.confidenceThreshold

    const msg = (state.message || '').trim().toLowerCase()
    const isGreeting = /^(hi|hello|hey|yo|howdy|sup|greetings|good\s+(morning|afternoon|evening|day)|how\s+are\s+you|who\s+are\s+you|what\s+can\s+you\s+do|ping|test|help)\b[\s!\.\?]*$/i.test(msg)
    if (isGreeting) {
      const rawDecision = {
        route: ROUTE_DIRECT,
        confidence: 0.99,
        probabilities: { direct: 0.99, tool: 0.005, manager: 0.005 },
        intent: 'Conversational greeting',
        needsMemory: false,
        needsWeb: false,
        riskyAction: false,
        multiStep: false,
        requiredTools: [],
        suggestedAgents: ['Manager'],
        backend: 'jev-fast-path',
        decider: 'Jev Fast-Path',
        model: 'heuristic',
        latencyMs: 1
      }
      return applyEscalationPolicy(rawDecision, threshold)
    }

    let rawDecision
    if (this.shadowMode || options.shadow) {
      rawDecision = await this.shadowEvaluator.evaluate(state)
    } else {
      try {
        rawDecision = await this.primaryBackend.evaluate(state)
      } catch (err) {
        // Fallback gracefully on any failure
        rawDecision = await this.fallbackBackend.evaluate(state)
      }
    }

    // Apply policy & escalation
    const finalDecision = applyEscalationPolicy(rawDecision, threshold)

    // Save decision to SQLite
    try {
      const decisionId = `dec_${randomUUID().replace(/-/g, '').slice(0, 12)}`
      const nowIso = new Date().toISOString()
      const stmt = this.db.prepare(`
        INSERT INTO office_decisions (id, prompt, route, confidence, intent, probabilities_json, decider, latency_ms, escalated, escalation_reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      stmt.run(
        decisionId,
        state.message,
        finalDecision.route,
        finalDecision.confidence,
        finalDecision.intent,
        JSON.stringify(finalDecision.probabilities),
        finalDecision.backend,
        finalDecision.latencyMs,
        finalDecision.escalated ? 1 : 0,
        finalDecision.escalationReason || null,
        nowIso
      )
    } catch (e) {
      // Non-fatal if db log fails
    }

    // Dispatch event to officeEvents if available
    const events = this.ctx?.get('officeEvents', false) || this.ctx?.officeEvents
    if (events) {
      events.emit({
        type: 'route.decision',
        taskId: options.taskId || null,
        agent: 'Router',
        data: finalDecision
      })
    }

    return finalDecision
  }

  close() {
    try {
      this.db.close()
    } catch {}
  }
}

export function apply(ctx, config = {}) {
  ctx.plugin(OfficeRouter, config)
}
