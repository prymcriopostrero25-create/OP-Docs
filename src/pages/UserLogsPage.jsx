import { useEffect, useMemo, useState } from 'react'
import { fetchUserLogs } from '../lib/appsScriptApi'

export default function UserLogsPage() {
  const [logs, setLogs] = useState([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  async function loadLogs() {
    setStatus('loading')
    setError('')

    try {
      setLogs(await fetchUserLogs())
      setStatus('success')
    } catch (loadError) {
      setError(loadError.message || 'Unable to load user logs.')
      setStatus('error')
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadLogs)
  }, [])

  const filteredLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return logs
    return logs.filter((log) => `${log.timestamp} ${log.message}`.toLowerCase().includes(normalizedQuery))
  }, [logs, query])

  return <main className="dashboard-content user-logs-page">
    <div className="page-title-row">
      <div><p className="eyebrow">Security audit</p><h1>User logs</h1><p>Review sign-ins and sign-outs from the document management portal.</p></div>
      <button className="secondary-action archive-export" onClick={loadLogs} disabled={status === 'loading'}>↻ Refresh logs</button>
    </div>

    <section className="user-logs-panel">
      <header className="user-logs-header">
        <div><h2>Session history</h2><p>Sign-ins and sign-outs are recorded with their timestamp and message.</p></div>
        <label className="archive-search"><span>⌕</span><input name="userLogSearch" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search logs..." aria-label="Search user logs" /></label>
      </header>

      {status === 'loading' && <div className="user-logs-state">Loading user logs...</div>}
      {status === 'error' && <div className="user-logs-state user-logs-error"><p>{error}</p><button className="secondary-action" onClick={loadLogs}>Try again</button></div>}
      {status === 'success' && <div className="user-logs-table-wrap">
        <table className="user-logs-table">
          <thead><tr><th>Timestamp</th><th>Message</th></tr></thead>
          <tbody>{filteredLogs.map((log, index) => <tr key={`${log.timestamp}-${log.message}-${index}`}><td><time>{log.timestamp}</time></td><td><span className="log-status">✓</span>{log.message}</td></tr>)}</tbody>
        </table>
        {!filteredLogs.length && <div className="user-logs-state">{logs.length ? 'No logs match your search.' : 'No sign-ins or sign-outs have been recorded yet.'}</div>}
      </div>}
    </section>
  </main>
}
