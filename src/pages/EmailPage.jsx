import { useState } from 'react'
import { fetchEmails, updateEmailRemarks } from '../lib/appsScriptApi'
import { usePageData } from '../lib/usePageData'
import './EmailPage.css'
import EmailConversation from '../components/EmailConversation'

const remarkOptions = ['Incoming', 'For Information', 'Acknowledge', 'For Action', 'Invitations', 'Memorandum', 'Approved', 'Disapproved', 'Completed']
const columns = [['reference', 'Reference No'], ['dateReceived', 'Date Received'], ['receivedFrom', 'Received From'], ['subject', 'Subject'], ['remarks', 'Remarks']]

function EmailText({ value }) {
  const [expanded, setExpanded] = useState(false)
  const text = String(value || '')
  const long = text.length > 70
  return <>
    <span className="email-cell-text">{long && !expanded ? text.slice(0, 70).trimEnd() + '…' : text}</span>
    {long && <button type="button" className="email-see-more" aria-expanded={expanded} onClick={event => { event.stopPropagation(); setExpanded(value => !value) }}>{expanded ? 'See less' : 'See more'}</button>}
  </>
}

export default function EmailPage() {
  const [seenMessages, setSeenMessages] = useState(() => { try { return JSON.parse(localStorage.getItem('op-email-seen-replies') || '{}') } catch { return {} } })
  const [conversation, setConversation] = useState(null)
  function markConversationRead(email, latestMessageId) {
    const next = { ...seenMessages, [email.link]: latestMessageId || email.latestMessageId };
    setSeenMessages(next);
    try { localStorage.setItem('op-email-seen-replies', JSON.stringify(next)) } catch { /* Storage is optional. */ }
  }
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ field: 'dateReceived', direction: 'desc' })
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  function changeSort(field) {
    setSort(previous => ({ field, direction: previous.field === field && previous.direction === 'asc' ? 'desc' : 'asc' }))
    setPage(1)
  }
  const [saving, setSaving] = useState({})
  const [saveError, setSaveError] = useState('')
  const { data, setData, loading, error } = usePageData(true, fetchEmails, attempt, 30000)
  async function changeRemarks(email, remarks) {
    setSaving(previous => ({ ...previous, [email.link]: true }))
    setSaveError('')
    try {
      await updateEmailRemarks(email.link, remarks)
      setData(rows => rows.map(row => row.link === email.link ? { ...row, remarks } : row))
    } catch (error) { setSaveError(error.message) }
    finally { setSaving(previous => ({ ...previous, [email.link]: false })) }
  }
  const emails = (data || []).map(email => {
    const sender = String(email.receivedFrom || '')
    const name = sender.replace(/\s*<[^>]*>/g, '').trim().replace(/^"(.*)"$/, '$1')
    return { ...email, receivedFrom: name || sender.replace(/[<>]/g, '').trim() }
  })
  const receivedTime = email => Date.parse(String(email.latestReceivedAt || email.dateReceived || '').replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T')) || 0
  const filtered = emails
    .filter(email => [email.reference, email.dateReceived, email.receivedFrom, email.subject, email.remarks].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      const comparison = sort.field === 'dateReceived' ? receivedTime(a) - receivedTime(b)
        : String(a[sort.field] || '').localeCompare(String(b[sort.field] || ''), undefined, { numeric: true, sensitivity: 'base' })
      return sort.direction === 'asc' ? comparison : -comparison
    })
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const start = (currentPage - 1) * pageSize
  const visible = filtered.slice(start, start + pageSize)

  return <main className="dashboard-content user-logs-page email-page">
    <div className="page-title-row">
      <div><p className="eyebrow">Workspace</p><h1>Email</h1><p>Received email records from the Email sheet. Updates automatically.</p></div>
    </div>
    <section className="user-logs-panel">
      <header className="user-logs-header">
        <div><h2>Email register</h2><p>{emails.length} records</p></div>
        <div className="email-table-controls">
          <label>Show <select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }} aria-label="Emails per page">{[10, 20, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
          <label className="email-mobile-sort">Sort by <select value={sort.field} onChange={event => changeSort(event.target.value)}>{columns.map(([field, label]) => <option key={field} value={field}>{label}</option>)}</select><button type="button" onClick={() => { setSort(previous => ({ ...previous, direction: previous.direction === 'asc' ? 'desc' : 'asc' })); setPage(1) }}>{sort.direction === 'asc' ? 'Ascending' : 'Descending'}</button></label>
          <label className="archive-search"><input value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="Search emails..." aria-label="Search emails" /></label>
        </div>
      </header>
      {loading && <div className="user-logs-state" role="status">Loading emails...</div>}
      {saveError && <div className="user-logs-state user-logs-error" role="alert">{saveError}</div>}
      {error && <div className="user-logs-state user-logs-error" role="alert"><p>{error}</p><button className="secondary-action" onClick={() => setAttempt(value => value + 1)}>Try again</button></div>}
      {!loading && !error && <div className="user-logs-table-wrap">
        <table className="user-logs-table">
          <thead><tr>{columns.map(([field, label]) => <th key={field} scope="col" aria-sort={sort.field === field ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}><button className="email-sort-button" type="button" onClick={() => changeSort(field)}>{label} <span aria-hidden="true">{sort.field === field ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>)}<th scope="col">Links</th></tr></thead>
          <tbody>{visible.map((email, index) => <tr key={email.link || `${email.reference}-${email.timestamp}-${start + index}`} className={email.link ? 'email-clickable-row' : ''} onClick={() => { if (email.link) setConversation(email) }}>
            <td data-label="Reference No"><EmailText value={email.reference} /></td>
            <td data-label="Date Received">{email.dateReceived}</td>
            <td data-label="Received From"><EmailText value={email.receivedFrom} /></td>
            <td data-label="Subject"><EmailText value={email.subject} />{email.latestMessageId && seenMessages[email.link] !== email.latestMessageId && <span className="email-new-badge" title="New email in this conversation" aria-label="New email in this conversation">New</span>}</td>
            <td data-label="Remarks" onClick={event => event.stopPropagation()}><select className="email-remarks-select" aria-label={`Remarks for ${email.reference || email.subject}`} value={email.remarks || ''} disabled={!email.link || saving[email.link]} onChange={event => changeRemarks(email, event.target.value)}>
              {!remarkOptions.includes(email.remarks) && <option value={email.remarks || ''}>{email.remarks || 'Select remarks'}</option>}
              {remarkOptions.map(remark => <option key={remark} value={remark}>{remark}</option>)}
            </select>{saving[email.link] && <span role="status">Saving...</span>}</td>
            <td data-label="Links">{email.link && <button type="button" className="email-see-more" onClick={event => { event.stopPropagation(); setConversation(email) }}>Open conversation</button>}</td>
          </tr>)}</tbody>
        </table>
        {!filtered.length && <div className="user-logs-state">{emails.length ? 'No emails match your search.' : 'No email records yet.'}</div>}
        <footer className="email-pagination">
          <span>{filtered.length ? `Showing ${start + 1}–${Math.min(start + pageSize, filtered.length)} of ${filtered.length}` : 'Showing 0 records'}</span>
          <nav aria-label="Email table pagination">
            <button type="button" disabled={currentPage === 1} onClick={() => setPage(1)}>First</button>
            <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
            <span aria-live="polite">Page {currentPage} of {pageCount}</span>
            <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
            <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(pageCount)}>Last</button>
          </nav>
        </footer>
      </div>}
    </section>
    {conversation && <EmailConversation email={conversation} onClose={() => setConversation(null)} onRead={markConversationRead} />}
  </main>
}

