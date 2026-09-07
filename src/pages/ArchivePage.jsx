import { useMemo, useState } from 'react'

const initialRecords = [
  { id: 'OP-EM-2025-184', title: 'Executive Memorandum No. 184, s. 2025', type: 'Executive Memorandum', office: 'Office of the President', archived: 'Jul 24, 2026', by: 'Juan Dela Cruz', retention: 'Dec 2030' },
  { id: 'OP-TO-2025-291', title: 'Travel Order No. 291, s. 2025', type: 'Travel Order', office: 'Administrative Office', archived: 'Jul 21, 2026', by: 'Maria Cruz', retention: 'Dec 2028' },
  { id: 'OP-SO-2024-118', title: 'Special Order No. 118, s. 2024', type: 'Special Order', office: 'Human Resource Office', archived: 'Jul 18, 2026', by: 'Ana Lim', retention: 'Dec 2029' },
  { id: 'OP-CTA-2025-042', title: 'Certification of Travel Abroad', type: 'Certification', office: 'International Affairs', archived: 'Jul 12, 2026', by: 'Ramon Santos', retention: 'Dec 2030' },
  { id: 'OP-TAA-2024-087', title: 'Travel Authority Abroad No. 087', type: 'Travel Authority', office: 'Office of the President', archived: 'Jul 08, 2026', by: 'Juan Dela Cruz', retention: 'Dec 2029' },
  { id: 'OP-EM-2024-156', title: 'Executive Memorandum No. 156, s. 2024', type: 'Executive Memorandum', office: 'Office of the President', archived: 'Jun 29, 2026', by: 'Maria Cruz', retention: 'Dec 2029' },
]

export default function ArchivePage() {
  const [records, setRecords] = useState(initialRecords)
  const [query, setQuery] = useState('')
  const [type, setType] = useState('All types')
  const [notice, setNotice] = useState('')
  const filtered = useMemo(() => records.filter((record) =>
    `${record.title} ${record.id} ${record.office}`.toLowerCase().includes(query.toLowerCase())
    && (type === 'All types' || record.type === type)
  ), [records, query, type])

  function restore(record) {
    setRecords((current) => current.filter((item) => item.id !== record.id))
    setNotice(`${record.id} was restored to Documents.`)
  }

  return <main className="dashboard-content archive-page">
    <div className="page-title-row">
      <div><p className="eyebrow">Records retention</p><h1>Archive</h1><p>Securely stored records that are no longer in active circulation.</p></div>
      <button className="secondary-action archive-export" onClick={() => setNotice('Archive report prepared for export.')}>⇩ Export archive</button>
    </div>
    {notice && <div className="page-notice" role="status"><span>✓</span>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
    <section className="archive-stats" aria-label="Archive summary">
      <article><span className="archive-stat-icon">□</span><div><small>Archived records</small><strong>{350 + records.length}</strong><p>Across all classifications</p></div></article>
      <article><span className="archive-stat-icon amber">⌛</span><div><small>Retention due this year</small><strong>24</strong><p>Review before disposal</p></div></article>
      <article><span className="archive-stat-icon blue">◷</span><div><small>Last archived</small><strong className="stat-date">Jul 24</strong><p>4 days ago</p></div></article>
    </section>
    <section className="archive-panel">
      <div className="archive-panel-heading">
        <div><h2>Archived documents</h2><p>{filtered.length} records shown</p></div>
        <div className="archive-tools">
          <label className="archive-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search archive..." aria-label="Search archive" /></label>
          <select value={type} onChange={(event) => setType(event.target.value)} aria-label="Filter by document type">
            <option>All types</option><option>Executive Memorandum</option><option>Travel Order</option><option>Certification</option><option>Travel Authority</option><option>Special Order</option>
          </select>
        </div>
      </div>
      <div className="table-wrap"><table className="archive-table">
        <thead><tr><th>Document</th><th>Office</th><th>Archived</th><th>Retention until</th><th>Archived by</th><th /></tr></thead>
        <tbody>{filtered.map((record) => <tr key={record.id}>
          <td><div className="doc-cell"><span className="file-icon">▤</span><div><strong>{record.title}</strong><small>{record.id} · {record.type}</small></div></div></td>
          <td>{record.office}</td><td>{record.archived}</td><td><span className="retention-date">{record.retention}</span></td><td>{record.by}</td>
          <td><button className="restore-button" onClick={() => restore(record)}>↶ Restore</button></td>
        </tr>)}{!filtered.length && <tr><td className="archive-empty" colSpan="6">No archived documents match your filters.</td></tr>}</tbody>
      </table></div>
      <footer className="archive-footer"><span>Showing {filtered.length} of {records.length} archived records</span><div><button disabled>‹</button><button className="current">1</button><button>2</button><button>›</button></div></footer>
    </section>
  </main>
}
