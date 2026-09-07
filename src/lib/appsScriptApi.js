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
