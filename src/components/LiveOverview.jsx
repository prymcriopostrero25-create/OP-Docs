import { useContext } from 'react'
import { DocumentContext } from '../lib/documentContext'
import { filingTypes } from '../lib/documentClassification'

export default function LiveOverview({ user, onDocuments }) {
  const { records, loading, loadError } = useContext(DocumentContext)
  return <main className="dashboard-content">
    <div className="welcome-row"><div><p className="eyebrow">{new Date().toLocaleDateString()}</p><h1>Welcome, {user.name}.</h1><p>Your document records.</p></div><button className="primary-action" onClick={onDocuments}>View documents</button></div>
    {loading && <p role="status">Loading documents...</p>}{loadError && <p role="alert">{loadError}</p>}
    <section className="stats-grid">{['All records', 'For Review', 'Approved', 'Out'].map(status => <article key={status}><small>{status === 'Out' ? 'OUT' : status}</small><strong>{loading ? '—' : records.filter(record => status === 'All records' || record.status === status).length}</strong></article>)}</section>
    <section className="document-types"><div className="section-heading"><h2>Documents by type</h2></div><div className="type-grid">{filingTypes.map(type => <button className="type-card" key={type} onClick={onDocuments}><span className="type-copy"><strong>{type}</strong></span><span className="type-count"><b>{records.filter(record => record.type === type).length}</b><small>records</small></span></button>)}</div></section>
    <section className="recent-panel"><div className="panel-heading"><h2>Recent documents</h2></div><div className="table-wrap"><table><thead><tr><th>Document</th><th>Type</th><th>Uploaded</th><th>Status</th></tr></thead><tbody>{records.slice(0, 10).map(record => <tr key={record.reference}><td>{record.title}</td><td>{record.type || 'Not classified'}</td><td>{record.updated}</td><td>{record.status === 'Out' ? 'OUT' : record.status}</td></tr>)}</tbody></table>{!loading && !records.length && <p>No documents yet.</p>}</div></section>
  </main>
}
