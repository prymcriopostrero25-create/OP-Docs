import { useEffect, useState } from 'react'
import Login from './pages/login'
import Dashboard from './pages/Dashboard'
import { logoutUser } from './lib/appsScriptApi'

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem('op-dms-user'))
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (user && window.location.hash !== '#/dashboard') {
      window.location.hash = '/dashboard'
    }
  }, [user])

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

  return user
    ? <Dashboard user={user} onLogout={handleLogout} />
    : <Login onLogin={handleLogin} />
}
