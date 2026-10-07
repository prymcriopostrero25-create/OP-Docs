import { createAccountLoader } from './accountLoader'
import { fetchAppsScript } from './appsScriptFetch'
import { readAppsScriptResponse } from './appsScriptResponse'
import { loadDocumentPage } from './documentPageLoader'
import { createPdfPreviewCache } from './pdfPreviewCache'
import { sendWithConfirmation } from './documentSendConfirmation'
const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL
const requestTarget = () => import.meta.env.DEV ? '/apps-script' : APPS_SCRIPT_URL

export async function authenticateUser(email, password) {
  if (!APPS_SCRIPT_URL) {
    throw new Error('The Apps Script web app URL is not configured.')
  }

  const response = await fetch(requestTarget(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'login',
      email,
      password,
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    throw new Error(`Apps Script request failed with status ${response.status}.`)
  }

  const result = await readAppsScriptResponse(response)

  if (!result.success) {
    throw new Error(result.message || 'Incorrect email or password.')
  }

  return result.user
}

export async function logoutUser(token) {
  cachedPdfPreview.clear()
  if (!APPS_SCRIPT_URL) throw new Error('The Apps Script web app URL is not configured.')
  const response = await fetch(requestTarget(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'logout', token }),
    keepalive: true,
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error('Unable to record logout.')
  const result = await readAppsScriptResponse(response)
  if (!result.success) throw new Error(result.message || 'Unable to record logout.')
}

export async function fetchUserLogs() {
  if (!APPS_SCRIPT_URL) {
    throw new Error('The Apps Script web app URL is not configured.')
  }

  const response = await fetch(requestTarget(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'userLogs', token: getSessionToken() }),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    throw new Error(`Apps Script request failed with status ${response.status}.`)
  }

  const result = await readAppsScriptResponse(response)

  if (!result.success) {
    throw new Error(result.message || 'Unable to load user logs.')
  }

  return result.logs || []
}

const accountLoader = createAccountLoader(async token => (await sendDocumentRequest({ action: 'users' }, token)).users || [])
export const fetchUsers = (refresh = false) => accountLoader.load(getSessionToken(), refresh)
function getSessionToken() {
  try { return JSON.parse(window.localStorage.getItem('op-dms-user'))?.token || '' } catch { return '' }
}

const pendingReads = new Map()
const sharedReadActions = new Set(['documents', 'overview', 'activityLogs', 'documentPage', 'documentDetails', 'editorCapabilities', 'prepareEmailAttachment'])

function documentRequest(payload) {
  const token = getSessionToken()
  if (!sharedReadActions.has(payload.action)) return sendDocumentRequest(payload, token)
  const key = JSON.stringify([token, payload])
  if (!pendingReads.has(key)) {
    const promise = sendDocumentRequest(payload, token).finally(() => pendingReads.delete(key))
    pendingReads.set(key, promise)
  }
  return pendingReads.get(key)
}

async function sendDocumentRequest(payload, token) {
  if (!APPS_SCRIPT_URL) throw new Error('The Apps Script web app URL is not configured.')
  let response
  try { response = await fetchAppsScript(requestTarget(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...payload, token }),
    signal: AbortSignal.timeout(payload.action === 'documentSendStatus' ? 10000 : (sharedReadActions.has(payload.action) && payload.action !== 'prepareEmailAttachment') || payload.action === 'currentUser' ? 30000 : 90000),
  }, payload.action) } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new Error('The document service took too long to respond. Check the Apps Script deployment and your connection, then retry.', { cause: error })
    }
    throw error
  }
  if (!response.ok) {
    const result = await readAppsScriptResponse(response)
    throw new Error(result.message || `Document request failed with status ${response.status}.`)
  }
  const result = await readAppsScriptResponse(response)
  if (!result.success) throw new Error(result.message || 'Unable to process the document.')
  if (['createUser', 'updateUser', 'deleteUser'].includes(payload.action)) accountLoader.invalidate(token)
  return result
}

export async function fetchDocuments() {
  const files = (await documentRequest({ action: 'documents' })).documents || []
  // Exclude the specific sample upload while its owner completes Drive cleanup.
  return files.filter(file => file.id !== '1cb7ca84-b1d8-420a-a4ce-84dc89f79281')
}

export const fetchOverview = async (refresh = false) => (await documentRequest({ action: 'overview', refresh })).summary

export const currentUser = async () => (await documentRequest({ action: 'currentUser' })).user
export const saveUser = (form, creating) => documentRequest({ ...form, action: creating ? 'createUser' : 'updateUser' })
export const removeUser = email => documentRequest({ action: 'deleteUser', email })
export const verificationLink = async id => (await documentRequest({ action: 'verificationLink', id })).code
export const verifyDocument = async code => (await documentRequest({ action: 'verify', code })).document
export async function sendDocument(form) {
  return sendWithConfirmation(form, documentRequest)
}
export const prepareEmailAttachment = id => documentRequest({ action: 'prepareEmailAttachment', id })
export async function requirePreviewEmailSupport() {
  const result = await documentRequest({ action: 'editorCapabilities' })
  if (result.previewEmailPdfVersion !== 1) throw new Error('Deploy the latest Code.gs as a new version of the existing Apps Script web app to email the preview PDF, then reopen this email form.')
}
export const documentDetails = async id => (await documentRequest({ action: 'documentDetails', id })).form
export const updateDocumentContent = async (id, form) => {
  await requireRichBodySupport(form)
  return (await documentRequest({ ...form, id, action: 'updateDocumentContent' })).document
}

let editorSupport
async function requireRichBodySupport(form) {
  if (!form.bodyRich) return
  const hasColumnWidths = node => Boolean(node?.attrs?.colwidth) || (node?.content || []).some(hasColumnWidths)
  const hasRowHeight = node => (node?.type === 'tableRow' && node.attrs?.height != null) || (node?.content || []).some(hasRowHeight)
  const needsRowHeight = hasRowHeight(form.bodyRich)
  const needsLayout = hasColumnWidths(form.bodyRich)
  const token = getSessionToken()
  if (editorSupport?.token === token && editorSupport.expires > Date.now() && (!needsLayout || editorSupport.layout) && (!needsRowHeight || editorSupport.rowHeight)) return
  try {
    const result = await documentRequest({ action: 'editorCapabilities' })
    if (needsRowHeight && result.richBodyRowHeightVersion !== 1) throw new Error('Unsupported action.')
    if (needsLayout && result.richBodyLayoutVersion !== 1) throw new Error('Unsupported action.')
    if (result.richBodyVersion !== 1) throw new Error('Unsupported action.')
    editorSupport = { token, layout: result.richBodyLayoutVersion === 1, rowHeight: result.richBodyRowHeightVersion === 1, expires: Date.now() + 5 * 60 * 1000 }
  } catch (error) {
    if (/Unsupported action/i.test(error.message)) throw new Error('Formatted documents need the updated Apps Script deployment. Ask the administrator to deploy the latest Code.gs, then retry. Your body is still here.', { cause: error })
    throw error
  }
}

const cachedPdfPreview = createPdfPreviewCache(preparePdfPreview)
export function prepareDocumentPreview(id, type, revision, refresh = false) {
  if (refresh) cachedPdfPreview.clear()
  return cachedPdfPreview(getSessionToken(), id, type, revision)
}

async function preparePdfPreview(id, type, token) {
  let logo
  if (type === 'Certificate of Travel') {
    const response = await fetch('/jhcsclogo.png')
    if (!response.ok) throw new Error('Unable to load the college logo.')
    const bytes = new Uint8Array(await response.arrayBuffer())
    logo = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
  }
  const result = await sendDocumentRequest({ action: 'prepareDocumentPreview', id, logo }, token)
  if (type === 'Authority to Travel Abroad' && result.native && result.authorityLayoutVersion !== 3) {
    throw new Error('Deploy the latest Code.gs as a new version of the existing Apps Script web app to download the restored CERTIFY wording. Then close and reopen this preview.')
  }
  if (type === 'Certificate of Travel' && result.native && result.certificateLayoutVersion !== 3) {
    throw new Error('Deploy the latest Code.gs as a new version of the existing Apps Script web app to download the certificate in the preview format.')
  }
  return result
}

export async function createExecutiveMemorandum(form) {
  await requireRichBodySupport(form)
  const result = await documentRequest({ ...form, action: 'createExecutiveMemorandum' })
  if (!result.document?.url || !result.document?.id) throw new Error('Document creation was not confirmed. Please retry.')
  return result.document
}

export async function createDocument(form) {
  await requireRichBodySupport(form)
  const result = await documentRequest({ ...form, action: 'createDocument' })
  if (!result.document?.url || !result.document?.id) throw new Error('Document creation was not confirmed. Please retry.')
  return result.document
}

export async function fetchActivityLogs() {
  return (await documentRequest({ action: 'activityLogs' })).activities || []
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

export const documentPage = (id, type) => loadDocumentPage(id, documentRequest, type)
