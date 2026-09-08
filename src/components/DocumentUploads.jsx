import { DocumentContext } from '../lib/documentContext'
import { useContext, useEffect, useRef, useState } from 'react'
import { uploadPdf } from '../lib/appsScriptApi'
import { filingTypes } from '../lib/documentClassification'
import { readPdfClassification } from '../lib/readPdfClassification'

export default function DocumentUploads({ onCreateDocument }) {
  const { setFiles, loading, loadError } = useContext(DocumentContext)
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

  function dialogKeys(event) {
    if (event.key === 'Escape' && !operation.current) setOpen(false)
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
    {open && <div className="upload-pdf-overlay" onClick={() => { if (!operation.current) setOpen(false) }}>
      <section ref={activeDialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="upload-title" className="upload-pdf-modal" onKeyDown={dialogKeys} onClick={event => event.stopPropagation()}>
        <header className="upload-heading">
          <div><p className="eyebrow">Document registry</p><h2 id="upload-title">Upload a document</h2><span>Add your PDF, then confirm its filing details.</span></div>
          <button type="button" aria-label="Close upload" disabled={!!busy} onClick={() => setOpen(false)}><span aria-hidden="true">×</span></button>
        </header>
        <div className="upload-body">
          <div className="upload-section-heading"><h3><span>01</span> Document file</h3><small>PDF · Up to 25 MB</small></div>
          <input ref={input} type="file" hidden accept="application/pdf,.pdf" onChange={event => { void chooseFile(event.target.files?.[0]); event.target.value = '' }} />
          <div className={`pdf-dropzone${selection ? ' has-file' : ''}${dragging ? ' is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); if (!operation.current) setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); void chooseFile(event.dataTransfer.files?.[0]) }}>
            <div className="upload-file-icon" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></svg></div>
            <div className="upload-file-copy"><strong>{selection?.file.name || 'Drag and drop your PDF here'}</strong><span>{selection ? `${(selection.file.size / (1024 * 1024)).toFixed(2)} MB · PDF document` : 'Or browse your computer to select a file'}</span></div>
            <button type="button" className="secondary-action" disabled={!!busy} onClick={() => input.current?.click()}>{selection ? 'Change file' : 'Browse files'}</button>
          </div>
          {busy && <p className="upload-notice" role="status"><span className="upload-spinner" aria-hidden="true" />{busy}</p>}
          {error && <p className="upload-notice upload-error" role="alert">{error}</p>}
          <div className="upload-section-heading upload-details-heading"><h3><span>02</span> Filing details</h3><span className="upload-review-badge">For Review</span></div>
          {selection ? <form id="pdf-filing-form" className="filing-form" onSubmit={submit}>
            <p className="upload-detection-note">{note}</p>
            <div className="upload-fields">
              <label htmlFor="filing-type">Document type<select id="filing-type" value={type} required disabled={!!busy} onChange={event => updateFiling(setType, event.target.value)}><option value="">Select document type</option>{filingTypes.map(value => <option key={value}>{value}</option>)}</select></label>
              <label htmlFor="filing-year">Document year<input id="filing-year" type="number" min="1900" max="2099" step="1" required value={year} disabled={!!busy} placeholder="e.g. 2026" onChange={event => updateFiling(setYear, event.target.value)} /></label>
            </div>
            <div className="upload-destination"><small>Filing destination</small><p><span>OP Systems</span><span aria-hidden="true">/</span><strong>{type || 'Document type'}</strong><span aria-hidden="true">/</span><strong>{year || 'Year'}</strong></p></div>
          </form> : <div className="upload-details-empty">Choose a PDF to review its document type and year.</div>}
        </div>
        <footer className="upload-footer"><p>{selection ? 'Confirm the details before uploading.' : 'Select a PDF to get started.'}</p><div><button type="button" className="secondary-action" disabled={!!busy} onClick={() => setOpen(false)}>Cancel</button><button type="submit" form="pdf-filing-form" className="primary-action" disabled={!!busy || !selection || !type || !/^(19|20)\d{2}$/.test(year)}>{busy ? 'Please wait…' : 'Upload document'}</button></div></footer>
      </section>
    </div>}
  </>
}
