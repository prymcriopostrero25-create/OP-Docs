import { DocumentContext } from '../../lib/documentContext'
import { documentTypeLabel } from '../../lib/documentTypes'
import { filterRecords, recordsCsv, downloadFile } from '../../lib/recordTools'
import SendDocument from '../../components/SendDocument'
import DocumentPage from '../../components/DocumentPage'
import DocumentPages from '../../components/DocumentPages'
import CreateDocument from '../../components/CreateDocument'
import { prepareDocumentPreview, documentPage, documentDetails, updateDocumentContent } from '../../lib/appsScriptApi'
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

function PreviewActionIcon({ kind }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind === 'send' ? <path d="m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2" /> : kind === 'save' ? <><path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5M12 11v6m-3-3 3 3 3-3" /></> : <path d="m6 6 12 12M18 6 6 18" />}</svg>
}

export default function DocumentRecordPage({ title, type, initialStatus = 'All statuses' }) {
  const { records, changeStatus, editRecord, deleteRecord, permissions, loading, loadError, setFiles, refreshRecords } = useContext(DocumentContext)
  const [emailRecord, setEmailRecord] = useState(null)
  const [editing, setEditing] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [sort, setSort] = useState('newest')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [pageContent, setPageContent] = useState(null)
  const [pdfError, setPdfError] = useState('')
  const [preparedPreview, setPreparedPreview] = useState(null)
  const [previewError, setPreviewError] = useState('')
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

  async function openAction(kind, record) {
    if (kind === 'edit' && record.editableContent) {
      setSaving(true); setError('')
      try { const form = await documentDetails(record.reference); setEditing({ record, form }) }
      catch (failure) { setError(failure.message) }
      finally { setSaving(false) }
      return
    }
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
    let cancelled = false
    let objectUrl
    documentPage(preview.reference).then(result => {
      if (cancelled) return
      setPageContent({ ...result, type: result.type || preview.type })
      if (result.deploymentRequired) setPreviewError('Page preview needs the latest Apps Script deployment. Showing the registered PDF when ready. Update the existing web app to a new version, then retry.')
      if (result.form) setPreviewLoading(false)
    }).catch(failure => {
      if (!cancelled) { setPageContent({ form: null }); setPreviewError('Unable to load the page. ' + failure.message + ' The registered PDF will display when ready.'); setPreviewLoading(false) }
    })
    prepareDocumentPreview(preview.reference, preview.type).then(result => {
      if (cancelled) return
      const bytes = Uint8Array.from(atob(result.data), character => character.charCodeAt(0))
      const file = new File([bytes], result.name, { type: 'application/pdf' })
      objectUrl = URL.createObjectURL(file)
      setPreparedPreview({ file, url: objectUrl })
    }).catch(failure => {
      if (!cancelled) {
        setPdfError('Unable to prepare the PDF. ' + failure.message)
      }
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      document.body.style.overflow = previousOverflow
      trigger?.focus()
    }
  }, [preview])

  function openPreview(record) {
    setPreparedPreview(null)
    setPageContent(null)
    setPdfError('')
    setPreviewError('')
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
  const [status, setStatus] = useState(initialStatus)

  const visibleRecords = useMemo(() => filterRecords(records, { type, query, status, start, end, sort }), [records, type, query, status, start, end, sort])
  const pageCount = Math.max(1, Math.ceil(visibleRecords.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageRecords = visibleRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const resetFilters = () => { setQuery(''); setStatus('All statuses'); setStart(''); setEnd(''); setPage(1) }
  return (
    <section className="documents-panel document-registry">
      {(error || loadError) && <p role="alert">{error || loadError}</p>}
      {loading && <p role="status">Loading documents...</p>}
      <div className="documents-toolbar">
        <div className="document-search"><span aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg></span><input name="documentSearch" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search documents..." aria-label={`Search ${title}`} /></div>
        <select name="statusFilter" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} aria-label="Filter by status">{statuses.map((option) => <option key={option}>{option}</option>)}</select>
        <input type="date" aria-label="From date" value={start} max={end} onChange={event => { setStart(event.target.value); setPage(1) }} /><input type="date" aria-label="Until date" value={end} min={start} onChange={event => { setEnd(event.target.value); setPage(1) }} /><select aria-label="Sort documents" value={sort} onChange={event => { setSort(event.target.value); setPage(1) }}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option></select>
        {(query || start || end || status !== 'All statuses') && <button type="button" className="filter-button" onClick={resetFilters}>Clear filters</button>}
      </div>
      <div className="registry-heading"><div><h2>{title}</h2><p>{visibleRecords.length} shown from {records.filter(record => !type || record.type === type).length} records</p></div><div><button onClick={refreshRecords} disabled={loading}>Refresh</button><button onClick={() => downloadFile(new Blob([recordsCsv(visibleRecords)], { type: 'text/csv;charset=utf-8' }), 'documents.csv')}>Export list</button></div></div>
      <div className="table-wrap registry-table"><table>
        <thead><tr><th>Document</th><th>Type</th><th>Owner</th><th>Last updated</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {pageRecords.map((record, index) => <tr key={JSON.stringify([record.type, record.reference, record.url, index])}>
            <td><div className="doc-cell"><span className="file-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M14 3H5v18h14V8Z M14 3v5h5 M8 12h8 M8 16h6" /></svg></span><div><strong title={record.title}>{record.title}</strong><small title={record.reference}>Ref: {record.reference}</small></div></div></td>
            <td><span className="record-type">{documentTypeLabel(record.type)}</span></td><td><span className={!record.owner || record.owner === '?' ? 'record-muted' : 'record-owner'}>{!record.owner || record.owner === '?' ? 'Unassigned' : record.owner}</span></td><td><UpdatedDate value={record.updated} /></td>
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
      <div className="documents-pagination"><span>{visibleRecords.length} records · Page {currentPage} of {pageCount}</span><select aria-label="Records per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }}>{[10, 25, 50].map(size => <option key={size} value={size}>{size} per page</option>)}</select><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><button disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button></div>
      {action && <dialog ref={actionDialog} className="record-action-dialog" aria-labelledby="record-action-title" onCancel={event => { if (actionBusy.current) event.preventDefault(); else setAction(null) }}>
        <form onSubmit={submitAction}>
          <h2 id="record-action-title">{action.kind === 'edit' ? 'Edit document title' : 'Delete document?'}</h2>
          {action.kind === 'edit' ? <label>Document title<input name="documentTitle" autoFocus required maxLength={200} value={editedTitle} disabled={saving} onChange={event => setEditedTitle(event.target.value)} /></label> : <p>Delete “{action.record.title}”? This removes its rows from Google Sheets and moves its PDF to Google Drive Trash.</p>}
          {actionError && <p role="alert">{actionError}</p>}
          <footer><button type="button" className="secondary-action" autoFocus={action.kind === 'delete'} disabled={saving} onClick={() => setAction(null)}>Cancel</button><button type="submit" className="primary-action" disabled={saving || (action.kind === 'edit' && !editedTitle.trim())}>{saving ? 'Saving...' : action.kind === 'edit' ? 'Save changes' : 'Delete document'}</button></footer>
        </form>
      </dialog>}
      {preview && <dialog ref={previewDialog} className="pdf-preview-dialog" aria-labelledby="pdf-preview-title" onCancel={closePreview} onClose={closePreview}>
        <header className="official-preview-header"><div className="official-preview-heading"><h2 id="pdf-preview-title">OFFICIAL PREVIEW</h2><p className="preview-reference">{preview.reference}</p></div>
        <div className="preview-actions official-preview-actions">
          <span className="pdf-preparation-status" role="status">{pdfError ? 'PDF preparation failed' : preparedPreview ? 'PDF ready' : 'Preparing PDF in the background...'}</span>
          <button type="button" className="preview-send" disabled={!preparedPreview || !permissions.changeStatus || !['Approved', 'Out'].includes(preview.status)} title={!permissions.changeStatus ? 'Admin access required' : !['Approved', 'Out'].includes(preview.status) ? 'Approve this document before sending' : 'Send PDF by email'} onClick={() => setEmailRecord(preview)}><PreviewActionIcon kind="send" />Send</button>
          {preparedPreview ? <a className="preview-save" href={preparedPreview.url} download={preparedPreview.file.name}><PreviewActionIcon kind="save" />Save as PDF</a> : <button type="button" className="preview-save" disabled><PreviewActionIcon kind="save" />Save as PDF</button>}
          <button type="button" className="preview-close" aria-label="Close preview" title="Close preview" autoFocus onClick={closePreview}><PreviewActionIcon kind="close" /></button>
        </div>
        </header>
        <div className="preview-frame-wrap">
          {previewLoading && !pdfError && <div className="preview-loading" role="status" aria-live="polite"><span className="preview-spinner" /><span className="preview-loading-text">Loading document preview...</span></div>}
          {pageContent?.form && <DocumentPage form={pageContent.form} type={pageContent.type} reference={preview.reference} />}
          {pageContent && !pageContent.form && preparedPreview && <DocumentPages file={preparedPreview.file} onReady={() => setPreviewLoading(false)} onError={() => { setPreviewLoading(false); setPreviewError('Unable to display the document. You can still save it using Save as PDF.') }} />}
        </div>
        {(previewError || pdfError) && <div className="preview-message" role="alert"><p>{previewError || pdfError}</p><button type="button" className="secondary-action" onClick={() => openPreview({ ...preview })}>Retry preview</button></div>}

      </dialog>}
      {emailRecord && <SendDocument record={emailRecord} onClose={() => setEmailRecord(null)} onSent={record => { setFiles(current => current.map(file => file.id === record.id ? record : file)); setPreview(current => current ? { ...current, status: record.status } : current) }} />}
      {editing && <CreateDocument key={editing.record.reference} isOpen initialForm={editing.form} onClose={() => setEditing(null)} onCreate={async form => { const record = await updateDocumentContent(editing.record.reference, form); setFiles(current => current.map(file => file.id === record.id ? record : file)); return record }} />}
    </section>
  )
}
