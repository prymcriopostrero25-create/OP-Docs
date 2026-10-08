import { lockBodyScroll } from '../lib/scrollLock'
import { DocumentContext } from '../lib/documentContext'
import { useContext, useEffect, useRef, useState } from 'react'
import { uploadPdf } from '../lib/appsScriptApi'
import { uploadSequentially } from '../lib/uploadQueue'
import { documentTypeLabel } from '../lib/documentTypes'
import { filingTypes } from '../lib/documentClassification'
import { readPdfClassification } from '../lib/readPdfClassification'

export default function DocumentUploads({ onCreateDocument }) {
  const { setFiles, loading, loadError } = useContext(DocumentContext)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [selection, setSelection] = useState([])
  const [type, setType] = useState('')
  const [year, setYear] = useState('')
  const [note, setNote] = useState('')
  const [dragging, setDragging] = useState(false)
  const input = useRef(null)
  const operation = useRef(false)
  const activeDialog = useRef(null)
  const opener = useRef(null)
  useEffect(() => {
    if (!open) return
    const unlockScroll = lockBodyScroll()
    const trigger = opener.current

    activeDialog.current?.focus()
    return () => { unlockScroll(); trigger?.focus() }
  }, [open])

  async function chooseFiles(files) {
    const selected = Array.from(files || [])
    if (!selected.length || operation.current) return
    setError('')
    if (selected.some(file => !/\.pdf$/i.test(file.name) || !file.size || file.size > 25 * 1024 * 1024 || file.name.length > 200)) {
      setError('Every file must be a PDF up to 25 MB with a filename under 200 characters.')
      return
    }
    operation.current = true
    setBusy('Reading document type and year...')
    setSelection([])
    setSuccess('')
    try {
      const result = await readPdfClassification(selected[0])
      setSelection(selected.map(file => ({ file, id: crypto.randomUUID(), status: 'queued', progress: 0 })))
      setType(result.type)
      setYear(result.year)
      setNote(selected.length > 1 ? 'Suggested from the first PDF. Confirm one document type and year for all selected files.' : result.note)
    } catch {
      setError('Unable to prepare these files. Please select them again.')
    } finally { operation.current = false; setBusy('') }
  }

  function updateFiling(setValue, value) {
    setValue(value)
    // Only unfinished files get new IDs when their destination changes.
    setSelection(current => current.map(item => item.status === 'complete' ? item : { ...item, id: crypto.randomUUID(), status: 'queued', progress: 0 }))
  }

  function updateItem(id, changes) {
    setSelection(current => current.map(item => item.id === id ? { ...item, ...changes } : item))
  }

  async function submit(event) {
    event.preventDefault()
    if (!selection.length || operation.current || !filingTypes.includes(type) || !/^(19|20)\d{2}$/.test(year)) return
    operation.current = true
    setBusy('Uploading PDFs one at a time. Keep this page open.')
    setError('')
    setSuccess('')
    try {
      await uploadSequentially(selection, async item => {
        updateItem(item.id, { status: 'uploading', progress: 1 })
        // The API reports completion only. Estimated progress stays below 100 until confirmed.
        const timer = setInterval(() => {
          setSelection(current => current.map(entry => entry.id === item.id
            ? { ...entry, progress: Math.min(95, entry.progress + Math.max(1, Math.round((95 - entry.progress) / 10))) }
            : entry))
        }, 500)
        try {
          const record = await uploadPdf(item.file, item.id, { type, year })
          if (!record?.id) throw new Error('The server did not confirm this upload.')
          setFiles(current => [record, ...current.filter(entry => entry.id !== record.id)])
          updateItem(item.id, { status: 'complete', progress: 100 })
        } catch (failure) {
          updateItem(item.id, { status: 'failed' })
          throw new Error(`${item.file.name}: ${failure.message}`, { cause: failure })
        } finally { clearInterval(timer) }
      })
      setSuccess(`Saved all ${selection.length} PDF${selection.length === 1 ? '' : 's'} to ${type} / ${year}.`)
    } catch (failure) { setError(failure.message + ' Retry to resume; completed files will be skipped.') }
    finally { operation.current = false; setBusy('') }
  }

  function closeUpload() {
    if (operation.current) return
    setOpen(false)
    setSelection([])
    setType('')
    setYear('')
    setNote('')
    setDragging(false)
    setBusy('')
    setError('')
    setSuccess('')
    if (input.current) input.current.value = ''
  }

  function dialogKeys(event) {
    if (event.key === 'Escape') closeUpload()
    if (event.key !== 'Tab') return
    const controls = [...activeDialog.current.querySelectorAll('button:not(:disabled), input:not(:disabled):not([hidden]), select:not(:disabled)')]
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
    {(error || loadError) && !open && <p role="alert">{error || loadError}</p>}
    {open && <div className="upload-pdf-overlay" onClick={closeUpload}>
      <section ref={activeDialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="upload-title" className="upload-pdf-modal" onKeyDown={dialogKeys} onClick={event => event.stopPropagation()}>
        <header className="upload-heading">
          <div><p className="eyebrow">Document registry</p><h2 id="upload-title">Upload PDF documents</h2><span>Select PDFs and confirm the shared filing details.</span></div>
          <button type="button" aria-label="Close upload" disabled={!!busy} onClick={closeUpload}><span aria-hidden="true">×</span></button>
        </header>
        <div className="upload-body">
          <div className="upload-section-heading"><h3><span>01</span> Document files</h3><small>PDF · Up to 25 MB each</small></div>
          <input name="documentFile" ref={input} type="file" multiple hidden accept="application/pdf,.pdf" onChange={event => { void chooseFiles(event.target.files); event.target.value = '' }} />
          <div className={`pdf-dropzone${selection.length ? ' has-file' : ''}${dragging ? ' is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); if (!operation.current) setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); void chooseFiles(event.dataTransfer.files) }}>
            <div className="upload-file-icon" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></svg></div>
            <div className="upload-file-copy"><strong>{selection.length ? `${selection.length} PDF${selection.length === 1 ? '' : 's'} selected` : 'Drag and drop your PDFs here'}</strong><span>{selection.length ? `${(selection.reduce((sum, item) => sum + item.file.size, 0) / (1024 * 1024)).toFixed(2)} MB total` : 'Or browse your computer to select files'}</span></div>
            <button type="button" className="secondary-action" disabled={!!busy} onClick={() => input.current?.click()}>{selection.length ? 'Change files' : 'Browse files'}</button>
          </div>
          {busy && <p className="upload-notice" role="status"><span className="upload-spinner" aria-hidden="true" />{busy}</p>}
          {selection.length > 0 && <div className="upload-queue" aria-label="PDF upload queue">
            {selection.map(item => <div key={item.id} className={`upload-queue-item is-${item.status}`}>
              <div className="upload-queue-copy"><strong>{item.file.name}</strong><span>{item.status === 'complete' ? 'Saved · 100%' : item.status === 'failed' ? 'Failed · Retry to resume' : item.status === 'uploading' ? `Uploading · ${item.progress}%` : 'Queued · 0%'}</span></div>
              <div className="upload-progress" role="progressbar" aria-label={`Upload progress for ${item.file.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.progress}><div style={{ width: `${item.progress}%` }} /></div>
            </div>)}
            <p className="upload-progress-note">Progress is estimated while saving. 100% means the server confirmed the file. The next file then starts.</p>
          </div>}
          {error && <p className="upload-notice upload-error" role="alert">{error}</p>}
          <div className="upload-section-heading upload-details-heading"><h3><span>02</span> Filing details</h3><span className="upload-review-badge">For Review</span></div>
          {selection.length > 0 ? <form id="pdf-filing-form" className="filing-form" onSubmit={submit}>
            <p className="upload-detection-note">{note}</p>
            <div className="upload-fields">
              <label htmlFor="filing-type">Type for all files<select id="filing-type" value={type} required disabled={!!busy || selection.some(item => item.status === 'complete')} onChange={event => updateFiling(setType, event.target.value)}><option value="">Select document type</option>{filingTypes.map(value => <option key={value} value={value}>{documentTypeLabel(value)}</option>)}</select></label>
              <label htmlFor="filing-year">Year for all files<input id="filing-year" type="number" min="1900" max="2099" step="1" required value={year} disabled={!!busy || selection.some(item => item.status === 'complete')} placeholder="e.g. 2026" onChange={event => updateFiling(setYear, event.target.value)} /></label>
            </div>
            <div className="upload-destination"><small>Filing destination</small><p><span>OP Systems</span><span aria-hidden="true">/</span><strong>{type || 'Document type'}</strong><span aria-hidden="true">/</span><strong>{year || 'Year'}</strong></p></div>
          </form> : <div className="upload-details-empty">Choose PDFs to review their shared document type and year.</div>}
        </div>
        <footer className="upload-footer"><p>{selection.length ? 'Files upload one at a time.' : 'Select PDFs to get started.'}</p><div><button type="button" className="secondary-action" disabled={!!busy} onClick={closeUpload}>{selection.length && selection.every(item => item.status === 'complete') ? 'Done' : 'Cancel'}</button><button type="submit" form="pdf-filing-form" className="primary-action" disabled={!!busy || !selection.length || selection.every(item => item.status === 'complete') || !type || !/^(19|20)\d{2}$/.test(year)}>{busy ? 'Please wait…' : selection.some(item => item.status === 'failed') ? 'Retry remaining' : 'Upload PDFs'}</button></div></footer>
      </section>
    </div>}
  </>
}
