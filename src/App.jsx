import { useEffect, useState } from 'react'
import Login from './pages/login'
import Dashboard from './pages/Dashboard'

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
    window.localStorage.removeItem('op-dms-user')
    window.location.hash = '/login'
    setUser(null)
  }

  return user
    ? <Dashboard user={user} onLogout={handleLogout} />
    : <Login onLogin={handleLogin} />
}
