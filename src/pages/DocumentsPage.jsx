import { useRef, useState } from 'react'
import AllDocument from './documents/AllDocument'
import ExecutiveMemo from './documents/ExecutiveMemo'
import TravelOrder from './documents/TravelOrder'
import Certification from './documents/Certification'
import TravelAuthority from './documents/TravelAuthority'
import SpecialOrder from './documents/SpecialOrder'

const documentTypes = [
  { label: 'All documents', short: 'ALL', count: 128, Page: AllDocument },
  { label: 'Executive Memorandum', short: 'EM', count: 48, Page: ExecutiveMemo },
  { label: 'Travel Order', short: 'TO', count: 26, Page: TravelOrder },
  { label: 'Certification', short: 'CTA', count: 18, Page: Certification },
  { label: 'Travel Authority', short: 'TAA', count: 24, Page: TravelAuthority },
  { label: 'Special Order', short: 'SO', count: 12, Page: SpecialOrder },
]

export default function DocumentsPage({ onCreateDocument }) {
  const [selectedType, setSelectedType] = useState('All documents')
  const [uploadedFile, setUploadedFile] = useState(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)
  const ActivePage = documentTypes.find((type) => type.label === selectedType).Page
  const acceptFile = (file) => { if (file?.type === 'application/pdf' || file?.name.toLowerCase().endsWith('.pdf')) { setUploadedFile(file); setUploadOpen(false) } }
  const dropFile = (event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files?.[0]) }

  return <main className="dashboard-content documents-page">
    <div className="documents-title-row"><div><p className="eyebrow">Document registry</p><h1>Documents</h1><p>View and manage all records created across your office.</p></div><div className="documents-actions">
      <input ref={inputRef} className="visually-hidden" type="file" accept="application/pdf,.pdf" onChange={(event) => { acceptFile(event.target.files?.[0]); event.target.value = '' }} />
      <button className="secondary-action upload-pdf-action" type="button" onClick={() => setUploadOpen(true)}>↑ Upload PDF</button><button className="primary-action" onClick={onCreateDocument}>＋ Create document</button>
    </div></div>
    {uploadedFile && <p className="uploaded-file" role="status">Selected PDF: <strong>{uploadedFile.name}</strong></p>}
    {uploadOpen && <div className="upload-pdf-overlay" role="dialog" aria-modal="true" onClick={() => setUploadOpen(false)}><section className="upload-pdf-modal" onClick={(event) => event.stopPropagation()}><header><div><p className="eyebrow">Document upload</p><h2>Upload a PDF</h2><span>Drag and drop your file here, or browse your computer.</span></div><button type="button" onClick={() => setUploadOpen(false)}>×</button></header><div className={`pdf-dropzone${dragging ? ' is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={dropFile}><strong>Drop your PDF here</strong><span>PDF files only, up to 25 MB</span><button type="button" className="secondary-action" onClick={() => inputRef.current?.click()}>Browse files</button></div></section></div>}
    <section className="document-summary" aria-label="Document summary"><div><span>All records</span><strong>128</strong></div><div><span>In review</span><strong>18</strong></div><div><span>For signature</span><strong>14</strong></div><div><span>Approved</span><strong>89</strong></div></section>
    <nav className="document-type-pages" aria-label="Document type pages">{documentTypes.map((type) => <button key={type.label} className={selectedType === type.label ? 'active' : ''} onClick={() => setSelectedType(type.label)}><span>{type.short}</span><div><strong>{type.label}</strong><small>{type.count} records</small></div></button>)}</nav><ActivePage />
  </main>
}
