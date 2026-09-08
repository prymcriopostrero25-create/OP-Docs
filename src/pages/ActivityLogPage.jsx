import { useContext } from 'react'
import { DocumentContext } from '../lib/documentContext'

export default function ActivityLogPage() {
  const { files, loading, loadError } = useContext(DocumentContext)
  return <main className="dashboard-content"><p className="eyebrow">Document history</p><h1>Activity log</h1><p>Recorded document uploads.</p>
    {loading && <p role="status">Loading...</p>}{loadError && <p role="alert">{loadError}</p>}
    <section className="documents-panel"><table><thead><tr><th>Timestamp</th><th>Activity</th><th>Document</th></tr></thead><tbody>{files.map(file => <tr key={file.id}><td>{file.date}</td><td>{file.activity}</td><td>{file.subject}</td></tr>)}</tbody></table>{!loading && !files.length && <p>No document activity recorded.</p>}</section>
  </main>
}
