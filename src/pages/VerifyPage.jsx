import LoadingModal from '../components/LoadingModal'
import { useEffect, useState } from 'react'
import { verifyDocument } from '../lib/appsScriptApi'
import { documentTypeLabel } from '../lib/documentTypes'
import './Dashboard.css'

export default function VerifyPage({ code }) {
  const [record, setRecord] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    verifyDocument(code).then(value => { if (active) setRecord(value) }).catch(failure => { if (active) setError(failure.message) })
    return () => { active = false }
  }, [code])
  return <main className="dashboard-content verification-page"><p className="eyebrow">Office of the President</p><h1>Document verification</h1><section className="documents-panel">
    {error ? <p role="alert">{error}</p> : !record ? <LoadingModal title="Checking the document registry..." /> : <><h2>Registered document</h2><dl><dt>Reference</dt><dd>{record.id}</dd><dt>Type</dt><dd>{documentTypeLabel(record.type)}</dd><dt>Date</dt><dd>{record.date}</dd><dt>Current status</dt><dd>{record.status}</dd></dl><p>This confirms a registry entry. Compare the reference with your document; a QR code alone does not prove that a PDF has not been altered.</p></>}
    <a href={window.location.pathname}>Return to portal</a>
  </section></main>
}
