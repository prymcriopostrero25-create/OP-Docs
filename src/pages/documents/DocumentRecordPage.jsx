import { DocumentContext } from '../../lib/documentContext'
import { useContext, useEffect, useMemo, useRef, useState } from 'react'


const statuses = ['All statuses', 'Draft', 'For Review', 'For Signature', 'Approved', 'Out']

function UpdatedDate({ value }) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return <span className="record-muted">Not available</span>
  return <time className="record-date" dateTime={date.toISOString()} title={date.toLocaleString()}><span>{date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span><small>{date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</small></time>
}

function ActionIcon({ kind }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind === 'edit' ? <><path d="m16 3 5 5-12 12-6 1 1-6Z" /><path d="m14 5 5 5" /></> : kind === 'preview' ? <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></> : <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>}</svg>
}

export default function DocumentRecordPage({ title, type }) {
  const { records, changeStatus, editRecord, deleteRecord, permissions, loading, loadError } = useContext(DocumentContext)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewDialog = useRef(null)
  const [action, setAction] = useState(null)
  const [editedTitle, setEditedTitle] = useState('')
  const [actionError, setActionError] = useState('')
  const actionDialog = useRef(null)
  const actionBusy = useRef(false)

  useEffect(() => {
    if (!action) return
    const trigger = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    actionDialog.current.showModal()
    return () => { document.body.style.overflow = previousOverflow; trigger?.focus() }
  }, [action])

  function openAction(kind, record) {
    setEditedTitle(record.title)
    setActionError('')
    setAction({ kind, record })
  }

  async function submitAction(event) {
    event.preventDefault()
    if (actionBusy.current) return
    actionBusy.current = true
    setSaving(true)
    setActionError('')
    try {
      if (action.kind === 'edit') await editRecord(action.record.reference, editedTitle.trim())
      else await deleteRecord(action.record.reference)
      setAction(null)
    } catch (failure) { setActionError(failure.message) }
    finally { actionBusy.current = false; setSaving(false) }
  }

  useEffect(() => {
    if (!preview) return
    const trigger = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    previewDialog.current.showModal()
    return () => {
      document.body.style.overflow = previousOverflow
      trigger?.focus()
    }
  }, [preview])

  function openPreview(record) {
    setPreview(record)
    setPreviewLoading(true)
  }

  function closePreview() {
    setPreview(null)
    setPreviewLoading(false)
  }
  async function saveStatus(id, value) {
    setSaving(true); setError('')
    try { await changeStatus(id, value) } catch (failure) { setError(failure.message) }
    finally { setSaving(false) }
  }
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All statuses')

  const visibleRecords = useMemo(() => {
    const search = query.trim().toLowerCase()
    return records.filter((record) => {
      const matchesType = !type || record.type === type
      const matchesStatus = status === 'All statuses' || record.status === status
      const matchesSearch = !search || Object.values(record).some((value) => String(value).toLowerCase().includes(search))
      return matchesType && matchesStatus && matchesSearch
    })
  }, [query, status, type, records])

  return (
    <section className="documents-panel document-registry">
      {(error || loadError) && <p role="alert">{error || loadError}</p>}
      {loading && <p role="status">Loading documents...</p>}
      <div className="documents-toolbar">
        <div className="document-search"><span aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg></span><input name="documentSearch" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents..." aria-label={`Search ${title}`} /></div>
        <select name="statusFilter" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status">{statuses.map((option) => <option key={option}>{option}</option>)}</select>
        {(query || status !== 'All statuses') && <button type="button" className="filter-button" onClick={() => { setQuery(''); setStatus('All statuses') }}>Clear filters</button>}
      </div>
      <div className="registry-heading"><div><h2>{title}</h2><p>{visibleRecords.length} shown from {records.filter(record => !type || record.type === type).length} records</p></div><button>⇩ Export list</button></div>
      <div className="table-wrap registry-table"><table>
        <thead><tr><th>Document</th><th>Type</th><th>Owner</th><th>Last updated</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {visibleRecords.map((record, index) => <tr key={JSON.stringify([record.type, record.reference, record.url, index])}>
            <td><div className="doc-cell"><span className="file-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M14 3H5v18h14V8Z M14 3v5h5 M8 12h8 M8 16h6" /></svg></span><div><strong title={record.title}>{record.title}</strong><small title={record.reference}>Ref: {record.reference}</small></div></div></td>
            <td><span className="record-type">{record.type}</span></td><td><span className={!record.owner || record.owner === '?' ? 'record-muted' : 'record-owner'}>{!record.owner || record.owner === '?' ? 'Unassigned' : record.owner}</span></td><td><UpdatedDate value={record.updated} /></td>
            <td>{permissions.changeStatus && record.status !== 'Out' ? <select name={`status-${record.reference}`} className={`record-status ${record.status.toLowerCase().replaceAll(' ', '-')}`} aria-label={`Change status for ${record.title}`} disabled={saving} value={record.status} onChange={(event) => saveStatus(record.reference, event.target.value)}>{statuses.slice(1).map((option) => <option key={option}>{option}</option>)}</select> : <span className={`status ${record.status.toLowerCase().replaceAll(' ', '-')}`}>{record.status === 'Out' ? 'OUT' : record.status}</span>}</td>
            <td><div className="record-actions">
              <button type="button" aria-label={`Edit ${record.title}`} title={record.status === 'Out' ? 'OUT documents are locked' : !permissions.changeStatus ? 'Admin access required' : 'Edit title'} disabled={saving || !permissions.changeStatus || record.status === 'Out'} onClick={() => openAction('edit', record)}><ActionIcon kind="edit" /></button>
              <button type="button" aria-label={`Preview ${record.title}`} title="Preview" disabled={!/^https:\/\/drive\.google\.com\/file\/d\/[a-zA-Z0-9_-]+\/(view|preview)$/.test(record.url || '')} onClick={() => openPreview(record)}><ActionIcon kind="preview" /></button>
              <button type="button" className="delete-record" aria-label={`Delete ${record.title}`} title={record.status === 'Out' ? 'OUT documents are locked' : !permissions.changeStatus ? 'Admin access required' : 'Delete'} disabled={saving || !permissions.changeStatus || record.status === 'Out'} onClick={() => openAction('delete', record)}><ActionIcon kind="delete" /></button>
            </div></td>
          </tr>)}
          {!visibleRecords.length && <tr><td colSpan="6" className="empty-records">No documents match your search.</td></tr>}
        </tbody>
      </table></div>
      <div className="documents-pagination"><span>{visibleRecords.length} records</span></div>
      {action && <dialog ref={actionDialog} className="record-action-dialog" aria-labelledby="record-action-title" onCancel={event => { if (actionBusy.current) event.preventDefault(); else setAction(null) }}>
        <form onSubmit={submitAction}>
          <h2 id="record-action-title">{action.kind === 'edit' ? 'Edit document title' : 'Delete document?'}</h2>
          {action.kind === 'edit' ? <label>Document title<input name="documentTitle" autoFocus required maxLength={200} value={editedTitle} disabled={saving} onChange={event => setEditedTitle(event.target.value)} /></label> : <p>Delete “{action.record.title}”? This removes its rows from Google Sheets and moves its PDF to Google Drive Trash.</p>}
          {actionError && <p role="alert">{actionError}</p>}
          <footer><button type="button" className="secondary-action" autoFocus={action.kind === 'delete'} disabled={saving} onClick={() => setAction(null)}>Cancel</button><button type="submit" className="primary-action" disabled={saving || (action.kind === 'edit' && !editedTitle.trim())}>{saving ? 'Saving...' : action.kind === 'edit' ? 'Save changes' : 'Delete document'}</button></footer>
        </form>
      </dialog>}
      {preview && <dialog ref={previewDialog} className="pdf-preview-dialog" aria-labelledby="pdf-preview-title" onCancel={closePreview} onClose={closePreview}>
        <header><h2 id="pdf-preview-title">{preview.title}</h2><button type="button" className="secondary-action" autoFocus onClick={closePreview}>Close preview</button></header>
        <div className="preview-frame-wrap">
          {previewLoading && <div className="preview-loading" role="status" aria-live="polite"><span className="preview-spinner" /><span className="preview-loading-text">Loading preview...</span></div>}
          <iframe title={`PDF preview: ${preview.title}`} src={`https://drive.google.com/file/d/${preview.url.split('/')[5]}/preview`} onLoad={() => setPreviewLoading(false)} onError={() => setPreviewLoading(false)} />
        </div>
      </dialog>}
    </section>
  )
}
