import DocumentRecordPage from './documents/DocumentRecordPage'

export default function ArchivePage() {
  return <main className="dashboard-content"><p className="eyebrow">Records retention</p><h1>Archive</h1><p>Completed OUT documents remain available for preview, download, and reference.</p><DocumentRecordPage title="Completed records" initialStatus="Out" /></main>
}
