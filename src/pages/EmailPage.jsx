import { useEffect, useRef, useState } from 'react'
import { fetchEmails, updateEmailRemarks, updateEmailRowColor, deleteEmail } from '../lib/appsScriptApi'
import { usePageData } from '../lib/usePageData'
import './EmailPage.css'
import EmailConversation from '../components/EmailConversation'
import EmailIcon from '../components/EmailIcon'
import EmailForward from '../components/EmailForward'

const remarkOptions = ['Incoming', 'For Information', 'Acknowledge', 'Invitations', 'Memorandum', 'Forwarded']
const columns = [['reference', 'Reference No'], ['dateReceived', 'Date Received'], ['receivedFrom', 'Received From'], ['subject', 'Subject'], ['remarks', 'Remarks']]
const rowColors = [['#f4cccc', 'Red', '#dc4444'], ['#fff2cc', 'Yellow', '#f0c62e'], ['#e2f0d9', 'Green', '#48a35a']]

function RemarksNotice({ message, onClose }) {
  const dialog = useRef(null)
  useEffect(() => { dialog.current.showModal() }, [])
  return <dialog ref={dialog} className="email-remarks-notice" aria-labelledby="remarks-notice-title" aria-describedby="remarks-notice-message" onCancel={onClose} onClose={onClose}>
    <div className="email-remarks-notice-content">
      <span className="email-remarks-notice-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 12 4 4 8-8" /></svg>
      </span>
      <h2 id="remarks-notice-title">Remarks Updated</h2>
      <p id="remarks-notice-message">{message}</p>
    </div>
    <footer className="email-remarks-notice-footer">
      <button type="button" autoFocus onClick={onClose}>Done</button>
    </footer>
  </dialog>
}

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
  const registerTop = useRef(null)
  function navigatePage(number) {
    setPage(number)
    requestAnimationFrame(() => registerTop.current?.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    }))
  }
  const [seenMessages, setSeenMessages] = useState(() => { try { return JSON.parse(localStorage.getItem('op-email-seen-replies') || '{}') } catch { return {} } })
  const [conversation, setConversation] = useState(null)
  const [forward, setForward] = useState(null)
  function openConversation(email) {
    if (!email.link) return
    setConversation(email)
  }
  function markConversationRead(email, latestMessageId) {
    const next = { ...seenMessages, [email.link]: latestMessageId || email.latestMessageId };
    setSeenMessages(next);
    try { localStorage.setItem('op-email-seen-replies', JSON.stringify(next)) } catch { /* Storage is optional. */ }
  }
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [remarkFilter, setRemarkFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateUntil, setDateUntil] = useState('')
  const [sort, setSort] = useState({ field: 'dateReceived', direction: 'desc' })
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  function selectRemark(remark) {
    setRemarkFilter(remark)
    setPage(1)
  }
  function changeSort(field) {
    setSort(previous => ({ field, direction: previous.field === field && previous.direction === 'asc' ? 'desc' : 'asc' }))
    setPage(1)
  }
  const [saving, setSaving] = useState({})
  const [saveError, setSaveError] = useState('')
  const [saveNotice, setSaveNotice] = useState('')
  const { data, setData, loading, error } = usePageData(true, fetchEmails, attempt, 30000)
  async function removeEmail(email) {
    if (saving[email.link] || !window.confirm(`Delete "${email.subject || email.reference}"? This moves the entire Gmail conversation to Trash and removes it from the register.`)) return
    setSaving(previous => ({ ...previous, [email.link]: true }))
    setSaveError('')
    try {
      await deleteEmail(email.link)
      setData(rows => rows.filter(row => row.link !== email.link))
    } catch (error) { setSaveError(error.message) }
    finally { setSaving(previous => ({ ...previous, [email.link]: false })) }
  }
  async function changeRowColor(email, color) {
    setSaving(previous => ({ ...previous, [email.link]: true }))
    setSaveError('')
    try {
      await updateEmailRowColor(email.link, color)
      setData(rows => rows.map(row => row.link === email.link ? { ...row, rowColor: color } : row))
    } catch (error) { setSaveError(error.message) }
    finally { setSaving(previous => ({ ...previous, [email.link]: false })) }
  }
  async function changeRemarks(email, remarks) {
    setSaving(previous => ({ ...previous, [email.link]: true }))
    setSaveError('')
    setSaveNotice('')
    try {
      const result = await updateEmailRemarks(email.link, remarks)
      setSaveNotice(result.emailSent ? `Email sent to the sender.` : 'Remarks Updated.')
      setData(rows => rows.map(row => row.link === email.link ? { ...row, remarks } : row))
    } catch (error) { setSaveError(error.message) }
    finally { setSaving(previous => ({ ...previous, [email.link]: false })) }
  }
  const emails = (data || []).map(email => {
    const sender = String(email.receivedFrom || '')
    const name = sender.replace(/\s*<[^>]*>/g, '').trim().replace(/^"(.*)"$/, '$1')
    return { ...email, senderAddress: sender, receivedFrom: name || sender.replace(/[<>]/g, '').trim() }
  })
  const receivedTime = email => Date.parse(String(email.latestReceivedAt || email.dateReceived || '').replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T')) || 0
  const isUnread = email => Boolean(email.latestMessageId && seenMessages[email.link] !== email.latestMessageId)
  const activeFilters = query || remarkFilter || dateFrom || dateUntil
  function resetFilters() {
    setQuery(''); setRemarkFilter(''); setDateFrom(''); setDateUntil(''); setPage(1)
  }
  const filtered = emails
    .filter(email => !remarkFilter || email.remarks === remarkFilter)
    .filter(email => {
      const time = receivedTime(email)
      return (!dateFrom || time >= Date.parse(dateFrom + 'T00:00:00+08:00')) && (!dateUntil || time < Date.parse(dateUntil + 'T00:00:00+08:00') + 86400000)
    })
    .filter(email => [email.reference, email.dateReceived, email.senderAddress, email.receivedFrom, email.subject, email.remarks].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
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
      <div><p className="eyebrow">Office of the President / Correspondence</p><h1>Email Correspondence</h1><p>Manage official communications and keep every conversation on record.</p></div>
      <button type="button" className="secondary-action email-refresh" disabled={loading} onClick={() => setAttempt(value => value + 1)}><EmailIcon name="refresh" size={16} />{loading ? 'Refreshing…' : 'Refresh'}</button>
    </div>
    <section className="email-summary" aria-label="Correspondence overview">
      {[
        { label: 'All Correspondence', value: emails.length, icon: 'inbox', detail: 'Registered Conversations', remark: '' },
        { label: 'Incoming', value: emails.filter(email => email.remarks === 'Incoming').length, icon: 'download', detail: 'Received correspondence', remark: 'Incoming' },
        { label: 'Acknowledge', value: emails.filter(email => email.remarks === 'Acknowledge').length, icon: 'clock', detail: 'Acknowledged correspondence', remark: 'Acknowledge' },
        { label: 'Forwarded', value: emails.filter(email => email.remarks === 'Forwarded').length, icon: 'check', detail: 'Referred correspondence', remark: 'Forwarded' },
      ].map(item => <button type="button" key={item.label} className={`email-summary-card ${remarkFilter === item.remark ? 'is-active' : ''}`} aria-pressed={remarkFilter === item.remark} onClick={() => selectRemark(item.remark)}>
        <span className="email-summary-icon"><EmailIcon name={item.icon} size={21} /></span>
        <span className="email-summary-copy"><span>{item.label}</span><strong>{loading && !data ? '?' : item.value.toLocaleString()}</strong><small>{item.detail}</small></span>
        <EmailIcon name="arrow" size={16} />
      </button>)}
    </section>
    <section ref={registerTop} className="user-logs-panel">
      <header className="user-logs-header">
        <div className="email-register-title"><span className="email-register-icon"><EmailIcon name="inbox" size={21} /></span><div><h2>Correspondence Inbox</h2><p><span className="email-live-dot" /> Live sync · Updates every 30 seconds</p></div></div>
        <div className="email-table-controls">
          <label>Show <select value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }} aria-label="Emails per page">{[10, 20, 50].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
          <label className="email-mobile-sort">Sort by <select value={sort.field} onChange={event => changeSort(event.target.value)}>{columns.map(([field, label]) => <option key={field} value={field}>{label}</option>)}</select><button type="button" onClick={() => { setSort(previous => ({ ...previous, direction: previous.direction === 'asc' ? 'desc' : 'asc' })); setPage(1) }}>{sort.direction === 'asc' ? 'Ascending' : 'Descending'}</button></label>
          <label className="archive-search"><EmailIcon name="search" size={17} /><input value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="Search correspondence…" aria-label="Search emails" /></label>
        </div>
      </header>
      <nav className="email-category-tabs" aria-label="Filter correspondence by remarks">
        {['', ...remarkOptions].map(remark => <button key={remark || 'all'} type="button" aria-pressed={remarkFilter === remark} className={remarkFilter === remark ? 'is-active' : ''} onClick={() => selectRemark(remark)}>{remark || 'All correspondence'}<span>{(remark ? emails.filter(email => email.remarks === remark).length : emails.length).toLocaleString()}</span></button>)}
      </nav>
      <div className="email-filter-bar">
        <span className="email-filter-label">Date received</span>
        <label>From<input type="date" value={dateFrom} max={dateUntil || undefined} onChange={event => { setDateFrom(event.target.value); setPage(1) }} /></label>
        <label>To<input type="date" value={dateUntil} min={dateFrom || undefined} onChange={event => { setDateUntil(event.target.value); setPage(1) }} /></label>
        <div className="email-filter-result" role="status">{filtered.length} matching {filtered.length === 1 ? 'conversation' : 'conversations'}{activeFilters && <button type="button" className="email-see-more" onClick={resetFilters}>Clear filters</button>}</div>
      </div>
      {loading && <div className="user-logs-state" role="status">Loading emails...</div>}
      {saveError && <div className="user-logs-state user-logs-error" role="alert">{saveError}</div>}
      {error && <div className="user-logs-state user-logs-error" role="alert"><p>{error}</p><button className="secondary-action" onClick={() => setAttempt(value => value + 1)}>Try again</button></div>}
      {!loading && !error && <div className="user-logs-table-wrap">
        <table className="user-logs-table">
          <thead><tr>{columns.map(([field, label]) => <th key={field} scope="col" aria-sort={sort.field === field ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}><button className="email-sort-button" type="button" onClick={() => changeSort(field)}>{label} <span aria-hidden="true">{sort.field === field ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</span></button></th>)}<th scope="col">Actions</th></tr></thead>
          <tbody>{visible.map((email, index) => <tr key={email.link || `${email.reference}-${email.timestamp}-${start + index}`} className={`${email.link ? 'email-clickable-row' : ''} ${isUnread(email) ? 'email-unread-row' : ''}`} style={rowColors.some(([color]) => color && color === email.rowColor) ? { backgroundColor: email.rowColor } : undefined} onClick={() => openConversation(email)}>
            <td data-label="Reference No"><EmailText value={email.reference} /></td>
            <td data-label="Date Received">{email.dateReceived}</td>
            <td data-label="Received From"><div className="email-sender"><span className="email-avatar" aria-hidden="true">{email.receivedFrom.slice(0, 1).toUpperCase() || '?'}</span><span title={email.senderAddress}><EmailText value={email.receivedFrom} /></span></div></td>
            <td data-label="Subject"><strong className="email-subject"><EmailText value={email.subject || '(No subject)'} /></strong>{email.replyCount > 0 && <small className="email-reply-count">{email.replyCount} {email.replyCount === 1 ? 'reply' : 'replies'}</small>}{email.latestMessageId && seenMessages[email.link] !== email.latestMessageId && <span className="email-new-badge" title="New email in this conversation" aria-label="New email in this conversation">New</span>}</td>
            <td data-label="Remarks" onClick={event => event.stopPropagation()}><select className="email-remarks-select" data-remark={email.remarks} aria-label={`Remarks for ${email.reference || email.subject}`} value={email.remarks || ''} disabled={!email.link || saving[email.link]} onChange={event => changeRemarks(email, event.target.value)}>
              {!remarkOptions.includes(email.remarks) && <option value={email.remarks || ''}>{email.remarks || 'Select remarks'}</option>}
              {remarkOptions.map(remark => <option key={remark} value={remark}>{remark}</option>)}
            </select><div className="email-row-color" role="group" aria-label={`Row color for ${email.reference || email.subject}`}>{rowColors.map(([color, label, swatch]) => <button key={color} type="button" className="email-color-swatch" style={{ backgroundColor: swatch }} aria-label={`${label} row highlight`} title={`${label} — click again to clear`} aria-pressed={email.rowColor === color} disabled={!email.link || saving[email.link]} onClick={() => changeRowColor(email, email.rowColor === color ? '' : color)} />)}</div>{saving[email.link] && <span role="status">Saving...</span>}</td>
            <td data-label="Actions">{email.link && <div className="email-row-actions"><button type="button" className="email-open-conversation" title="Open conversation" aria-label={`Open conversation: ${email.subject || email.reference}`} onClick={event => { event.stopPropagation(); openConversation(email) }}><EmailIcon name="external" size={17} /></button><button type="button" className="email-open-conversation" title="Forward" aria-label={`Forward: ${email.subject || email.reference}`} onClick={event => { event.stopPropagation(); setForward(email) }}><EmailIcon name="arrow" size={17} /></button><button type="button" className="email-open-conversation" title="Delete conversation" aria-label={`Delete conversation: ${email.subject || email.reference}`} disabled={saving[email.link]} onClick={event => { event.stopPropagation(); removeEmail(email) }}><EmailIcon name="trash" size={17} /></button></div>}</td>
          </tr>)}</tbody>
        </table>
        {!filtered.length && <div className="user-logs-state">{emails.length ? 'No conversations match these filters. Try a different search or clear the filters.' : 'No email records yet.'}</div>}
        <footer className="email-pagination">
          <span>{filtered.length ? `Showing ${start + 1}–${Math.min(start + pageSize, filtered.length)} of ${filtered.length}` : 'Showing 0 records'}</span>
          <nav aria-label="Email table pagination">
            <button type="button" disabled={currentPage === 1} onClick={() => setPage(1)}>First</button>
            <button type="button" disabled={currentPage === 1} onClick={() => navigatePage(currentPage - 1)}>Previous</button>
            <span aria-live="polite">Page {currentPage} of {pageCount}</span>
            <button type="button" disabled={currentPage === pageCount} onClick={() => navigatePage(currentPage + 1)}>Next</button>
            <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(pageCount)}>Last</button>
          </nav>
        </footer>
      </div>}
    </section>
    {conversation && <EmailConversation email={conversation} onClose={() => setConversation(null)} onRead={markConversationRead} />}
    {forward && <EmailForward email={forward} onClose={() => setForward(null)} onForwarded={() => setData(rows => rows.map(row => row.link === forward.link ? { ...row, remarks: 'Forwarded' } : row))} />}
    {saveNotice && <RemarksNotice message={saveNotice} onClose={() => setSaveNotice('')} />}
  </main>
}

