import { DocumentContext } from '../lib/documentContext'
import { useContext, useEffect, useRef, useState } from 'react'
import { uploadPdf, updateDocumentStatus } from '../lib/appsScriptApi'
import { filingTypes } from '../lib/documentClassification'
import { readPdfClassification } from '../lib/readPdfClassification'

export default function DocumentUploads({ onCreateDocument }) {
  const { permissions, files, setFiles, loading, loadError } = useContext(DocumentContext)
  const [savingStatus, setSavingStatus] = useState(false)
  const statusBusy = useRef(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [selection, setSelection] = useState(null)
  const [type, setType] = useState('')
  const [year, setYear] = useState('')
  const [note, setNote] = useState('')
  const [dragging, setDragging] = useState(false)
  const input = useRef(null)
  const operation = useRef(false)
  const activeDialog = useRef(null)
  const opener = useRef(null)
  const [preview, setPreview] = useState(null)
  const previewDialog = useRef(null)

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

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    const trigger = opener.current
    document.body.style.overflow = 'hidden'
    activeDialog.current?.focus()
    return () => { document.body.style.overflow = previousOverflow; trigger?.focus() }
  }, [open])

  async function chooseFile(file) {
    if (!file || operation.current) return
    setError('')
    if (!/\.pdf$/i.test(file.name) || !file.size || file.size > 25 * 1024 * 1024 || file.name.length > 200) {
      setError('Choose a PDF up to 25 MB with a filename under 200 characters.')
      return
    }
    operation.current = true
    setBusy('Reading document type and year...')
    setSelection(null)
    try {
      const result = await readPdfClassification(file)
      setSelection({ file, id: crypto.randomUUID() })
      setType(result.type)
      setYear(result.year)
      setNote(result.note)
    } catch {
      setError('Unable to prepare this file. Please select it again.')
    } finally { operation.current = false; setBusy('') }
  }

  function updateFiling(setValue, value) {
    setValue(value)
    // A changed destination is a new operation; unchanged retries retain their ID.
    setSelection(current => current ? { ...current, id: crypto.randomUUID() } : null)
  }

  async function submit(event) {
    event.preventDefault()
    if (!selection || operation.current || !filingTypes.includes(type) || !/^(19|20)\d{2}$/.test(year)) return
    operation.current = true
    setBusy('Saving PDF and its file link... Keep this page open.')
    setError('')
    setSuccess('')
    try {
      const record = await uploadPdf(selection.file, selection.id, { type, year })
      setFiles(current => [record, ...current.filter(item => item.id !== record.id)])
      setSuccess(`Saved ${record.subject} to ${record.type} / ${record.year}.`)
      setSelection(null)
      setOpen(false)
    } catch (failure) { setError(failure.message + ' Retry with the same selection to avoid duplicate uploads.') }
    finally { operation.current = false; setBusy('') }
  }

  async function changeStatus(id, status) {
    if (statusBusy.current || files.find(file => file.id === id)?.status === 'Out') return
    const previous = files.find(file => file.id === id)
    if (!previous || (previous.status || 'For Review') === status) return
    if (status === 'Out' && !window.confirm('Mark this document Out? This permanently locks editing in the system. Preview and download will remain available.')) return
    statusBusy.current = true
    setSavingStatus(true)
    setError('')
    setSuccess('')
    setFiles(current => current.map(file => file.id === id ? { ...file, status } : file))
    try {
      const record = await updateDocumentStatus(id, status)
      setFiles(current => current.map(file => file.id === id ? record : file))
      setSuccess(`Status saved: ${record.subject} — ${record.status}.`)
    } catch (failure) {
      setFiles(current => current.map(file => file.id === id ? previous : file))
      setError(`Status was not saved. ${failure.message}`)
    }
    finally { statusBusy.current = false; setSavingStatus(false) }
  }

  function dialogKeys(event) {
    if (event.key === 'Escape' && !operation.current) setOpen(false)
    if (event.key !== 'Tab') return
    const controls = [...activeDialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')]
    const first = controls[0], last = controls.at(-1)
    if (!controls.length) { event.preventDefault(); return }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === activeDialog.current)) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  return <>
    <div className="documents-title-row"><div><p className="eyebrow">Document registry</p><h1>Documents</h1><p>View and manage all records created across your office.</p></div>
      <div className="documents-actions"><button ref={opener} className="secondary-action upload-pdf-action" disabled={loading} onClick={() => setOpen(true)}>↑ Upload PDF</button><button className="primary-action" onClick={onCreateDocument}>＋ Create document</button></div>
    </div>
    {success && <p className="uploaded-file" role="status">{success}</p>}
    {savingStatus && <p role="status">Saving status...</p>}
    {(error || loadError) && !open && <p role="alert">{error || loadError}</p>}
    <section className="documents-panel uploaded-files-panel" aria-label="Uploaded files">
      <div className="registry-heading"><h2>Uploaded files</h2><span>{files.length} files</span></div>
      {loading ? <p role="status">Loading saved files...</p> : <div className="table-wrap"><table>
        <thead><tr><th>Subject</th><th>Document type</th><th>Year</th><th>Uploaded</th><th>Status</th><th>File link</th></tr></thead>
        <tbody>{files.map(file => <tr key={file.id}><td>{file.subject}</td><td>{file.type || 'Not classified'}</td><td>{file.year || '—'}</td><td>{file.date}</td><td>{permissions.changeStatus && file.status !== 'Out' ? <select aria-label={`Status for ${file.subject}`} value={file.status || 'For Review'} disabled={savingStatus} onChange={event => changeStatus(file.id, event.target.value)}>{['Draft', 'For Review', 'For Signature', 'Approved', 'Out'].map(status => <option key={status}>{status}</option>)}</select> : <span title={file.status === 'Out' ? 'Locked: preview and download only' : undefined}>{file.status === 'Out' ? 'OUT' : file.status || 'For Review'}</span>}</td><td>{/^https:\/\/drive\.google\.com\/file\/d\/[a-zA-Z0-9_-]+\/(view|preview)$/.test(file.url) ? <><button type="button" className="preview-file-button" onClick={() => setPreview(file)}>Preview file</button>{' ? '}<a href={`https://drive.google.com/uc?export=download&id=${file.url.split('/')[5]}`} target="_blank" rel="noopener noreferrer">Download</a></> : 'No preview link'}</td></tr>)}</tbody>
      </table>{!files.length && <p>No uploaded files yet.</p>}</div>}
    </section>
    {preview && <dialog ref={previewDialog} className="pdf-preview-dialog" aria-labelledby="pdf-preview-title" onCancel={() => setPreview(null)} onClose={() => setPreview(null)}>
      <header><h2 id="pdf-preview-title">{preview.subject}</h2><button type="button" className="secondary-action" autoFocus onClick={() => setPreview(null)}>Close preview</button></header>
      <iframe title={`PDF preview: ${preview.subject}`} src={`https://drive.google.com/file/d/${preview.url.split('/')[5]}/preview`} />
    </dialog>}
    {open && <div className="upload-pdf-overlay" onClick={() => { if (!operation.current) setOpen(false) }}>
      <section ref={activeDialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="upload-title" className="upload-pdf-modal" onKeyDown={dialogKeys} onClick={event => event.stopPropagation()}>
        <header><div><p className="eyebrow">Document upload</p><h2 id="upload-title">Upload and file a PDF</h2><span>File documents by type and document year.</span></div><button type="button" aria-label="Close upload" disabled={!!busy} onClick={() => setOpen(false)}>×</button></header>
        <input ref={input} type="file" hidden accept="application/pdf,.pdf" onChange={event => { void chooseFile(event.target.files?.[0]); event.target.value = '' }} />
        <div className={`pdf-dropzone${dragging ? ' is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); void chooseFile(event.dataTransfer.files?.[0]) }}>
          <strong>{selection?.file.name || 'Drop your PDF here'}</strong><span>PDF files only, up to 25 MB</span><button type="button" className="secondary-action" disabled={!!busy} onClick={() => input.current?.click()}>Browse files</button>
        </div>
        {busy && <p role="status">{busy}</p>}
        {error && <p role="alert">{error}</p>}
        {selection && <form className="filing-form" onSubmit={submit}>
          <p>{note}</p><p><strong>Initial status:</strong> For Review</p>
          <label htmlFor="filing-type">Document type</label><select id="filing-type" value={type} required disabled={!!busy} onChange={event => updateFiling(setType, event.target.value)}><option value="">Select document type</option>{filingTypes.map(value => <option key={value}>{value}</option>)}</select>
          <label htmlFor="filing-year">Document year</label><input id="filing-year" type="number" min="1900" max="2099" step="1" required value={year} disabled={!!busy} placeholder="e.g. 2026" onChange={event => updateFiling(setYear, event.target.value)} />
          <p><strong>Save to:</strong> OP Systems / {type || 'Choose a type'} / {year || 'Choose a year'}</p>
          <button className="primary-action" disabled={!!busy || !type || !/^(19|20)\d{2}$/.test(year)}>Upload to folder</button>
        </form>}
      </section>
    </div>}
  </>
}
