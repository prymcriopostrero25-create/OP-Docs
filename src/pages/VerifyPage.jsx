import LoadingModal from '../components/LoadingModal'
import { useEffect, useRef, useState } from 'react'
import DocumentPages from '../components/DocumentPages'
import { verifyDocument } from '../lib/appsScriptApi'
import { documentTypeLabel } from '../lib/documentTypes'
import VerificationLayout from './VerificationLayout'

export default function VerifyPage({ code, onReset, uploadedPdf }) {
  const [record, setRecord] = useState(null)
  const [error, setError] = useState('')
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const previewDialog = useRef(null)
  useEffect(() => {
    if (previewOpen) previewDialog.current?.showModal()
    else previewDialog.current?.close()
  }, [previewOpen])
  useEffect(() => {
    if (!uploadedPdf) return
    const url = URL.createObjectURL(uploadedPdf)
    let active = true
    Promise.resolve().then(() => { if (active) setUploadedPreviewUrl(url) })
    return () => { active = false; URL.revokeObjectURL(url) }
  }, [uploadedPdf])
  const registeredPreviewUrl = /^https:\/\/drive\.google\.com\/file\/d\/[a-zA-Z0-9_-]+\/preview$/.test(record?.previewUrl || '') ? record.previewUrl : ''
  const previewUrl = uploadedPreviewUrl || registeredPreviewUrl
  useEffect(() => {
    let active = true
    verifyDocument(code).then(value => { if (active) setRecord(value) }).catch(failure => { if (active) setError(failure.message) })
    return () => { active = false }
  }, [code])
  return <VerificationLayout><section className="verify-card verify-result">
    {error ? <><p className="verify-eyebrow">Registry check</p><h2>Unable to verify document</h2><p className="verify-error" role="alert">{error}</p></> : !record ? <LoadingModal title="Checking the document registry..." /> : <><div className="verify-card-heading"><div><p className="verify-eyebrow">Registry Match Found</p><h2>Registered Document</h2></div><span className="verify-public-badge">Record Located</span></div><dl className="verify-details"><div><dt>Reference Number</dt><dd>{record.id}</dd></div><div><dt>Document Type</dt><dd>{documentTypeLabel(record.type)}</dd></div><div><dt>Document Date</dt><dd>{record.date}</dd></div><div><dt>Current Status</dt><dd><span className="verify-status">{record.status}</span></dd></div></dl><p className="verify-notice">This confirms a registry entry. Compare the reference with your document; a QR code alone does not prove that a PDF has not been altered.</p></>}
    <div className="verify-result-actions">
      {record && <button className="verify-button verify-button-primary" type="button" disabled={!previewUrl} onClick={() => { setPreviewError(''); setPreviewOpen(true) }}>Preview</button>}
      {onReset && <button className="verify-button" type="button" onClick={onReset}>Verify Another Document</button>}
    </div>
    {record && !previewUrl && <p className="verify-notice" role="status">Preview is unavailable. Upload the PDF to preview it, or ask the administrator to update the Apps Script deployment.</p>}
  </section>
    {previewOpen && <dialog ref={previewDialog} className="pdf-preview-dialog verify-preview-dialog" aria-labelledby="verify-preview-title" onCancel={() => setPreviewOpen(false)} onClose={() => setPreviewOpen(false)}>
      <header className="official-preview-header">
        <div className="official-preview-heading"><h2 id="verify-preview-title">DOCUMENT PREVIEW</h2><p className="preview-reference">{record.id}</p></div>
        <div className="preview-actions official-preview-actions">
          {uploadedPreviewUrl && <a className="preview-save" href={uploadedPreviewUrl} download={uploadedPdf.name}>Save as PDF</a>}
          <button className="preview-close" type="button" aria-label="Close preview" autoFocus onClick={() => setPreviewOpen(false)}>×</button>
        </div>
      </header>
      <div className="preview-frame-wrap">
        {uploadedPdf ? <DocumentPages file={uploadedPdf} onError={failure => setPreviewError(failure.message || 'Unable to load the PDF preview.')} /> : <iframe className="verify-drive-preview" title="Registered Document Preview" src={registeredPreviewUrl} />}
      </div>
      {previewError && <p className="verify-error" role="alert">{previewError}</p>}
    </dialog>}
  </VerificationLayout>
}
