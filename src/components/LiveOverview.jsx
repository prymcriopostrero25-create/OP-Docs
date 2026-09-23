import { useContext } from 'react'
import { DocumentContext } from '../lib/documentContext'
import { filingTypes } from '../lib/documentClassification'
import './LiveOverview.css'

const statusColors = ['#ad9ba1', '#d5a34b', '#9771b7', '#4e9575', '#547faf', '#746970']
const knownStatuses = ['Draft', 'For Review', 'For Signature', 'Approved', 'Out']

function OverviewLoading() {
  return <>
    <p className="overview-loading-message" role="status">Loading your dashboard…</p>
    <div className="overview-chart-grid overview-loading" aria-hidden="true">
      <section className="overview-chart-card overview-types">
        <header><div><p className="chart-kicker">Document breakdown</p><h2>Documents by type</h2><p>Compare the number of records in each category.</p></div></header>
        <div className="overview-horizontal-bars">{filingTypes.map(type => <div className="overview-type-bar" key={type}><div><span>{type}</span><span className="overview-skeleton overview-skeleton-count" /></div><div className="overview-skeleton overview-skeleton-track" /></div>)}</div>
      </section>
      <section className="overview-chart-card overview-status">
        <header><div><p className="chart-kicker">Workflow snapshot</p><h2>Document status</h2><p>Where your documents stand today.</p></div></header>
        <div className="overview-ring overview-skeleton"><div><span className="overview-skeleton overview-skeleton-number" /><span>Total documents</span></div></div>
        <ul className="overview-status-legend">{knownStatuses.map(status => <li key={status}><i className="overview-skeleton" /><span>{status}</span><span className="overview-skeleton overview-skeleton-count" /></li>)}</ul>
      </section>
      <section className="overview-chart-card overview-activity">
        <header><div><p className="chart-kicker">Six-month view</p><h2>Records by month</h2><p>Grouped by each record’s available date.</p></div></header>
        <div className="overview-skeleton overview-skeleton-chart" />
      </section>
    </div>
  </>
}

export default function LiveOverview({ user, onDocuments, onCreate }) {
  const { records, loading, loadError } = useContext(DocumentContext)
  const total = records.length
  const statuses = [...knownStatuses, 'Other'].map((label, index) => ({ label, color: statusColors[index], count: records.filter(record => label === 'Other' ? !knownStatuses.includes(record.status) : record.status === label).length }))
  const types = [...filingTypes, ...new Set(records.map(record => record.type || 'Unclassified').filter(type => !filingTypes.includes(type)))].map(label => ({ label, count: records.filter(record => (record.type || 'Unclassified') === label).length }))
  const typeMax = Math.max(1, ...types.map(type => type.count))
  let offset = 0
  const segments = statuses.map(status => {
    const start = offset
    offset += total ? status.count / total * 100 : 0
    return `${status.color} ${start}% ${offset}%`
  }).join(', ')
  const today = new Date()
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - 5 + index, 1)
    return { label: date.toLocaleDateString('en', { month: 'short' }), full: date.toLocaleDateString('en', { month: 'long', year: 'numeric' }), count: records.filter(record => {
      const updated = new Date(record.updated)
      return updated.getFullYear() === date.getFullYear() && updated.getMonth() === date.getMonth()
    }).length }
  })
  const activityMax = Math.max(1, ...months.map(month => month.count))
  const countStatus = label => statuses.find(status => status.label === label)?.count || 0
  const pending = countStatus('For Review') + countStatus('For Signature')
  return <main className="dashboard-content overview-charts">
    <div className="overview-topline"><span>WORKSPACE / OVERVIEW</span><time dateTime={today.toLocaleDateString('en-CA')}>{today.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</time></div>
    <div className="welcome-row overview-hero"><div><p className="eyebrow">Office of the President</p><h1>Welcome, {user.name}.</h1><p>Your documents, priorities, and workflow in one place.</p><div className="overview-hero-actions"><button className="overview-create" onClick={onCreate}><span aria-hidden="true">＋</span> Create document</button><button className="overview-browse" onClick={onDocuments}>Browse documents <span aria-hidden="true">↗</span></button></div></div><div className="overview-hero-aside"><span>DOCUMENT MANAGEMENT</span><strong>Clarity at every step.</strong><p>From initial review to final release.</p></div></div>
    {loading && <OverviewLoading />}{loadError && <p role="alert">{loadError}</p>}
    {!loading && !loadError && <>
      <div className="overview-metrics">
        {[{ label: 'Total documents', value: total, note: 'All available records', icon: '▤', tone: 'wine' }, { label: 'Awaiting action', value: pending, note: `${countStatus('For Review')} for review · ${countStatus('For Signature')} for signature`, icon: '◷', tone: 'amber' }, { label: 'Approved', value: countStatus('Approved'), note: 'Approved document records', icon: '✓', tone: 'green' }, { label: 'Released', value: countStatus('Out'), note: 'Documents marked Out', icon: '↗', tone: 'blue' }].map(metric => <article className={`overview-metric ${metric.tone}`} key={metric.label}><div><span>{metric.label}</span><i aria-hidden="true">{metric.icon}</i></div><strong>{metric.value.toLocaleString()}</strong><p>{metric.note}</p></article>)}
      </div>
      {!total && <p className="overview-empty">No documents yet. Your charts will update as records are added.</p>}
      <div className="overview-chart-grid">
        <section className="overview-chart-card overview-types">
          <header><div><p className="chart-kicker">Document breakdown</p><h2>Documents by type</h2><p>Compare the number of records in each category.</p></div><span className="chart-total">{total} records</span></header>
          <div className="overview-horizontal-bars">{types.map((type, index) => <div className="overview-type-bar" key={type.label}><div><span>{type.label}</span><strong>{type.count}</strong></div><div className="overview-bar-track" aria-hidden="true"><div style={{ width: `${type.count / typeMax * 100}%`, background: index % 2 ? '#b96277' : '#7b1023' }} /></div></div>)}</div>
        </section>
        <section className="overview-chart-card overview-status">
          <header><div><p className="chart-kicker">Workflow snapshot</p><h2>Document status</h2><p>Where your documents stand today.</p></div></header>
          <div className="overview-ring" style={{ background: total ? `conic-gradient(${segments})` : '#eee8e7' }} role="img" aria-label={`${total} documents. ${statuses.map(status => `${status.label}: ${status.count}`).join(', ')}`}><div><strong>{total}</strong><span>Total documents</span></div></div>
          <ul className="overview-status-legend">{statuses.filter(status => status.label !== 'Other' || status.count).map(status => <li key={status.label}><i style={{ background: status.color }} /><span>{status.label}</span><strong>{status.count}</strong><small>{total ? Math.round(status.count / total * 100) : 0}%</small></li>)}</ul>
        </section>
        <section className="overview-chart-card overview-activity">
          <header><div><p className="chart-kicker">Six-month view</p><h2>Records by month</h2><p>Grouped by each record’s available date.</p></div><span className="chart-total">{months.reduce((sum, month) => sum + month.count, 0)} in period</span></header>
          <div className="overview-columns">{months.map((month, index) => <div className="overview-column" key={month.full} aria-label={`${month.full}: ${month.count} records`}><div className="overview-column-plot"><div className={`overview-column-fill ${index === 5 ? 'current' : ''}`} style={{ height: `${month.count / activityMax * 85}%` }}><strong>{month.count}</strong></div></div><span>{month.label}</span></div>)}</div>
          <p className="overview-chart-note">{months[0].full} – {months[5].full} · Record counts, not a history of changes.</p>
        </section>
      </div>
    </>}
  </main>
}
