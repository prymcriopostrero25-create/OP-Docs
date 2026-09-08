import { DocumentContext } from '../../lib/documentContext'
import { useContext, useMemo, useState } from 'react'


const statuses = ['All statuses', 'Draft', 'For Review', 'For Signature', 'Approved', 'Out']

export default function DocumentRecordPage({ title, type }) {
  const { records, changeStatus, permissions, loading, loadError } = useContext(DocumentContext)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function saveStatus(id, value) {
    setSaving(true); setError('')
    try { await changeStatus(id, value) } catch (failure) { setError(failure.message) }
    finally { setSaving(false) }
  }
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All statuses')

  const visibleRecords = useMemo(() => {
    const search = query.trim().toLowerCase()
    return records.filter((record) => {
      const matchesType = !type || record.type === type
      const matchesStatus = status === 'All statuses' || record.status === status
      const matchesSearch = !search || Object.values(record).some((value) => String(value).toLowerCase().includes(search))
      return matchesType && matchesStatus && matchesSearch
    })
  }, [query, status, type, records])

  return (
    <section className="documents-panel">
      {(error || loadError) && <p role="alert">{error || loadError}</p>}
      {loading && <p role="status">Loading documents...</p>}
      <div className="documents-toolbar">
        <div className="document-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by title, reference, or owner..." aria-label={`Search ${title}`} /></div>
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status">{statuses.map((option) => <option key={option}>{option}</option>)}</select>
        <button className="filter-button">≡ Filters</button>
      </div>
      <div className="registry-heading"><div><h2>{title}</h2><p>{visibleRecords.length} shown from {records.filter(record => !type || record.type === type).length} records</p></div><button>⇩ Export list</button></div>
      <div className="table-wrap registry-table"><table>
        <thead><tr><th>Document</th><th>Type</th><th>Owner</th><th>Last updated</th><th>Status</th><th /></tr></thead>
        <tbody>
          {visibleRecords.map((record) => <tr key={record.reference}>
            <td><div className="doc-cell"><span className="file-icon">▤</span><div><strong>{record.title}</strong><small>{record.reference}</small></div></div></td>
            <td>{record.type}</td><td>{record.owner || '?'}</td><td>{record.updated}</td>
            <td>{permissions.changeStatus && record.status !== 'Out' ? <select aria-label={`Change status for ${record.title}`} disabled={saving} value={record.status} onChange={(event) => saveStatus(record.reference, event.target.value)}>{statuses.slice(1).map((option) => <option key={option}>{option}</option>)}</select> : <span className={`status ${record.status.toLowerCase().replaceAll(' ', '-')}`}>{record.status === 'Out' ? 'OUT' : record.status}</span>}</td>
            <td>{/^https:\/\/drive\.google\.com\/file\/d\/[a-zA-Z0-9_-]+\/view$/.test(record.url || '') && <a href={record.url} target="_blank" rel="noopener noreferrer">Preview</a>}</td>
          </tr>)}
          {!visibleRecords.length && <tr><td colSpan="6" className="empty-records">No documents match your search.</td></tr>}
        </tbody>
      </table></div>
      <div className="documents-pagination"><span>{visibleRecords.length} records</span></div>
    </section>
  )
}
