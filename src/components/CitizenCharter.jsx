import { useState } from 'react'
import './CitizenCharter.css'

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

const services = [
  ['mail', 'Receiving and Routing of Official Communications', 'Submission and forwarding of letters and official documents.'],
  ['calendar', 'Request for Appointment with the College President', 'Scheduling an official meeting or appointment.'],
  ['document', 'Request for Copies of Official Memoranda, Office Orders, and Other Issuances', 'Request for copies of official issuances by the Office of the President.'],
  ['people', 'Coordination of Official Meetings and Institutional Activities', 'Coordination of activities with external stakeholders.'],
]

export default function CitizenCharter() {
  const [category, setCategory] = useState('external')
  const [topic, setTopic] = useState(null)
  const topics = [
    ['document', 'Mandate, Vision and Mission'],
    ['pledge', 'Service Pledge'],
    ['people', 'External Services', '(4 services)'],
    ['building', 'Internal Services', '(3 services)'],
    ['chat', 'Feedback and Complaints'],
    ['phone', 'Contact Information'],
  ]

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
            <p className="charter-eyebrow">Public service information</p>
            <h2 id="citizen-charter-title">Citizen’s Charter</h2>
            <h3>Office of the President</h3>
            <p>Your guide to the Office of the President's services, requirements,<br className="charter-desktop-break" /> procedures, and service standards.</p>
          </div>
          <div className="charter-hero-pledge">Committed to<br />Efficient and Responsive<br />Public Service</div>
        </div>
      </div>

      <div className="charter-content">
        <nav className="charter-topics" aria-label="Citizen’s Charter topics">
          {topics.map(([icon, label, count], index) => (
            <button key={label} type="button" className={topic === index ? 'is-active' : ''} onClick={() => selectTopic(index)} aria-expanded={index === 2 || index === 3 ? undefined : topic === index}>
              <Icon kind={icon} /><span>{label}{count && <small>{count}</small>}</span>
            </button>
          ))}
        </nav>

        {topic !== null && <div className="charter-topic-panel" role="region" aria-label={topics[topic][1]}>
          <h3>{topics[topic][1]}</h3>
          <p>{topic === 1 ? 'Committed to efficient and responsive public service.' : 'Official information for this section has not yet been published on this portal.'}</p>
        </div>}

        <div className="charter-overview-row">
          <div className="charter-overview">
            <h3 className="charter-section-title">Overview</h3>
            <p>The Office of the President of J.H. Cerilles State College is committed to providing efficient, transparent, accountable, and responsive public service in accordance with Republic Act No. 11032, otherwise known as the Ease of Doing Business and Efficient Government Service Delivery Act of 2018.</p>
          </div>
          <div className="charter-policy"><span className="charter-policy-icon"><Icon kind="target" /></span><div><h4>No Fixer Policy</h4><p>Transact directly with authorized personnel only.</p></div></div>
          <div className="charter-policy"><span className="charter-policy-icon"><Icon kind="shield" /></span><div><h4>No Gift Policy</h4><p>Our personnel shall not solicit or accept gifts or favors.</p></div></div>
        </div>

        <div id="charter-services" className="charter-services-heading">
          <h3 className="charter-section-title">List of Services</h3>
          <div className="charter-service-tabs" aria-label="Service category">
            <button type="button" className={category === 'external' ? 'is-active' : ''} aria-pressed={category === 'external'} onClick={() => setCategory('external')}>External Services</button>
            <button type="button" className={category === 'internal' ? 'is-active' : ''} aria-pressed={category === 'internal'} onClick={() => setCategory('internal')}>Internal Services</button>
          </div>
        </div>
        {category === 'external' ? <div className="charter-services">
          {services.map(([icon, title, description], index) => <div className="charter-service" key={title}>
            <span className="charter-service-icon"><Icon kind={icon} /></span>
            <div><h4>{index + 1}. {title}</h4><p>{description}</p></div>
            <span className="charter-chevron" aria-hidden="true">›</span>
          </div>)}
        </div> : <p className="charter-empty">Details for the three internal services have not yet been published on this portal.</p>}
        <details className="charter-details">
          <summary><span className="charter-details-symbol" aria-hidden="true">★</span><span>View detailed information for each service, including documentary requirements,<br className="charter-desktop-break" /> procedures, processing time, fees, and responsible personnel.</span><span className="charter-details-button">View Service Details <span aria-hidden="true">→</span></span></summary>
          <p>Documentary requirements, procedures, processing times, fees, and responsible personnel have not yet been published on this portal.</p>
        </details>
      </div>
    </section>
  )
}
