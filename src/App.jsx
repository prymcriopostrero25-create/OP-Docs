import { useEffect, useState } from 'react'
import Login from './pages/login'
import Dashboard from './pages/Dashboard'
import VerifyPage from './pages/VerifyPage'
import { logoutUser, currentUser } from './lib/appsScriptApi'

export default function App() {
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
    const refresh = () => currentUser().then(account => {
      if (active) { window.localStorage.setItem('op-dms-user', JSON.stringify(account)); setUser(previous => JSON.stringify(previous) === JSON.stringify(account) ? previous : account) }
    }).catch(error => {
      if (active && /session expired/i.test(error.message)) { window.localStorage.removeItem('op-dms-user'); setUser(null) }
    })
    refresh()
    window.addEventListener('focus', refresh)
    const timer = setInterval(refresh, 60000)
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [user?.token, verificationCode])

  function handleLogin(account) {
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

  if (verificationCode) return <VerifyPage code={verificationCode} />

  return user
    ? <Dashboard user={user} onLogout={handleLogout} />
    : <Login onLogin={handleLogin} />
}
