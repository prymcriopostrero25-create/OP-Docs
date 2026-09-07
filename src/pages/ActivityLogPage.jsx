import { useMemo, useState } from 'react'

const activities = [
  ['Today', '2:42 PM', 'MC', 'red', 'Maria Cruz', 'approved', 'Executive Memorandum No. 042', 'OP-EM-2026-042', 'Approval'],
  ['Today', '1:18 PM', 'RS', 'gold', 'Ramon Santos', 'uploaded a new version of', 'Annual Procurement Plan', 'OP-EM-2026-039', 'Upload'],
  ['Today', '11:06 AM', 'AL', 'blue-bg', 'Ana Lim', 'forwarded for review', 'Office Order No. 113', 'OP-SO-2026-113', 'Review'],
  ['Today', '9:31 AM', 'JD', 'green-bg', 'Juan Dela Cruz', 'archived', 'Travel Authority No. 087', 'OP-TAA-2024-087', 'Archive'],
  ['Yesterday', '4:32 PM', 'MC', 'red', 'Maria Cruz', 'created', 'Travel Order No. 118', 'OP-TO-2026-118', 'Created'],
  ['Yesterday', '2:15 PM', 'RS', 'gold', 'Ramon Santos', 'returned for revision', 'Certification of Travel Abroad', 'OP-CTA-2026-016', 'Review'],
  ['Yesterday', '10:44 AM', 'AL', 'blue-bg', 'Ana Lim', 'restored from archive', 'Special Order No. 071', 'OP-SO-2025-071', 'Archive'],
].map(([date,time,initials,color,user,action,target,id,category]) => ({date,time,initials,color,user,action,target,id,category}))

export default function ActivityLogPage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All activity')
  const filtered = useMemo(() => activities.filter((item) =>
    `${item.user} ${item.action} ${item.target} ${item.id}`.toLowerCase().includes(query.toLowerCase())
    && (category === 'All activity' || item.category === category)
  ), [query, category])
  const groups = filtered.reduce((result, item) => ({ ...result, [item.date]: [...(result[item.date] || []), item] }), {})

  return <main className="dashboard-content activity-log-page">
    <div className="page-title-row"><div><p className="eyebrow">Audit trail</p><h1>Activity log</h1><p>Review every action taken across your document workspace.</p></div><button className="secondary-action archive-export">⇩ Export log</button></div>
    <section className="activity-overview">
      <div><small>Actions today</small><strong>28</strong><span>↑ 12% from yesterday</span></div>
      <div><small>Active users</small><strong>14</strong><span>Across 6 offices</span></div>
      <div><small>Documents touched</small><strong>19</strong><span>8 document types</span></div>
    </section>
    <section className="activity-log-panel">
      <header className="activity-log-header">
        <div><h2>Workspace activity</h2><p>A complete chronological record of document events.</p></div>
        <div className="archive-tools">
          <label className="archive-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search activity..." aria-label="Search activity" /></label>
          <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter activity"><option>All activity</option><option>Approval</option><option>Upload</option><option>Review</option><option>Archive</option><option>Created</option></select>
        </div>
      </header>
      <div className="activity-timeline">
        {Object.entries(groups).map(([date, items]) => <div className="activity-day" key={date}>
          <div className="day-label"><span>{date}</span><i /></div>
          {items.map((item) => <article className="activity-event" key={`${item.id}-${item.time}`}>
            <time>{item.time}</time><span className={`activity-avatar ${item.color}`}>{item.initials}</span>
            <div><p><strong>{item.user}</strong> {item.action} <b>{item.target}</b></p><small>{item.id} · {item.category}</small></div>
            <button aria-label={`More options for ${item.target}`}>•••</button>
          </article>)}
        </div>)}
        {!filtered.length && <div className="activity-empty">No activity matches your filters.</div>}
      </div>
      <button className="load-more">Load earlier activity</button>
    </section>
  </main>
}
