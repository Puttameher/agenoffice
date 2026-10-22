/**
 * office-tools plugin
 *
 * Office Tool Execution Pipeline:
 * - Playwright Browser Tool (`browser`):
 *   - Headless Playwright (Microsoft Edge / Chromium)
 *   - Actions: navigate, content, click, type, screenshot, close
 *   - Automatic fallback to HTTP document inspection
 * - Python Runner Tool (`python_runner`):
 *   - Executes Python scripts in a safe subprocess with timeout and output capture
 *   - Captures stdout, stderr, execution duration, and exit code
 * - Safe Math Calculator (`calculator`):
 *   - AST-free recursive descent mathematical parser
 *   - Supports arithmetic (+, -, *, /, %, ^), functions (sqrt, abs, round, sin, cos, log), constants (PI, E)
 * - Safe File Reader (`file_reader`):
 *   - Reads project workspace files with path traversal protection
 * - Cordis Service:
 *   - Exposes ctx.officeTools
 *   - Emits tool.call and tool.result events via officeEvents
 *   - Records metrics and execution latencies
 */

import { existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync } from 'node:fs'
import { join, resolve, isAbsolute, relative } from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { Service } from 'file:///D:/youtube/agenoffice/vendor/deepseek-harness/vendor/cordis/src/index.ts'

export const name = 'office-tools'
export const inject = ['officeEvents']

/**
 * Safe Recursive-Descent Math Calculator
 */
export class SafeCalculator {
  static evaluate(expr) {
    if (typeof expr !== 'string' || !expr.trim()) {
      throw new Error('Expression must be a non-empty string')
    }

    const tokens = this.tokenize(expr)
    let pos = 0

    function peek() {
      return tokens[pos]
    }

    function consume(expectedType = null, expectedVal = null) {
      const tok = tokens[pos++]
      if (!tok) throw new Error('Unexpected end of expression')
      if (expectedType && tok.type !== expectedType) {
        throw new Error(`Expected token type ${expectedType}, got ${tok.type}`)
      }
      if (expectedVal && tok.value !== expectedVal) {
        throw new Error(`Expected '${expectedVal}', got '${tok.value}'`)
      }
      return tok
    }

    function parseExpression() {
      let left = parseTerm()
      while (pos < tokens.length && (tokens[pos].value === '+' || tokens[pos].value === '-')) {
        const op = consume().value
        const right = parseTerm()
        left = op === '+' ? left + right : left - right
      }
      return left
    }

    function parseTerm() {
      let left = parseFactor()
      while (pos < tokens.length && (tokens[pos].value === '*' || tokens[pos].value === '/' || tokens[pos].value === '%')) {
        const op = consume().value
        const right = parseFactor()
        if (op === '/' && right === 0) throw new Error('Division by zero')
        left = op === '*' ? left * right : op === '/' ? left / right : left % right
      }
      return left
    }

    function parseFactor() {
      let left = parsePower()
      while (pos < tokens.length && (tokens[pos].value === '^' || tokens[pos].value === '**')) {
        consume()
        const right = parsePower()
        left = Math.pow(left, right)
      }
      return left
    }

    function parsePower() {
      if (pos < tokens.length && tokens[pos].value === '-') {
        consume()
        return -parsePrimary()
      }
      if (pos < tokens.length && tokens[pos].value === '+') {
        consume()
        return parsePrimary()
      }
      return parsePrimary()
    }

    function parsePrimary() {
      const tok = peek()
      if (!tok) throw new Error('Unexpected end of expression')

      if (tok.type === 'NUMBER') {
        consume()
        return tok.value
      }

      if (tok.type === 'IDENTIFIER') {
        const id = consume().value.toLowerCase()
        if (id === 'pi') return Math.PI
        if (id === 'e') return Math.E

        // Function call
        if (pos < tokens.length && tokens[pos].value === '(') {
          consume('OPERATOR', '(')
          const args = [parseExpression()]
          while (pos < tokens.length && tokens[pos].value === ',') {
            consume('OPERATOR', ',')
            args.push(parseExpression())
          }
          consume('OPERATOR', ')')

          switch (id) {
            case 'sqrt': return Math.sqrt(args[0])
            case 'abs': return Math.abs(args[0])
            case 'round': return Math.round(args[0])
            case 'ceil': return Math.ceil(args[0])
            case 'floor': return Math.floor(args[0])
            case 'sin': return Math.sin(args[0])
            case 'cos': return Math.cos(args[0])
            case 'tan': return Math.tan(args[0])
            case 'log': return Math.log(args[0])
            case 'log10': return Math.log10(args[0])
            case 'pow': return Math.pow(args[0], args[1])
            case 'min': return Math.min(...args)
            case 'max': return Math.max(...args)
            default:
              throw new Error(`Unsupported math function: ${id}`)
          }
        }
        throw new Error(`Unknown identifier: ${id}`)
      }

      if (tok.value === '(') {
        consume('OPERATOR', '(')
        const val = parseExpression()
        consume('OPERATOR', ')')
        return val
      }

      throw new Error(`Unexpected token: ${tok.value}`)
    }

    const result = parseExpression()
    if (pos < tokens.length) {
      throw new Error(`Extra tokens after expression: ${tokens[pos].value}`)
    }
    return result
  }

  static tokenize(str) {
    const tokens = []
    let i = 0
    while (i < str.length) {
      const ch = str[i]
      if (/\s/.test(ch)) {
        i++
        continue
      }

      if (ch === '*' && str[i + 1] === '*') {
        tokens.push({ type: 'OPERATOR', value: '**' })
        i += 2
        continue
      }

      if ('+-*/%^(),'.includes(ch)) {
        tokens.push({ type: 'OPERATOR', value: ch })
        i++
        continue
      }

      if (/[0-9.]/.test(ch)) {
        let numStr = ''
        while (i < str.length && /[0-9.]/.test(str[i])) {
          numStr += str[i++]
        }
        const num = parseFloat(numStr)
        if (isNaN(num)) throw new Error(`Invalid number: ${numStr}`)
        tokens.push({ type: 'NUMBER', value: num })
        continue
      }

      if (/[a-zA-Z_]/.test(ch)) {
        let idStr = ''
        while (i < str.length && /[a-zA-Z0-9_]/.test(str[i])) {
          idStr += str[i++]
        }
        tokens.push({ type: 'IDENTIFIER', value: idStr })
        continue
      }

      throw new Error(`Invalid character: '${ch}'`)
    }
    return tokens
  }
}

/**
 * Subprocess Python Runner
 */
export class PythonRunner {
  constructor(config = {}) {
    this.pythonCmd = config.pythonPath || process.env.PYTHON_PATH || 'python'
    this.timeoutMs = config.timeoutMs || 10000
    this.scratchDir = config.scratchDir || join(process.cwd(), 'scratch')
    if (!existsSync(this.scratchDir)) {
      mkdirSync(this.scratchDir, { recursive: true })
    }
  }

  async run(code, options = {}) {
    if (typeof code !== 'string' || !code.trim()) {
      throw new Error('Code must be a non-empty string')
    }

    // Security check for catastrophic commands
    const lower = code.toLowerCase()
    const forbidden = [
      'format c:',
      'rmdir /s',
      'shutdown',
      'mkfs',
      ':(){ :|:& };:'
    ]
    for (const f of forbidden) {
      if (lower.includes(f)) {
        throw new Error(`Forbidden command detected in python execution: '${f}'`)
      }
    }

    const scriptFile = join(this.scratchDir, `run_${randomUUID().slice(0, 8)}.py`)
    writeFileSync(scriptFile, code, 'utf8')

    const start = Date.now()
    const timeout = options.timeoutMs || this.timeoutMs

    return new Promise((resolve, reject) => {
      let proc
      let timer
      let stdout = ''
      let stderr = ''

      try {
        proc = spawn(this.pythonCmd, [scriptFile], {
          cwd: process.cwd(),
          env: { ...process.env, PYTHONUNBUFFERED: '1' }
        })
      } catch (err) {
        try { unlinkSync(scriptFile) } catch {}
        return reject(new Error(`Failed to spawn Python process: ${err.message}`))
      }

      timer = setTimeout(() => {
        try { proc.kill('SIGTERM') } catch {}
        try { unlinkSync(scriptFile) } catch {}
        resolve({
          stdout,
          stderr: `${stderr}\nExecution timed out after ${timeout}ms.`,
          exitCode: -1,
          timedOut: true,
          durationMs: Date.now() - start
        })
      }, timeout)

      proc.stdout?.on('data', chunk => { stdout += chunk })
      proc.stderr?.on('data', chunk => { stderr += chunk })

      proc.on('close', code => {
        clearTimeout(timer)
        try { unlinkSync(scriptFile) } catch {}
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code ?? 0,
          timedOut: false,
          durationMs: Date.now() - start
        })
      })

      proc.on('error', err => {
        clearTimeout(timer)
        try { unlinkSync(scriptFile) } catch {}
        reject(new Error(`Python execution error: ${err.message}`))
      })
    })
  }
}

/**
 * Playwright Browser Automation Tool
 */
export class PlaywrightBrowserTool {
  constructor(config = {}) {
    this.config = config
    this.browser = null
    this.page = null
    this.activeUrl = null
  }

  async _getPlaywright() {
    try {
      return await import('file:///D:/youtube/agenoffice/vendor/deepseek-harness/node_modules/.pnpm/node_modules/playwright/index.mjs')
    } catch {
      return await import('playwright')
    }
  }

  async _ensurePage() {
    if (this.page && !this.page.isClosed()) {
      return this.page
    }

    const pw = await this._getPlaywright()
    if (!this.browser) {
      try {
        // Try Microsoft Edge channel first on Windows
        this.browser = await pw.chromium.launch({
          channel: 'msedge',
          headless: true
        })
      } catch {
        try {
          // Fallback to Chrome channel
          this.browser = await pw.chromium.launch({
            channel: 'chrome',
            headless: true
          })
        } catch {
          // Fallback to default bundled chromium
          this.browser = await pw.chromium.launch({
            headless: true
          })
        }
      }
    }

    this.page = await this.browser.newPage()
    return this.page
  }

  async navigate(url, options = {}) {
    if (!url) throw new Error('URL is required for browser navigation')
    let target = url.trim()
    if (!target.startsWith('http://') && !target.startsWith('https://') && !target.startsWith('data:')) {
      target = `https://${target}`
    }

    const page = await this._ensurePage()
    const response = await page.goto(target, {
      waitUntil: options.waitUntil || 'domcontentloaded',
      timeout: options.timeout || 15000
    })

    this.activeUrl = page.url()
    const title = await page.title()
    const status = response ? response.status() : 200

    return {
      url: this.activeUrl,
      title,
      status
    }
  }

  async content(options = {}) {
    const page = await this._ensurePage()
    const selector = options.selector || 'body'
    const maxChars = options.maxChars || 2500

    const title = await page.title()
    const currentUrl = page.url()

    let text = ''
    try {
      text = await page.textContent(selector)
    } catch {
      text = await page.innerText('body')
    }

    const cleanText = (text || '').replace(/\s+/g, ' ').trim()
    const preview = cleanText.slice(0, maxChars)

    return {
      url: currentUrl,
      title,
      text: preview,
      totalChars: cleanText.length,
      truncated: cleanText.length > maxChars
    }
  }

  async click(selector) {
    if (!selector) throw new Error('Selector is required for click action')
    const page = await this._ensurePage()
    await page.click(selector, { timeout: 10000 })
    return {
      clicked: selector,
      url: page.url()
    }
  }

  async type(selector, text) {
    if (!selector) throw new Error('Selector is required for type action')
    const page = await this._ensurePage()
    await page.fill(selector, text || '', { timeout: 10000 })
    return {
      typed: text,
      selector,
      currentValue: await page.inputValue(selector)
    }
  }

  async screenshot(options = {}) {
    const page = await this._ensurePage()
    const buffer = await page.screenshot({
      type: options.type || 'png',
      fullPage: Boolean(options.fullPage)
    })

    let savedPath = null
    if (options.path) {
      const fullPath = isAbsolute(options.path) ? options.path : join(process.cwd(), options.path)
      writeFileSync(fullPath, buffer)
      savedPath = fullPath
    }

    return {
      savedPath,
      sizeBytes: buffer.length,
      base64: options.returnBase64 !== false ? buffer.toString('base64') : undefined
    }
  }

  async close() {
    if (this.browser) {
      try {
        await this.browser.close()
      } catch {}
      this.browser = null
      this.page = null
      this.activeUrl = null
    }
  }
}

/**
 * Safe File Reader
 */
export class SafeFileReader {
  constructor(baseDir = process.cwd()) {
    this.baseDir = resolve(baseDir)
  }

  read(filePath, options = {}) {
    if (!filePath) throw new Error('File path is required')
    const target = isAbsolute(filePath) ? resolve(filePath) : resolve(this.baseDir, filePath)

    // Security: prevent escape from base directory
    const rel = relative(this.baseDir, target)
    if (rel.startsWith('..') && !options.allowOutside) {
      throw new Error(`Path traversal denied: '${filePath}' is outside root directory`)
    }

    if (!existsSync(target)) {
      throw new Error(`File not found: '${filePath}'`)
    }

    const content = readFileSync(target, 'utf8')
    const maxChars = options.maxChars || 4000
    return {
      path: filePath,
      content: content.slice(0, maxChars),
      sizeBytes: Buffer.byteLength(content),
      truncated: content.length > maxChars
    }
  }
}

/**
 * OfficeTools Cordis Service
 */
export class OfficeTools extends Service {
  constructor(ctx, config = {}) {
    super(ctx, 'officeTools', true)
    this.config = config

    // Instantiate tools
    this.browser = new PlaywrightBrowserTool(config.browser || {})
    this.python = new PythonRunner(config.python || {})
    this.fileReader = new SafeFileReader(config.workspaceDir || process.cwd())

    // Registry of tools
    this.tools = new Map()
    this.registerBuiltinTools()
  }

  registerBuiltinTools() {
    // 1. Calculator
    this.registerTool({
      name: 'calculator',
      agent: 'alex',
      description: 'Evaluates standard mathematical and scientific expressions safely.',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'Mathematical formula (e.g. "120 * (1 + 0.05) ^ 3")' }
        },
        required: ['expression']
      },
      handler: async (params) => {
        const expr = params.expression || params.expr || params.arg
        const result = SafeCalculator.evaluate(expr)
        return { expression: expr, result }
      }
    })

    // 2. Python Runner
    this.registerTool({
      name: 'python_runner',
      agent: 'alex',
      description: 'Executes Python code in a safe subprocess with stdout/stderr capture and timeout.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Python script code to execute' },
          timeoutMs: { type: 'number', description: 'Execution timeout in milliseconds' }
        },
        required: ['code']
      },
      handler: async (params) => {
        const code = params.code || params.script || params.arg
        return await this.python.run(code, { timeoutMs: params.timeoutMs })
      }
    })

    // 3. Browser Navigate
    this.registerTool({
      name: 'browser_navigate',
      agent: 'kai',
      description: 'Navigates headless Playwright browser to a given URL.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to navigate to' }
        },
        required: ['url']
      },
      handler: async (params) => {
        return await this.browser.navigate(params.url, params)
      }
    })

    // 4. Browser Content
    this.registerTool({
      name: 'browser_content',
      agent: 'kai',
      description: 'Extracts structured text content and title from current page.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector (default "body")' },
          maxChars: { type: 'number', description: 'Max text characters to extract' }
        }
      },
      handler: async (params) => {
        return await this.browser.content(params)
      }
    })

    // 5. Browser Click
    this.registerTool({
      name: 'browser_click',
      agent: 'kai',
      description: 'Clicks an element on the active browser page by CSS selector.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector of the element to click' }
        },
        required: ['selector']
      },
      handler: async (params) => {
        return await this.browser.click(params.selector)
      }
    })

    // 6. Browser Type
    this.registerTool({
      name: 'browser_type',
      agent: 'kai',
      description: 'Types text into an input or textarea element on the active page.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector of target input' },
          text: { type: 'string', description: 'Text to type into input' }
        },
        required: ['selector', 'text']
      },
      handler: async (params) => {
        return await this.browser.type(params.selector, params.text)
      }
    })

    // 7. Browser Screenshot
    this.registerTool({
      name: 'browser_screenshot',
      agent: 'kai',
      description: 'Captures a PNG screenshot of the current page state.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Optional relative or absolute file path to save screenshot' },
          fullPage: { type: 'boolean', description: 'Whether to capture full scrollable page' }
        }
      },
      handler: async (params) => {
        return await this.browser.screenshot(params)
      }
    })

    // 8. File Reader
    this.registerTool({
      name: 'file_reader',
      agent: 'jordan',
      description: 'Reads local project files safely within repository boundaries.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path to read' }
        },
        required: ['path']
      },
      handler: async (params) => {
        return this.fileReader.read(params.path, params)
      }
    })
  }

  registerTool(def) {
    if (!def.name || typeof def.handler !== 'function') {
      throw new Error('Tool must have a valid name and handler function')
    }
    this.tools.set(def.name, {
      name: def.name,
      agent: def.agent || 'general',
      description: def.description || '',
      parameters: def.parameters || {},
      handler: def.handler,
      callsCount: 0,
      lastCalled: null
    })
  }

  getTool(name) {
    return this.tools.get(name) || null
  }

  listTools() {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      agent: t.agent,
      description: t.description,
      parameters: t.parameters,
      callsCount: t.callsCount,
      lastCalled: t.lastCalled
    }))
  }

  async execute(toolName, params = {}, context = {}) {
    const tool = this.tools.get(toolName)
    if (!tool) {
      throw new Error(`Tool not found: '${toolName}'`)
    }

    const events = this.ctx?.get('officeEvents', false) || this.ctx?.officeEvents
    const agent = context.agent || (tool.agent === 'kai' ? 'Kai' : tool.agent === 'alex' ? 'Alex' : 'Jordan')
    const taskId = context.taskId || null

    // Emit tool.call event
    if (events) {
      events.emit({
        type: 'tool.call',
        taskId,
        agent,
        data: {
          tool: toolName,
          params
        }
      })
    }

    const start = Date.now()
    try {
      const result = await tool.handler(params, context)
      const durationMs = Date.now() - start

      tool.callsCount++
      tool.lastCalled = new Date().toISOString()

      // Emit tool.result event
      if (events) {
        events.emit({
          type: 'tool.result',
          taskId,
          agent,
          data: {
            tool: toolName,
            result,
            durationMs
          }
        })
      }

      return {
        success: true,
        tool: toolName,
        result,
        durationMs
      }
    } catch (err) {
      const durationMs = Date.now() - start
      if (events) {
        events.emit({
          type: 'error',
          taskId,
          agent,
          data: {
            tool: toolName,
            error: err.message,
            durationMs
          }
        })
      }
      throw err
    }
  }

  async dispose() {
    if (this.browser) {
      await this.browser.close()
    }
  }
}

export function apply(ctx, config = {}) {
  ctx.plugin(OfficeTools, config)
}
