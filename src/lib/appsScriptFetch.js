const readActions = new Set(['overview', 'documents', 'activityLogs', 'currentUser', 'documentPage', 'documentDetails', 'editorCapabilities', 'users', 'userLogs', 'verify'])

export async function fetchAppsScript(target, options, action, fetchRequest = fetch) {
  const attempts = readActions.has(action) ? 3 : 1
  for (let attempt = 0; attempt < attempts; attempt++) {
    const response = await fetchRequest(target, options)
    const html = (response.headers.get('content-type') || '').includes('text/html')
    if ((response.status === 404 || (response.ok && html)) && attempt + 1 < attempts) {
      await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)))
      continue
    }
    if (response.status === 404) {
      throw new Error('The Apps Script deployment could not be reached (404). Check the web app /exec URL in .env and restart the local server if it changed.')
    }
    return response
  }
}
