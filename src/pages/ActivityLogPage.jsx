import { useContext, useState } from 'react'
import { DocumentContext } from '../lib/documentContext'
import './ActivityLogPage.css'

const dateFormat = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })
const timeFormat = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' })
const timestamp = value => value && !Number.isNaN(Date.parse(value)) ? Date.parse(value) : null

export default function ActivityLogPage() {
  const { activityLogs, loading, loadError } = useContext(DocumentContext)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('newest')
  const entries = activityLogs.map((file, index) => ({ ...file, entryKey: JSON.stringify([file.id, file.date, file.activity, index]) })).filter(file => `${file.subject || ''} ${file.activity || ''} ${file.type || ''}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => {
    const first = timestamp(a.date), second = timestamp(b.date)
    if (first === null) return second === null ? 0 : 1
    if (second === null) return -1
    return sort === 'newest' ? second - first : first - second
  })
  return <main className="dashboard-content activity-log-page">
    <header className="activity-log-title"><p className="eyebrow">Document history</p><h1>Activity log</h1><p>Review document uploads and find recent activity.</p></header>
    <section className="activity-log-panel" aria-labelledby="history-title" aria-busy={loading}>
      <div className="activity-log-heading">
        <div><h2 id="history-title">Activity history <span>{activityLogs.length}</span></h2><p>All times in Philippine time (UTC+8)</p></div>
        <div className="activity-log-controls"><input type="search" aria-label="Search activity" placeholder="Search documents or activity..." value={query} onChange={event => setQuery(event.target.value)} /><select aria-label="Sort activity" value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div>
      </div>
      {loadError && <p className="activity-log-error" role="alert">{loadError}</p>}
      {loading ? <p className="activity-log-state" role="status">Loading activity...</p> : <>
        {entries.length ? <div className="activity-log-table-wrap"><table className="activity-log-table"><thead><tr><th scope="col">Document</th><th scope="col">Activity</th><th scope="col">Date & time</th></tr></thead><tbody>{entries.map(file => {
          const date = timestamp(file.date)
          return <tr key={file.entryKey}><td><div className="activity-log-document"><span className="activity-log-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z" /><path d="M14 3v5h5M8 12h8M8 16h6" /></svg></span><div><strong>{file.subject || 'Untitled document'}</strong>{file.type && <small>{file.type}</small>}</div></div></td><td><span className="activity-log-badge">{file.activity || 'Uploaded'}</span></td><td>{date !== null ? <time dateTime={new Date(date).toISOString()}><strong>{dateFormat.format(date)}</strong><small>{timeFormat.format(date)}</small></time> : 'Date unavailable'}</td></tr>
        })}</tbody></table></div> : <div className="activity-log-state"><strong>{query.trim() ? 'No matching activity' : loadError ? 'Activity could not be loaded' : 'No activity yet'}</strong><p>{query.trim() ? 'Try another document name, type, or activity.' : loadError ? 'Please try again later.' : 'Document uploads will appear here.'}</p>{query && <button onClick={() => setQuery('')}>Clear search</button>}</div>}
        <footer className="activity-log-footer" role="status">Showing {entries.length} of {activityLogs.length} {activityLogs.length === 1 ? 'activity' : 'activities'}</footer>
      </>}
    </section>
  </main>
}
