import { canAccessPage, permissionsFor } from '../lib/permissions'
import { DocumentContext, initialRecords } from '../lib/documentContext'
import { useState } from 'react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import CreateDocument from '../components/CreateDocument'
import DocumentsPage from './DocumentsPage'
import ArchivePage from './ArchivePage'
import ActivityLogPage from './ActivityLogPage'
import UserManagementPage from './UserManagementPage'
import UserLogsPage from './UserLogsPage'
import SettingsPage from './SettingsPage'
import './Dashboard.css'

const documents = [
  ['Executive Memorandum No. 042, s. 2026', 'OP-EM-2026-042 · Executive Memorandum', 'Office of the President', 'Jul 28, 2026', 'For signature'],
  ['Travel Order No. 118, s. 2026', 'OP-TO-2026-118 · Travel Order', 'Administrative Office', 'Jul 27, 2026', 'Approved'],
  ['Certification of Travel Abroad', 'OP-CTA-2026-016 · Certification', 'International Affairs', 'Jul 26, 2026', 'In review'],
  ['Travel Authority Abroad No. 021', 'OP-TAA-2026-021 · Travel Authority', 'Office of the President', 'Jul 25, 2026', 'Filed'],
  ['Special Order No. 091, s. 2026', 'OP-SO-2026-091 · Special Order', 'Human Resource Office', 'Jul 24, 2026', 'For signature'],
]

const documentTypes = [
  ['Executive Memorandum', 'EM', '48', 'Official executive directives and institutional memoranda.'],
  ['Travel Orders', 'TO', '126', 'Local official travel assignments and instructions.'],
  ['Certification of Travel Abroad', 'CTA', '18', 'Certifications supporting authorized foreign travel.'],
  ['Travel Authority Abroad', 'TAA', '24', 'Formal authority for official international travel.'],
  ['Special Orders', 'SO', '93', 'Special assignments, designations, and office directives.'],
]

export default function Dashboard({ user, onLogout }) {
  const [selectedPage, setActive] = useState('Overview')
  const active = canAccessPage(user, selectedPage) ? selectedPage : 'Overview'
  const permissions = permissionsFor(user)
  const [records, setRecords] = useState(initialRecords)

  function changeStatus(reference, status) {
    if (!permissions.changeStatus || !['Draft', 'In review', 'For signature', 'Approved', 'Filed'].includes(status)) return
    setRecords((current) => current.map((record) => record.reference === reference ? { ...record, status } : record))
  }

  function createDocument(form) {
    setRecords((current) => [{ ...form, type: form.type.replace(' of Travel Abroad', '').replace(' Abroad', ''), status: permissions.changeStatus ? form.status : 'Draft', updated: new Date().toLocaleDateString() }, ...current])
    setActive('Documents')
  }
  const [menuOpen, setMenuOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const name = user.name || 'Administrator'
  const firstName = name.split(' ')[0]

  return (
    <DocumentContext.Provider value={{ records, changeStatus, permissions }}>
    <div className="dashboard-shell">
      <Sidebar
        active={active}
        isOpen={menuOpen}
        onNavigate={(label) => {
          if (canAccessPage(user, label)) setActive(label)
          setMenuOpen(false)
        }}
        onLogout={onLogout}
        onCreateDocument={() => setCreateOpen(true)}
        user={user}
      />

      <div className="dashboard-main">
        <Navbar isMenuOpen={menuOpen} onToggleMenu={() => setMenuOpen((isOpen) => !isOpen)} />

        {active === 'Documents' ? <DocumentsPage onCreateDocument={() => setCreateOpen(true)} />
          : active === 'Archive' ? <ArchivePage />
          : active === 'Activity log' ? <ActivityLogPage />
          : active === 'User management' ? <UserManagementPage />
          : active === 'User logs' ? <UserLogsPage />
          : active === 'Settings' ? <SettingsPage />
          : <main className="dashboard-content">
          <div className="welcome-row">
            <div><p className="eyebrow">Tuesday, July 28</p><h1>Good afternoon, {firstName}.</h1><p>Here’s what’s happening with your office records today.</p></div>
            <div className="welcome-actions"><button className="secondary-action">⇩ Export report</button><button className="primary-action" onClick={() => setCreateOpen(true)}>＋ Create document</button></div>
          </div>

          <section className="stats-grid" aria-label="Document statistics">
            <article><div className="stat-top"><span className="stat-icon coral">▤</span><span className="trend up">↗ 8.2%</span></div><small>Total documents</small><strong>1,284</strong><p>+94 from last month</p></article>
            <article><div className="stat-top"><span className="stat-icon amber">⌛</span><span className="trend">12 today</span></div><small>Pending review</small><strong>36</strong><p>Requires your attention</p></article>
            <article><div className="stat-top"><span className="stat-icon blue">✓</span><span className="trend up">↗ 5.4%</span></div><small>Approved</small><strong>892</strong><p>69.5% approval rate</p></article>
            <article><div className="stat-top"><span className="stat-icon plum">▣</span><span className="trend">This year</span></div><small>Archived</small><strong>356</strong><p>Securely stored records</p></article>
          </section>

          <section className="document-types">
            <div className="section-heading">
              <div><h2>Official document types</h2><p>Access and manage records by document classification.</p></div>
              <button>Manage classifications →</button>
            </div>
            <div className="type-grid">
              {documentTypes.map(([title, code, count, description]) => (
                <button className="type-card" key={code}>
                  <span className="type-code">{code}</span>
                  <span className="type-copy"><strong>{title}</strong><small>{description}</small></span>
                  <span className="type-count"><b>{count}</b><small>records</small></span>
                  <span className="type-arrow">→</span>
                </button>
              ))}
            </div>
          </section>

          <section className="analytics-grid" aria-label="Document analytics">
            <article className="volume-chart">
              <div className="analytics-heading">
                <div><h2>Document activity</h2><p>Monthly records processed in 2026</p></div>
                <select aria-label="Chart period" defaultValue="6months"><option value="6months">Last 6 months</option><option value="year">This year</option></select>
              </div>
              <div className="chart-summary"><strong>684</strong><span>Total processed</span><b>↗ 12.4%</b></div>
              <div className="bar-chart" aria-label="February 72, March 94, April 81, May 116, June 132, July 189">
                {[['Feb', 38, '72'], ['Mar', 50, '94'], ['Apr', 43, '81'], ['May', 61, '116'], ['Jun', 70, '132'], ['Jul', 100, '189']].map(([month, height, value]) => (
                  <div className="bar-column" key={month}><span>{value}</span><i style={{ height: `${height}%` }} /><small>{month}</small></div>
                ))}
              </div>
            </article>

            <article className="distribution-chart">
              <div className="analytics-heading"><div><h2>Records by type</h2><p>Current document distribution</p></div><button>•••</button></div>
              <div className="donut-wrap">
                <div className="donut"><div><strong>309</strong><small>records</small></div></div>
                <div className="chart-legend">
                  <p><i className="legend-em" /><span>Executive Memorandum</span><b>48</b></p>
                  <p><i className="legend-to" /><span>Travel Orders</span><b>126</b></p>
                  <p><i className="legend-cta" /><span>Certification Abroad</span><b>18</b></p>
                  <p><i className="legend-taa" /><span>Travel Authority Abroad</span><b>24</b></p>
                  <p><i className="legend-so" /><span>Special Orders</span><b>93</b></p>
                </div>
              </div>
            </article>

            <article className="performance-card">
              <div className="analytics-heading"><div><h2>Approval performance</h2><p>Average completion this month</p></div></div>
              <div className="performance-score"><strong>87%</strong><span>On-time completion</span></div>
              <div className="progress"><i /></div>
              <div className="performance-details"><p><span>Average review time</span><b>1.8 days</b></p><p><span>Awaiting signature</span><b>14 records</b></p><p><span>Returned for revision</span><b>6 records</b></p></div>
            </article>
          </section>

          <div className="dashboard-grid">
            <section className="recent-panel">
              <div className="panel-heading"><div><h2>Recent documents</h2><p>Latest records created or updated by your office.</p></div><button>View all documents →</button></div>
              <div className="table-wrap"><table>
                <thead><tr><th>Document</th><th>Owner</th><th>Last updated</th><th>Status</th><th /></tr></thead>
                <tbody>{documents.map(([title, code, owner, date, status]) => <tr key={code}>
                  <td><div className="doc-cell"><span className="file-icon">▤</span><div><strong>{title}</strong><small>{code}</small></div></div></td>
                  <td>{owner}</td><td>{date}</td><td><span className={`status ${status.toLowerCase().replace(' ', '-')}`}>{status}</span></td><td><button className="more">•••</button></td>
                </tr>)}</tbody>
              </table></div>
            </section>
            {permissions.fullAccess && <aside className="activity-panel">
              <div className="panel-heading"><div><h2>Recent activity</h2><p>Updates across your workspace.</p></div><button>•••</button></div>
              <div className="activity-list">
                <div><span className="activity-avatar red">MC</span><p><strong>Maria Cruz</strong> approved <b>Board Resolution No. 18</b><small>12 minutes ago</small></p></div>
                <div><span className="activity-avatar gold">RS</span><p><strong>Ramon Santos</strong> uploaded a new version of <b>Annual Procurement Plan</b><small>48 minutes ago</small></p></div>
                <div><span className="activity-avatar blue-bg">AL</span><p><strong>Ana Lim</strong> forwarded <b>Office Order No. 113</b> for review<small>2 hours ago</small></p></div>
                <div><span className="activity-avatar green-bg">JD</span><p><strong>Juan Dela Cruz</strong> archived <b>Travel Authority No. 87</b><small>Yesterday, 4:32 PM</small></p></div>
              </div>
              <button className="view-activity" onClick={() => setActive('Activity log')}>View complete activity log</button>
            </aside>}
          </div>
        </main>}
      </div>
      {menuOpen && <button className="menu-backdrop" onClick={() => setMenuOpen(false)} aria-label="Close menu" />}
      <CreateDocument isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreate={createDocument} canChangeStatus={permissions.changeStatus} />
    </div>
    </DocumentContext.Provider>
  )
}
