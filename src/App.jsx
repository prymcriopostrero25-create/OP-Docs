import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import Login from './pages/login'
import Dashboard from './pages/Dashboard'
import { logoutUser, currentUser, fetchDashboardAccount } from './lib/appsScriptApi'

const VerifyScanner = lazy(() => import('./pages/VerifyScanner'))

export default function App() {
  const freshLoginToken = useRef(null)
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem('op-dms-user'))
    } catch {
      return null
    }
  })

  const verificationCode = new URLSearchParams(window.location.search).get('verify')
  useEffect(() => {
    if (user && !verificationCode && window.location.hash !== '#/dashboard') {
      window.location.hash = '/dashboard'
    }
  }, [user, verificationCode])

  useEffect(() => {
    if (!user?.token || verificationCode) return
    let active = true
    let pending = false
    let lastCheck = freshLoginToken.current === user.token ? Date.now() : 0
    const refresh = (startup = false) => {
      if (pending || document.visibilityState === 'hidden' || Date.now() - lastCheck < 60000) return
      lastCheck = Date.now()
      pending = true
      return (startup === true ? fetchDashboardAccount() : currentUser()).then(account => {
      if (active) { window.localStorage.setItem('op-dms-user', JSON.stringify(account)); setUser(previous => JSON.stringify(previous) === JSON.stringify(account) ? previous : account) }
    }).catch(error => {
      if (active && /session expired/i.test(error.message)) { window.localStorage.removeItem('op-dms-user'); setUser(null) }
    }).finally(() => { pending = false })
    }
    // Login just authenticated this account. Avoid an immediate second backend
    // execution competing with the initial overview request.
    if (freshLoginToken.current !== user.token) refresh(true)
    window.addEventListener('focus', refresh)
    const timer = setInterval(refresh, 60000)
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [user?.token, verificationCode])

  function handleLogin(account) {
    freshLoginToken.current = account.token
    window.localStorage.setItem('op-dms-user', JSON.stringify(account))
    window.location.hash = '/dashboard'
    setUser(account)
  }

  function handleLogout() {
    const token = user?.token
    window.localStorage.removeItem('op-dms-user')
    window.location.hash = '/login'
    setUser(null)
    if (token) logoutUser(token).catch(() => {
      window.alert('You have signed out on this device, but the server could not confirm or record the logout. Please check your connection and Apps Script deployment.')
    })
  }

  if (new URLSearchParams(window.location.search).has('verify')) return <Suspense fallback={<p role="status">Loading verification…</p>}><VerifyScanner code={verificationCode} /></Suspense>

  return user
    ? <Dashboard key={user.token} user={user} onLogout={handleLogout} />
    : <Login onLogin={handleLogin} />
}
