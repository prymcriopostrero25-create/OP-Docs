const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL

export async function authenticateUser(email, password) {
  if (!APPS_SCRIPT_URL) {
    throw new Error('The Apps Script web app URL is not configured.')
  }

  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'login',
      email,
      password,
    }),
  })

  if (!response.ok) {
    throw new Error(`Apps Script request failed with status ${response.status}.`)
  }

  const result = await response.json()

  if (!result.success) {
    throw new Error(result.message || 'Incorrect email or password.')
  }

  return result.user
}

export async function logoutUser(token) {
  if (!APPS_SCRIPT_URL) throw new Error('The Apps Script web app URL is not configured.')
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'logout', token }),
    keepalive: true,
  })
  if (!response.ok) throw new Error('Unable to record logout.')
  const result = await response.json()
  if (!result.success) throw new Error(result.message || 'Unable to record logout.')
}

export async function fetchUserLogs() {
  if (!APPS_SCRIPT_URL) {
    throw new Error('The Apps Script web app URL is not configured.')
  }

  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'userLogs', token: getSessionToken() }),
  })

  if (!response.ok) {
    throw new Error(`Apps Script request failed with status ${response.status}.`)
  }

  const result = await response.json()

  if (!result.success) {
    throw new Error(result.message || 'Unable to load user logs.')
  }

  return result.logs || []
}

export async function fetchUsers() {
  if (!APPS_SCRIPT_URL) {
    throw new Error('The Apps Script web app URL is not configured.')
  }

  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'users', token: getSessionToken() }),
  })

  if (!response.ok) {
    throw new Error(`Apps Script request failed with status ${response.status}.`)
  }

  const result = await response.json()

  if (!result.success) {
    throw new Error(result.message || 'Unable to load users.')
  }

  return result.users || []
}
function getSessionToken() {
  try { return JSON.parse(window.localStorage.getItem('op-dms-user'))?.token || '' } catch { return '' }
}

async function documentRequest(payload) {
  if (!APPS_SCRIPT_URL) throw new Error('The Apps Script web app URL is not configured.')
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...payload, token: getSessionToken() }),
  })
  if (!response.ok) throw new Error(`Document request failed with status ${response.status}.`)
  const result = await response.json()
  if (!result.success) throw new Error(result.message || 'Unable to process the document.')
  return result
}

export async function fetchDocuments() {
  const files = (await documentRequest({ action: 'documents' })).documents || []
  // Exclude the specific sample upload while its owner completes Drive cleanup.
  return files.filter(file => file.id !== '1cb7ca84-b1d8-420a-a4ce-84dc89f79281')
}

export async function updateDocumentStatus(id, status) {
  const record = (await documentRequest({ action: 'updateDocumentStatus', id, status })).document
  if (!record || record.id !== id || record.status !== status) {
    throw new Error('The server did not confirm the selected status. Deploy the latest Code.gs and refresh the document list.')
  }
  return record
}

export async function editDocument(id, subject) {
  const result = await documentRequest({ action: 'editDocument', id, subject })
  if (result.document?.id !== id || result.document.subject !== subject) throw new Error('Update was not confirmed. Deploy the latest Code.gs and try again.')
  return result.document
}

export async function deleteDocument(id) {
  const result = await documentRequest({ action: 'deleteDocument', id })
  if (result.deletedId !== id || result.storageDeleted !== true) throw new Error('Deletion was not confirmed. Deploy the latest Code.gs and try again.')
}

export async function uploadPdf(file, uploadId, filing) {
  if (!/\.pdf$/i.test(file.name) || !file.size || file.size > 25 * 1024 * 1024) {
    throw new Error('Choose a PDF file up to 25 MB.')
  }
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(new Error('Unable to read the selected file.'))
    reader.readAsDataURL(file)
  })
  return (await documentRequest({ action: 'uploadDocument', name: file.name, data, uploadId, type: filing.type, year: filing.year })).document
}
