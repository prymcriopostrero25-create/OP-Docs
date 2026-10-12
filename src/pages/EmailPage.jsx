import { useState } from 'react'
import { fetchEmails, updateEmailRemarks } from '../lib/appsScriptApi'
import { usePageData } from '../lib/usePageData'
import './EmailPage.css'

const remarkOptions = ['Incoming', 'For Information', 'Acknowledge', 'For Action', 'Invitations', 'Memorandum', 'Approved', 'Disapproved', 'Completed']

function EmailText({ value }) {
  const [expanded, setExpanded] = useState(false)
  const text = String(value || '')
  const long = text.length > 70
  return <>
    <span className="email-cell-text">{long && !expanded ? text.slice(0, 70).trimEnd() + '…' : text}</span>
    {long && <button type="button" className="email-see-more" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'See less' : 'See more'}</button>}
  </>
}

export default function EmailPage() {
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
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
  const receivedTime = email => Date.parse(String(email.dateReceived || '').replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T')) || 0
  const filtered = emails
    .filter(email => [email.reference, email.dateReceived, email.receivedFrom, email.subject, email.remarks].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => receivedTime(b) - receivedTime(a))

  return <main className="dashboard-content user-logs-page email-page">
    <div className="page-title-row">
      <div><p className="eyebrow">Workspace</p><h1>Email</h1><p>Received email records from the Email sheet. Updates automatically.</p></div>
    </div>
    <section className="user-logs-panel">
      <header className="user-logs-header">
        <div><h2>Email register</h2><p>{emails.length} records</p></div>
        <label className="archive-search"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search emails..." aria-label="Search emails" /></label>
      </header>
      {loading && <div className="user-logs-state" role="status">Loading emails...</div>}
      {saveError && <div className="user-logs-state user-logs-error" role="alert">{saveError}</div>}
      {error && <div className="user-logs-state user-logs-error" role="alert"><p>{error}</p><button className="secondary-action" onClick={() => setAttempt(value => value + 1)}>Try again</button></div>}
      {!loading && !error && <div className="user-logs-table-wrap">
        <table className="user-logs-table">
          <thead><tr>{['Reference No', 'Date Received', 'Received From', 'Subject', 'Remarks', 'Links'].map(header => <th key={header} scope="col">{header}</th>)}</tr></thead>
          <tbody>{filtered.map((email, index) => <tr key={`${email.link}-${index}`}>
            <td data-label="Reference No"><EmailText value={email.reference} /></td>
            <td data-label="Date Received">{email.dateReceived}</td>
            <td data-label="Received From"><EmailText value={email.receivedFrom} /></td>
            <td data-label="Subject"><EmailText value={email.subject} /></td>
            <td data-label="Remarks"><select className="email-remarks-select" aria-label={`Remarks for ${email.reference || email.subject}`} value={email.remarks || ''} disabled={!email.link || saving[email.link]} onChange={event => changeRemarks(email, event.target.value)}>
              {!remarkOptions.includes(email.remarks) && <option value={email.remarks || ''}>{email.remarks || 'Select remarks'}</option>}
              {remarkOptions.map(remark => <option key={remark} value={remark}>{remark}</option>)}
            </select>{saving[email.link] && <span role="status">Saving...</span>}</td>
            <td data-label="Links">{email.link && <a href={email.link} target="_blank" rel="noopener noreferrer">Open email</a>}</td>
          </tr>)}</tbody>
        </table>
        {!filtered.length && <div className="user-logs-state">{emails.length ? 'No emails match your search.' : 'No email records yet.'}</div>}
      </div>}
    </section>
  </main>
}
