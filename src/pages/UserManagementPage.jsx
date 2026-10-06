import LoadingModal from '../components/LoadingModal'
import { useEffect, useRef, useState } from 'react'
import { fetchUsers, saveUser, removeUser } from '../lib/appsScriptApi'
import './Administration.css'

const blank = { name: '', email: '', role: 'user', status: 'Active', password: '' }
export default function UserManagementPage() {
  const [users, setUsers] = useState([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(null)
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const dialog = useRef(null)
  const filtered = users.filter(user => `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(query.toLowerCase()))
  async function loadUsers(refresh = false) {
    setLoading(true); setError('')
    try { setUsers(await fetchUsers(refresh)) }
    catch (failure) { setError(failure.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { void Promise.resolve().then(loadUsers) }, [])
  useEffect(() => { if (form) dialog.current.showModal() }, [form])
  function openForm(account) {
    setCreating(!account); setFormError(''); setForm(account ? { ...account, password: '' } : { ...blank })
  }
  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setFormError('')
    try { await saveUser(form, creating); setForm(null); await loadUsers() }
    catch (failure) { setFormError(failure.message) }
    finally { setBusy(false) }
  }
  async function deleteAccount(account) {
    if (!window.confirm(`Delete the account for ${account.name} (${account.email})?`)) return
    setBusy(true); setError('')
    try { await removeUser(account.email); await loadUsers() }
    catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  return <main className="dashboard-content admin-page user-management-page">
    {busy && <LoadingModal title="Updating user accounts..." />}
    {loading && <p role="status">Loading accounts…</p>}
    <div className="admin-title"><div><p className="eyebrow">Administration</p><h1>User Management</h1><p>Manage office accounts, access levels, and passwords.</p></div><div><button className="secondary-action" onClick={() => loadUsers(true)} disabled={loading || busy}>Refresh users</button><button className="primary-action" onClick={() => openForm(null)}>Add user</button></div></div>
    <section className="admin-stats"><article><span>Total users</span><strong>{users.length}</strong><small>Registered accounts</small></article><article><span>Active accounts</span><strong>{users.filter(user => user.status !== 'Inactive').length}</strong><small>Enabled sign-in accounts</small></article><article><span>Administrators</span><strong>{users.filter(user => user.role !== 'user').length}</strong><small>Manage document workflows</small></article><article><span>Inactive accounts</span><strong>{users.filter(user => user.status === 'Inactive').length}</strong><small>Sign-in disabled</small></article></section>
    {error && <p role="alert">{error}</p>}
    <section className="admin-panel"><div className="admin-toolbar"><div><h2>User accounts</h2><p>Changes are saved to the connected account registry.</p></div><input aria-label="Search users" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search users…" /></div><div className="admin-table-wrap"><table className="users-table"><thead><tr><th>User</th><th>Email</th><th>Account type</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      {filtered.map(account => <tr key={account.email}><td><div className="admin-user"><span>{account.name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase()}</span><strong>{account.name}</strong></div></td><td>{account.email}</td><td><span className="role-pill">{account.role === 'user' ? 'Viewer' : account.role}</span></td><td>{account.status || 'Active'}</td><td><button disabled={busy} onClick={() => openForm(account)}>Edit</button><button disabled={busy} onClick={() => deleteAccount(account)}>Delete</button></td></tr>)}
      {!loading && !filtered.length && <tr><td colSpan="5">No accounts found.</td></tr>}
    </tbody></table></div></section>
    {form && <dialog ref={dialog} className="record-action-dialog" onCancel={event => { if (busy) event.preventDefault(); else setForm(null) }}><form onSubmit={submit}><h2>{creating ? 'Add user' : 'Edit account'}</h2>
      <label>Full name<input autoFocus required maxLength={150} value={form.name} disabled={busy} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
      <label>Institutional email<input type="email" required value={form.email} disabled={busy || !creating} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
      <label>Role<select value={form.role} disabled={busy} onChange={event => setForm({ ...form, role: event.target.value })}><option value="user">Viewer</option><option value="admin">Admin</option><option value="super admin">Super Admin</option></select></label>
      <label>Status<select value={form.status} disabled={busy} onChange={event => setForm({ ...form, status: event.target.value })}><option>Active</option><option>Inactive</option></select></label>
      <label>{creating ? 'Password' : 'New password (leave blank to keep current password)'}<input type="password" autoComplete="new-password" required={creating} minLength={12} maxLength={256} value={form.password} disabled={busy} onChange={event => setForm({ ...form, password: event.target.value })} /></label>
      {formError && <p role="alert">{formError}</p>}<footer><button type="button" disabled={busy} onClick={() => setForm(null)}>Cancel</button><button className="primary-action" disabled={busy}>{busy ? 'Saving…' : 'Save account'}</button></footer>
    </form></dialog>}
  </main>
}
