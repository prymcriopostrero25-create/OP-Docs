// PDF preparation reuses the registered document and its revision cache. It is
// safe to repeat when Apps Script returns a temporary deployment/redirect error.
const readActions = new Set(['overview', 'documents', 'activityLogs', 'currentUser', 'documentPage', 'documentDetails', 'documentSendStatus', 'prepareDocumentPreview', 'prepareEmailAttachment', 'editorCapabilities', 'users', 'userLogs', 'verify'])

export async function fetchAppsScript(target, options, action, fetchRequest = fetch) {
  const attempts = readActions.has(action) ? 3 : 1
  for (let attempt = 0; attempt < attempts; attempt++) {
    options.signal?.throwIfAborted()
    let response
    try { response = await fetchRequest(target, options) }
    catch (error) {
      if (options.signal?.aborted || error.name === 'AbortError' || error.name === 'TimeoutError' || attempt + 1 >= attempts) throw error
      await retryDelay(attempt, options.signal)
      continue
    }
    const html = (response.headers.get('content-type') || '').includes('text/html')
    if (([404, 408, 429, 500, 502, 503, 504].includes(response.status) || (response.ok && html)) && attempt + 1 < attempts) {
      await response.body?.cancel()
      await retryDelay(attempt, options.signal)
      continue
    }
    if (response.status === 404) {
      throw new Error('The Apps Script deployment could not be reached (404). Check the web app /exec URL in .env and restart the local server if it changed.')
    }
    return response
  }
}

function retryDelay(attempt, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, 300 * (attempt + 1))
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
  })
}
