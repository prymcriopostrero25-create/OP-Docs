import { useContext, useState } from 'react'
import { DocumentContext } from '../lib/documentContext'
import { filingTypes } from '../lib/documentClassification'
import './LiveOverview.css'

const statusColors = ['#ad9ba1', '#d5a34b', '#9771b7', '#4e9575', '#547faf', '#746970']
const knownStatuses = ['Draft', 'For Review', 'For Signature', 'Approved', 'Out']

function OverviewIcon({ kind }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind === 'wine' ? <><path d="M14 3H5v18h14V8Z M14 3v5h5 M8 12h8 M8 16h6" /></> : kind === 'amber' ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> : kind === 'green' ? <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></> : kind === 'refresh' ? <><path d="M20 7v5h-5 M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-1l2 3 M4 15l2 3a7 7 0 0 0 12-1" /></> : <><path d="M5 19 19 5 M7 5h12v12" /></>}</svg>
}

function OverviewLoading() {
  return <div className="overview-summary-loading" role="status"><span className="preview-spinner" aria-hidden="true" /><span>Loading document totals. You can create or browse documents while this loads.</span></div>
}

export default function LiveOverview({ user, onDocuments, onCreate }) {
  const { summary, loading, loadError, refreshRecords } = useContext(DocumentContext)
  const [monthRange, setMonthRange] = useState(6)
  const total = summary?.total || 0
  const statusCounts = summary?.statuses || {}
  const statuses = [...knownStatuses, 'Other'].map((label, index) => ({ label, color: statusColors[index], count: label === 'Other' ? Object.entries(statusCounts).reduce((sum, [status, count]) => sum + (knownStatuses.includes(status) ? 0 : count), 0) : statusCounts[label] || 0 }))
  const types = [...filingTypes, ...Object.keys(summary?.types || {}).filter(type => !filingTypes.includes(type))].map(label => ({ label, count: summary?.types?.[label] || 0 }))
  const typeMax = Math.max(1, ...types.map(type => type.count))
  let offset = 0
  const segments = statuses.map(status => {
    const start = offset
    offset += total ? status.count / total * 100 : 0
    return `${status.color} ${start}% ${offset}%`
  }).join(', ')
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
  const months = Array.from({ length: monthRange }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - monthRange + 1 + index, 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    return { label: date.toLocaleDateString('en', { month: 'short' }), full: date.toLocaleDateString('en', { month: 'long', year: 'numeric' }), count: summary?.months?.[key] || 0 }
  })
  const activityMax = Math.max(1, ...months.map(month => month.count))
  const countStatus = label => statuses.find(status => status.label === label)?.count || 0
  const pending = countStatus('For Review') + countStatus('For Signature')
  return <main className="dashboard-content overview-charts" aria-busy={loading}>
    <div className="overview-topline"><span>WORKSPACE / OVERVIEW</span><time dateTime={today.toLocaleDateString('en-CA')}>{today.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</time></div>
    <div className="welcome-row overview-hero"><div><p className="eyebrow">Office of the President</p><h1>Welcome, {user.name}.</h1><p>Your documents, priorities, and workflow in one place.</p><div className="overview-hero-actions"><button className="overview-create" onClick={onCreate}><span aria-hidden="true">＋</span> Create document</button><button className="overview-browse" onClick={() => onDocuments()}>Browse documents <OverviewIcon kind="blue" /></button></div></div><aside className="overview-hero-aside" aria-label="Pending workflow"><span>WORKFLOW PRIORITIES</span><strong>{loading ? 'Loading priorities…' : loadError ? 'Summary unavailable' : pending ? `${pending.toLocaleString()} awaiting action` : 'No pending reviews'}</strong><p>Review and signature queues</p><div className="overview-priority-row"><span>For review</span><b>{loading || loadError ? '—' : countStatus('For Review').toLocaleString()}</b></div><div className="overview-priority-row"><span>For signature</span><b>{loading || loadError ? '—' : countStatus('For Signature').toLocaleString()}</b></div></aside></div>
    <div className="overview-section-heading"><div><h2>Workspace at a glance</h2><p>Document totals and the current state of your workflow.</p></div><button type="button" className="overview-refresh" onClick={refreshRecords} disabled={loading}><OverviewIcon kind="refresh" />{loading ? 'Refreshing…' : 'Refresh overview'}</button></div>
    {loading && <OverviewLoading />}
    {loadError && <div className="overview-load-error" role="alert"><p>{loadError}</p><button onClick={refreshRecords} disabled={loading}>Try again</button></div>}
    {summary && <>
      {loadError && <p className="overview-stale-note">Showing the last available totals. Refresh to try updating them.</p>}
      <div className="overview-metrics">
        {[{ label: 'Total documents', value: total, note: 'All available records', tone: 'wine' }, { label: 'Awaiting action', value: pending, note: `${countStatus('For Review')} for review · ${countStatus('For Signature')} for signature`, tone: 'amber' }, { label: 'Approved', value: countStatus('Approved'), note: 'Approved document records', tone: 'green' }, { label: 'Released', value: countStatus('Out'), note: 'Documents marked Out', tone: 'blue' }].map(metric => <article className={`overview-metric ${metric.tone}`} key={metric.label}><div><span>{metric.label}</span><i><OverviewIcon kind={metric.tone} /></i></div><strong>{metric.value.toLocaleString()}</strong><p>{metric.note}</p></article>)}
      </div>
      {!total && <p className="overview-empty">Your workspace is ready. Create your first document or browse documents to upload existing records.</p>}
      <div className="overview-chart-grid">
        <section className="overview-chart-card overview-types">
          <header><div><p className="chart-kicker">Document breakdown</p><h2>Documents by type</h2><p>Select a category to browse its documents.</p></div><span className="chart-total">{total.toLocaleString()} records</span></header>
          <div className="overview-horizontal-bars">{types.map((type, index) => <div className="overview-type-bar" key={type.label}><div><span>{filingTypes.includes(type.label) ? <button className="overview-type-link" onClick={() => onDocuments(type.label)}>{type.label}<span aria-hidden="true"> &rarr;</span></button> : type.label}</span><div className="overview-type-values"><strong>{type.count.toLocaleString()}</strong><small>{total ? Math.round(type.count / total * 100) : 0}%</small></div></div><div className="overview-bar-track" aria-hidden="true"><div style={{ width: `${type.count / typeMax * 100}%`, background: index % 2 ? '#b96277' : '#7b1023' }} /></div></div>)}</div>
        </section>
        <section className="overview-chart-card overview-status">
          <header><div><p className="chart-kicker">Workflow snapshot</p><h2>Document status</h2><p>Where your documents stand today.</p></div></header>
          <div className="overview-ring" style={{ background: total ? `conic-gradient(${segments})` : '#eee8e7' }} role="img" aria-label={`${total} documents. ${statuses.map(status => `${status.label}: ${status.count}`).join(', ')}`}><div><strong>{total.toLocaleString()}</strong><span>Total documents</span></div></div>
          <ul className="overview-status-legend">{statuses.filter(status => status.label !== 'Other' || status.count).map(status => <li key={status.label}><i style={{ background: status.color }} /><span>{status.label}</span><strong>{status.count.toLocaleString()}</strong><small>{total ? Math.round(status.count / total * 100) : 0}%</small></li>)}</ul>
        </section>
        <section className="overview-chart-card overview-activity">
          <header><div><p className="chart-kicker">Document activity</p><h2>Records by month</h2><p>Grouped by each record’s available date.</p></div><div className="overview-period-controls"><div className="overview-period-toggle" role="group" aria-label="Chart period">{[6, 12].map(range => <button key={range} type="button" aria-pressed={monthRange === range} onClick={() => setMonthRange(range)}>{range} months</button>)}</div><span className="chart-total">{months.reduce((sum, month) => sum + month.count, 0).toLocaleString()} in period</span></div></header>
          <div className={`overview-columns ${monthRange === 12 ? 'overview-columns-year' : ''}`}>{months.map((month, index) => <div className="overview-column" key={month.full} aria-label={`${month.full}: ${month.count} records`}><div className="overview-column-plot"><div className={`overview-column-fill ${index === monthRange - 1 ? 'current' : ''}`} style={{ height: `${month.count / activityMax * 85}%` }}><strong>{month.count.toLocaleString()}</strong></div></div><span>{month.label}</span></div>)}</div>
          <p className="overview-chart-note">{months[0].full} – {months[monthRange - 1].full} · Record counts, not a history of changes.</p>
        </section>
      </div>
    </>}
  </main>
}
