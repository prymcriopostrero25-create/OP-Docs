import { useState } from 'react'
import './CitizenCharter.css'
import { charterServices } from '../data/citizenCharter'

function Icon({ kind }) {
  const paths = {
    document: <><path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7" /></>,
    people: <><circle cx="12" cy="7" r="3" /><path d="M6 21v-4a6 6 0 0 1 12 0v4M4 10a3 3 0 0 0-2 3v6M20 10a3 3 0 0 1 2 3v6" /></>,
    building: <><path d="M4 21V6h6V3h6v7h4v11M2 21h20M7 9v1m0 3v1m0 3v1m6-12v1m0 3v1m0 3v1m4 0v1m0 3v1" /></>,
    chat: <><path d="M21 11a9 8 0 0 1-9 8H7l-5 3 2-6a8 8 0 0 1-1-5 9 8 0 0 1 18 0Z" /><path d="M8 11h.1m4 0h.1m4 0h.1" /></>,
    phone: <path d="m5 3 4 4-2 3a16 16 0 0 0 7 7l3-2 4 4-2 3C10 22 2 14 2 5z" />,
    pledge: <><path d="m2 10 5-5 5 2 5-2 5 5-5 8-4 3-9-7M7 5l-3 9m13-9 3 9M9 9l4-2 4 5-3 2-4-3-3 3M10 16l4 4" /></>,
    target: <><circle cx="11" cy="13" r="9" /><circle cx="11" cy="13" r="5" /><path d="m11 13 9-10m-4 1v5h5" /></>,
    shield: <><path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6zM8 12l3 3 5-6" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="1" /><path d="m3 6 9 7 9-7" /></>,
    calendar: <><rect x="3" y="5" width="18" height="17" rx="2" /><path d="M7 2v6m10-6v6M3 11h18M7 15h2m4 0h2m-8 4h2m4 0h2" /></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind] || paths.document}</svg>
}

const topics = [
  ['document', 'Mandate, Vision and Mission'],
  ['pledge', 'Service Pledge'],
  ['people', 'External Services', '(5 services)'],
  ['building', 'Internal Services', '(3 services)'],
  ['chat', 'Feedback and Complaints'],
  ['phone', 'Contact Information'],
]

function ServiceDetails({ service }) {
  return <div className="charter-service-body">
    <p>{service.description}</p>
    <dl className="charter-service-meta">
      <div><dt>Office or unit</dt><dd>Office of the College President</dd></div>
      <div><dt>Classification</dt><dd>{service.classification}</dd></div>
      <div><dt>Type of transaction</dt><dd>{service.category === 'internal' ? 'G2G - Government to Government' : 'G2C - Government to Citizen; G2B - Government to Business Entity/ies; G2G - Government to Government'}</dd></div>
      <div><dt>Who may avail</dt><dd>{service.eligible}</dd></div>
      <div><dt>Fees to be paid</dt><dd>None (all steps)</dd></div>
    </dl>
    <h5>Checklist of requirements</h5>
    <ol>{service.requirements.map(requirement => <li key={requirement}>{requirement}</li>)}</ol>
    <p><strong>Where to secure:</strong> {service.requirementSource}</p>
    <h5>Procedures and service standards</h5>
    <div className="charter-table-scroll" tabIndex={0} role="region" aria-label={`${service.title} procedures`}>
      <table className="charter-procedure-table">
        <thead><tr><th scope="col">Client steps</th><th scope="col">Agency action</th><th scope="col">Fees</th><th scope="col">Processing time</th><th scope="col">Person responsible</th></tr></thead>
        <tbody>{service.steps.map((step, index) => <tr key={index}><td>{step.client || '—'}</td><td>{step.action}</td><td>None</td><td>{step.time}</td><td>{step.person}</td></tr>)}</tbody>
      </table>
    </div>
    <p className="charter-source-note">Source: Citizen’s Charter 2026 Edition, pages {service.pages}. Processing times are shown per agency action as published.</p>
  </div>
}

export default function CitizenCharter() {
  const [category, setCategory] = useState('external')
  const [topic, setTopic] = useState(null)
  const [copyStatus, setCopyStatus] = useState('')
  const services = charterServices.filter(service => service.category === category)

  async function copyMobileNumber() {
    try {
      await navigator.clipboard.writeText('+639152484538')
      setCopyStatus('Copied!')
    } catch {
      setCopyStatus('Unable to copy. Please copy the number manually.')
    }
  }

  function selectTopic(index) {
    if (index === 2 || index === 3) {
      setCategory(index === 2 ? 'external' : 'internal')
      setTopic(null)
      document.getElementById('charter-services')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    } else setTopic(topic === index ? null : index)
  }

  return (
    <section id="citizen-charter" className="citizen-charter" aria-labelledby="citizen-charter-title" tabIndex={-1}>
      <div className="charter-hero">
        <div className="charter-hero-inner">
          <div className="charter-hero-copy">
            <p className="charter-eyebrow">Citizen’s Charter · 2026 Edition</p>
            <h2 id="citizen-charter-title">Citizen’s Charter</h2>
            <h3>Office of the College President</h3>
            <p>JH. Cerilles State College<br />Services, requirements, procedures, and processing times.</p>
          </div>
          <div className="charter-hero-pledge">Your guide to<br />College President's<br />Office Services</div>
        </div>
      </div>
      <div className="charter-content">
        <nav className="charter-topics" aria-label="Citizen’s Charter topics">
          {topics.map(([icon, label, count], index) => (
            <button key={label} type="button" className={(index === 2 && category === 'external') || (index === 3 && category === 'internal') || topic === index ? 'is-active' : ''} onClick={() => selectTopic(index)} aria-expanded={index === 2 || index === 3 ? undefined : topic === index} aria-controls={index === 2 || index === 3 ? 'charter-services' : topic === index ? 'charter-topic-panel' : undefined}>
              <Icon kind={icon} /><span>{label}{count && <small>{count}</small>}</span>
            </button>
          ))}
        </nav>
        {topic !== null && <div id="charter-topic-panel" className={`charter-topic-panel${topic === 4 || topic === 5 ? ' charter-connect-panel' : ''}`} role="region" aria-label={topics[topic][1]}>
          <div className="charter-topic-heading">
            {(topic === 4 || topic === 5) && <span className="charter-connect-icon"><Icon kind={topic === 4 ? 'chat' : 'phone'} /></span>}
            <div><h3>{topics[topic][1]}</h3>
              {(topic === 4 || topic === 5) && <p>{topic === 4 ? 'Your voice helps us improve our services.' : 'Get in touch with JH Cerilles State College.'}</p>}
            </div>
          </div>
          {topic === 4 ? (
            <div className="charter-feedback-content">
              <div><span className="charter-contact-label">Your feedback is welcome.</span><p>Please submit any comments, suggestions, or concerns to our feedback email address.</p></div>
              <a className="charter-contact-card charter-feedback-link" href="https://mail.google.com/mail/?view=cm&fs=1&to=feedback%40jhcsc.edu.ph" target="_blank" rel="noopener noreferrer">
                <span className="charter-contact-icon"><Icon kind="mail" /></span>
                <span className="charter-contact-copy"><span className="charter-contact-label">Send us a message</span><strong>feedback@jhcsc.edu.ph</strong></span>
                <span className="charter-contact-arrow" aria-hidden="true">↗</span>
              </a>
            </div>
          ) : topic === 5 ? (
            <div className="charter-contact-grid">
              <a className="charter-contact-card" href="https://mail.google.com/mail/?view=cm&fs=1&to=main%40jhcsc.edu.ph" target="_blank" rel="noopener noreferrer">
                <span className="charter-contact-icon"><Icon kind="mail" /></span>
                <span className="charter-contact-copy"><span className="charter-contact-label">Email</span><strong>main@jhcsc.edu.ph</strong><span className="charter-contact-hint">Send an email</span></span>
                <span className="charter-contact-arrow" aria-hidden="true">↗</span>
              </a>
              <button className="charter-contact-card charter-copy-number" type="button" onClick={copyMobileNumber}>
                <span className="charter-contact-icon"><Icon kind="phone" /></span>
                <span className="charter-contact-copy"><span className="charter-contact-label">Mobile Number</span><strong>+639152484538</strong><span className="charter-contact-hint" role="status">{copyStatus || 'Click to copy number'}</span></span>
                <span className="charter-contact-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg></span>
              </button>
            </div>
          ) : (
            <p>This section is currently being crafted and validated. The finalized content will be published once the review is complete.</p>
          )}
        </div>}
        <div className="charter-overview">
          <h3 className="charter-section-title">Overview</h3>
          <p>The 2026 Citizen’s Charter lists five external services and three internal services of the Office of the College President. Expand a service below to view who may avail, documentary requirements, client steps, agency actions, processing times, fees, and responsible personnel.</p>
        </div>
        <div id="charter-services" className="charter-services-heading">
          <div className="charter-directory-title"><h3 className="charter-section-title">List of Services</h3><p>Browse the services provided by the Office of the President.</p></div>
          <div className="charter-service-tabs" aria-label="Service category">
            <button type="button" className={category === 'external' ? 'is-active' : ''} aria-pressed={category === 'external'} onClick={() => setCategory('external')}><Icon kind="building" />External Services (5)</button>
            <button type="button" className={category === 'internal' ? 'is-active' : ''} aria-pressed={category === 'internal'} onClick={() => setCategory('internal')}><Icon kind="people" />Internal Services (3)</button>
          </div>
        </div>
        <div className="charter-service-list" key={category}>
          {services.map((service, index) => <details className="charter-service-entry" key={service.title}>
            <summary>
              <span className="charter-directory-icon" aria-hidden="true"><Icon kind={(category === 'external' ? ['document', 'calendar', 'people', 'mail', 'building'] : ['document', 'mail', 'calendar'])[index]} /></span>
              <span className="charter-service-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span className="charter-service-copy"><strong>{service.title}</strong><span className="charter-service-badges"><span className={service.classification === 'Complex' ? 'charter-complex' : 'charter-simple'}>{service.classification}</span><span className="charter-no-fee"><svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 8 3 3 7-7" /></svg>No fees</span></span></span>
              <span className="charter-service-action"><span className="charter-action-closed">View details</span><span className="charter-action-expanded">Hide details</span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-5-5 5 5-5 5" /></svg></span>
            </summary>
            <ServiceDetails service={service} />
          </details>)}
        </div>
      </div>
    </section>
  )
}
