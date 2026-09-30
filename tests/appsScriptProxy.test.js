import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer as createHttpServer } from 'node:http'
import { once } from 'node:events'
import { createServer as createViteServer } from 'vite'
import config from '../vite.config.js'

test('Apps Script proxy resolves POST redirects without exposing them to the browser', async () => {
  const requests = []
  const upstream = createHttpServer(async (request, response) => {
    let body = ''
    for await (const chunk of request) body += chunk
    requests.push({ method: request.method, url: request.url, body })
    if (request.url === '/exec') {
      response.writeHead(302, { Location: '/content' }).end()
    } else {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ success: true, documents: [] }))
    }
  })
  upstream.listen(0, '127.0.0.1')
  await once(upstream, 'listening')
  let vite
  try {
    const options = config({ mode: 'development' }).server.proxy['/apps-script']
    vite = await createViteServer({
      configFile: false,
      server: {
        host: '127.0.0.1', port: 0,
        proxy: { '/apps-script': {
          ...options,
          target: `http://127.0.0.1:${upstream.address().port}`,
          rewrite: () => '/exec',
        } },
      },
    })
    await vite.listen()
    const payload = JSON.stringify({ action: 'documents', token: 'test-session' })
    const response = await fetch(`http://127.0.0.1:${vite.httpServer.address().port}/apps-script`, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: payload, redirect: 'manual',
    })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('location'), null)
    assert.deepEqual(await response.json(), { success: true, documents: [] })
    assert.deepEqual(requests, [
      { method: 'POST', url: '/exec', body: payload },
      { method: 'GET', url: '/content', body: '' },
    ])
  } finally {
    if (vite) await vite.close()
    upstream.closeAllConnections()
    await new Promise(resolve => upstream.close(resolve))
  }
})
