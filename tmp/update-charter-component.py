from pathlib import Path
p=Path('src/components/CitizenCharter.jsx')
s=p.read_text(encoding='utf-8')
s=s[:s.index('const services =')]
s=s.replace("import './CitizenCharter.css'", "import './CitizenCharter.css'\nimport { charterServices } from '../data/citizenCharter'")
s+='''const topics = [
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
  const services = charterServices.filter(service => service.category === category)

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
          <div className="charter-hero-pledge">Your guide to<br />College President’s<br />Office Services</div>
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
        {topic !== null && <div id="charter-topic-panel" className="charter-topic-panel" role="region" aria-label={topics[topic][1]}>
          <h3>{topics[topic][1]}</h3>
          <p>{topic === 0 || topic === 1 ? 'The supplied 2026 edition includes these headings on page 2 but does not provide their content.' : 'The supplied 2026 edition does not specify information for this section.'}</p>
        </div>}
        <div className="charter-overview">
          <h3 className="charter-section-title">Overview</h3>
          <p>The 2026 Citizen’s Charter lists five external services and three internal services of the Office of the College President. Expand a service below to view who may avail, documentary requirements, client steps, agency actions, processing times, fees, and responsible personnel.</p>
          <p className="charter-source-note">Based on the supplied 2026 edition. External service 3 follows its detailed heading on page 9; the list on page 4 uses a different title.</p>
        </div>
        <div id="charter-services" className="charter-services-heading">
          <h3 className="charter-section-title">List of Services</h3>
          <div className="charter-service-tabs" aria-label="Service category">
            <button type="button" className={category === 'external' ? 'is-active' : ''} aria-pressed={category === 'external'} onClick={() => setCategory('external')}>External Services (5)</button>
            <button type="button" className={category === 'internal' ? 'is-active' : ''} aria-pressed={category === 'internal'} onClick={() => setCategory('internal')}>Internal Services (3)</button>
          </div>
        </div>
        <div className="charter-service-list" key={category}>
          {services.map((service, index) => <details className="charter-service-entry" key={service.title}>
            <summary><span className="charter-service-icon"><Icon kind={category === 'internal' ? 'building' : 'document'} /></span><span><strong>{index + 1}. {service.title}</strong><small>{service.classification} · No fees · Pages {service.pages}</small></span><span className="charter-chevron" aria-hidden="true">›</span></summary>
            <ServiceDetails service={service} />
          </details>)}
        </div>
      </div>
    </section>
  )
}
'''
p.write_text(s,encoding='utf-8')
