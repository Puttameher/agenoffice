/**
 * office-web plugin
 *
 * Web Frontend & Control Room Integration:
 * - Static Asset Delivery: Serves interactive 2D canvas office UI (frontend/index.html, style.css, src/*)
 * - Safe Path Traversal Guard: Sanitizes incoming URI paths against workspace escapes
 * - SPA Client Fallback: Serves index.html for virtual routes
 * - Obsidian Knowledge Graph Integration: Formats graph view nodes & edges for frontend visualizer
 * - Cordis Service: Exposes ctx.officeWeb
 */

import { join, resolve, extname, normalize } from 'node:path'
import { existsSync, statSync, readFileSync, createReadStream } from 'node:fs'
import { Service } from 'file:///D:/youtube/agenoffice/vendor/deepseek-harness/vendor/cordis/src/index.ts'

export const name = 'office-web'

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg'
}

export class OfficeWeb extends Service {
  constructor(ctx, config = {}) {
    super(ctx, 'officeWeb', true)
    this.config = config
    this.frontendDir = config.frontendDir
      ? resolve(config.frontendDir)
      : join(process.cwd(), 'frontend')

    if (!existsSync(this.frontendDir)) {
      console.warn(`[office-web] Warning: frontend directory not found at ${this.frontendDir}`)
    }
  }

  getFrontendPath() {
    return this.frontendDir
  }

  /**
   * Static file handler invoked by gateway or web server
   * Returns true if request was handled, false otherwise.
   */
  handleStatic(req, res, pathname = '/') {
    // Only handle GET and HEAD requests for static assets
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return false
    }

    // Do not handle /api/* requests
    if (pathname.startsWith('/api')) {
      return false
    }

    // Default to index.html for root
    let safePath = pathname === '/' || pathname === '' ? '/index.html' : pathname
    try {
      safePath = decodeURIComponent(safePath)
    } catch {}

    // Security: Path traversal defense
    const normalized = normalize(safePath).replace(/^[/\\]+/, '')
    const targetFile = resolve(this.frontendDir, normalized)

    // Ensure resolved path is strictly within frontendDir
    if (!targetFile.startsWith(this.frontendDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Access Denied: Path Traversal Detected')
      return true
    }

    // Check if target file exists and is a file
    let filePath = targetFile
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      // If path has no file extension (e.g. /dashboard or /chat), fallback to index.html (SPA routing)
      if (!extname(normalized)) {
        filePath = join(this.frontendDir, 'index.html')
        if (!existsSync(filePath)) {
          return false
        }
      } else {
        return false
      }
    }

    try {
      const stats = statSync(filePath)
      const ext = extname(filePath).toLowerCase()
      const contentType = MIME_TYPES[ext] || 'application/octet-stream'

      // ETag & Cache headers
      const etag = `W/"${stats.size}-${stats.mtimeMs}"`
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304)
        res.end()
        return true
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size,
        'ETag': etag,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
      })

      if (req.method === 'HEAD') {
        res.end()
        return true
      }

      createReadStream(filePath).pipe(res)
      return true
    } catch (err) {
      console.error('[office-web] Error streaming file:', err)
      return false
    }
  }

  /**
   * Helper to format graph data for the frontend graph view
   */
  getGraphVisualizationData() {
    const memory = this.ctx.get('officeMemory', false) || this.ctx.officeMemory
    if (!memory || typeof memory.getGraphData !== 'function') {
      return { nodes: [], edges: [] }
    }
    return memory.getGraphData()
  }
}

export function apply(ctx, config = {}) {
  ctx.plugin(OfficeWeb, config)
}
