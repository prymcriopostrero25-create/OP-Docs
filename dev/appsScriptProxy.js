import { Buffer } from 'node:buffer'

// Follow ContentService redirects with fetch, which changes a redirected POST
// to GET and consumes Google's final response before replying to the browser.
export function appsScriptProxy(target, timeoutMs = 90000) {
  return {
    name: 'apps-script-proxy',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const path = request.url || ''
        if (!/^\/apps-script(?:[/?]|$)/.test(path)) return next()
        try {
          const chunks = []
          for await (const chunk of request) chunks.push(chunk)
          const method = request.method || 'GET'
          const upstream = await fetch(target + path.slice('/apps-script'.length), {
            method,
            headers: { 'Content-Type': request.headers['content-type'] || 'text/plain;charset=utf-8' },
            body: ['GET', 'HEAD'].includes(method) ? undefined : Buffer.concat(chunks),
            redirect: 'follow',
            signal: AbortSignal.timeout(timeoutMs),
          })
          const body = Buffer.from(await upstream.arrayBuffer())
          if (response.destroyed) return
          response.writeHead(upstream.status, {
            'Content-Type': upstream.headers.get('content-type') || 'application/json',
            'Cache-Control': 'no-store',
          })
          response.end(body)
        } catch (error) {
          if (response.destroyed) return
          const timeout = error.name === 'TimeoutError' || error.name === 'AbortError'
          response.writeHead(timeout ? 504 : 502, { 'Content-Type': 'application/json' })
          response.end(JSON.stringify({ success: false, message: timeout
            ? 'The Apps Script request timed out. Check the deployment and try again.'
            : 'The local server could not connect to Apps Script. Check the connection and deployment URL, then try again.' }))
        }
      })
    },
  }
}
