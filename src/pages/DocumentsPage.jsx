import { DocumentContext } from '../lib/documentContext'
import { useContext, useState } from 'react'
import DocumentUploads from '../components/DocumentUploads'
import AllDocument from './documents/AllDocument'
import ExecutiveMemo from './documents/ExecutiveMemo'
import TravelOrder from './documents/TravelOrder'
import Certification from './documents/Certification'
import TravelAuthority from './documents/TravelAuthority'
import SpecialOrder from './documents/SpecialOrder'
import { documentTypes as categories } from '../lib/documentTypes'

const pages = { EM: ExecutiveMemo, TO: TravelOrder, CTA: Certification, TAA: TravelAuthority, SO: SpecialOrder }
const documentTypes = [{ label: 'All documents', short: 'ALL', Page: AllDocument }, ...categories.map(type => ({ ...type, Page: pages[type.short] }))]

export default function DocumentsPage({ onCreateDocument, initialType }) {
  const { records } = useContext(DocumentContext)
  const typeCounts = (label) => records.filter(record => label === 'All documents' || record.type === categories.find(type => type.label === label)?.value).length
  const [selectedType, setSelectedType] = useState(() => categories.find(type => type.value === initialType)?.label || 'All documents')
  const ActivePage = documentTypes.find((type) => type.label === selectedType).Page
  return <main className="dashboard-content documents-page">
    <DocumentUploads onCreateDocument={onCreateDocument} />
    <section className="document-summary" aria-label="Document summary"><div><span>All records</span><strong>{records.length}</strong></div><div><span>For Review</span><strong>{records.filter(r => r.status === 'For Review').length}</strong></div><div><span>For Signature</span><strong>{records.filter(r => r.status === 'For Signature').length}</strong></div><div><span>Approved</span><strong>{records.filter(r => r.status === 'Approved').length}</strong></div><div><span>Out</span><strong>{records.filter(r => r.status === 'Out').length}</strong></div></section>
    <nav className="document-type-pages" aria-label="Document type pages">{documentTypes.map((type) => <button key={type.label} className={selectedType === type.label ? 'active' : ''} onClick={() => setSelectedType(type.label)}><span>{type.short}</span><div><strong>{type.label}</strong><small>{typeCounts(type.label)} records</small></div></button>)}</nav><ActivePage />
  </main>
}
