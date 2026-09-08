import { useEffect, useState } from 'react'
import { fetchUsers } from '../lib/appsScriptApi'
import './Administration.css'

export default function UserManagementPage() {
  const [users, setUsers] = useState([])
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', role: 'user', office: 'Office of the President' })
  const filtered = users.filter((user) => `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(query.toLowerCase()))

  async function loadUsers() {
    setStatus('loading')
    setError('')

    try {
      const accounts = await fetchUsers()
      setUsers(accounts.map((account) => ({
        ...account,
        role: account.role || 'user',
        office: 'Office of the President',
        status: 'Active',
        initials: account.name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase(),
      })))
      setStatus('success')
    } catch (loadError) {
      setError(loadError.message || 'Unable to load users.')
      setStatus('error')
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadUsers)
  }, [])

  function addUser(event) {
    event.preventDefault()
    const initials = form.name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase()
    setUsers([...users, { ...form, initials, status: 'Active' }])
    setForm({ name: '', email: '', role: 'user', office: 'Office of the President' })
    setShowForm(false)
  }

  return <main className="dashboard-content admin-page user-management-page">
    <div className="admin-title"><div><p className="eyebrow">Administration</p><h1>User Management</h1><p>View the accounts configured in the CREDENTIALS sheet.</p></div><button className="secondary-action" onClick={loadUsers} disabled={status === 'loading'}>↻ Refresh users</button></div>
    <section className="admin-stats">
      <article><span>Total users</span><strong>{users.length}</strong><small>Loaded from CREDENTIALS</small></article>
      <article><span>Active accounts</span><strong>{users.length}</strong><small>Configured sign-in accounts</small></article>
      <article><span>Displayed fields</span><strong>2</strong><small>Name and email</small></article>
      <article><span>Password data</span><strong>Hidden</strong><small>Never displayed in the portal</small></article>
    </section>
    <section className="admin-panel">
      <div className="admin-toolbar"><div><h2>Local user accounts</h2><p>Accounts with access to the document portal.</p></div><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search users..." /></div>
      <div className="admin-table-wrap">{status === 'error' ? <div className="user-management-state"><p>{error}</p><button className="secondary-action" onClick={loadUsers}>Try again</button></div> : <table className="users-table"><thead><tr><th>User</th><th>Email</th><th>Account type</th><th>Status</th></tr></thead><tbody>
        {status === 'loading' ? <tr><td colSpan="4" className="user-management-message">Loading credentials...</td></tr> : filtered.map((account) => <tr key={account.email}><td><div className="admin-user"><span>{account.initials}</span><div><strong>{account.name || 'Unnamed account'}</strong></div></div></td><td>{account.email}</td><td><span className="role-pill">{account.role}</span></td><td><span className="user-status active"><i />Active</span></td></tr>)}
      </tbody></table>}{status === 'success' && !filtered.length && <div className="user-management-message">{users.length ? 'No users match your search.' : 'No credentials are configured yet.'}</div>}</div>
    </section>
    {showForm && <div className="admin-modal-backdrop" onMouseDown={() => setShowForm(false)}><form className="admin-modal" onSubmit={addUser} onMouseDown={(e) => e.stopPropagation()}><div className="modal-title"><div><h2>Add local user</h2><p>Create an account for an authorized employee.</p></div><button type="button" onClick={() => setShowForm(false)}>×</button></div><label>Full name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Employee name" /></label><label>Email address<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@jhcsc.edu.ph" /></label><div className="form-pair"><label>Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option>user</option><option>admin</option><option>super admin</option></select></label><label>Office<select value={form.office} onChange={(e) => setForm({ ...form, office: e.target.value })}><option>Office of the President</option><option>Administrative Office</option><option>International Affairs</option><option>Human Resource Office</option></select></label></div><div className="modal-actions"><button type="button" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-action">Create user</button></div></form></div>}
  </main>
}
