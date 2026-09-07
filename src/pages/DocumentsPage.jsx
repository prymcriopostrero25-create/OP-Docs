import { useState } from 'react'
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
  const ActivePage = documentTypes.find((type) => type.label === selectedType).Page

  return (
    <main className="dashboard-content documents-page">
      <div className="documents-title-row">
        <div><p className="eyebrow">Document registry</p><h1>Documents</h1><p>View and manage all records created across your office.</p></div>
        <button className="primary-action" onClick={onCreateDocument}>＋ Create document</button>
      </div>
      <section className="document-summary" aria-label="Document summary">
        <div><span>All records</span><strong>128</strong></div><div><span>In review</span><strong>18</strong></div>
        <div><span>For signature</span><strong>14</strong></div><div><span>Approved</span><strong>89</strong></div>
      </section>
      <nav className="document-type-pages" aria-label="Document type pages">
        {documentTypes.map((type) => <button key={type.label} className={selectedType === type.label ? 'active' : ''} onClick={() => setSelectedType(type.label)} aria-current={selectedType === type.label ? 'page' : undefined}>
          <span>{type.short}</span><div><strong>{type.label}</strong><small>{type.count} records</small></div>
        </button>)}
      </nav>
      <ActivePage />
    </main>
  )
}
