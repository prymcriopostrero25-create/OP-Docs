import { documentTypes, documentTypeLabel } from '../lib/documentTypes'
import { lazy, Suspense, useState } from 'react'

const RichTextEditor = lazy(() => import('./RichTextEditor'))

const types = documentTypes.map(type => type.value)
const sheetNames = { 'Executive Memorandum': 'EX_Memo', 'Travel Order': 'Trav_Ord', 'Special Order': 'Spe_Ord', 'Authority to Travel Abroad': 'Auth_Travel', 'Certificate of Travel': 'Cert_Travel' }
const emptyForm = () => ({ templateVersion: 2, type: types[0], reference: '', recipientLabel: 'For', recipientName: '', recipientPosition: '', institution: '', thru: '', subject: '', date: '', body: '', status: 'Draft', additionalInstitution: '', place: '', inclusiveDate: '', travelFrom: '', travelUntil: '', transportation: '', purpose: '', remarks: '', signatory: 'EDGARDO H. ROSALES, JD, Ed.D.', signatoryPosition: 'SUC President II', requestId: crypto.randomUUID() })

export default function CreateDocument({ isOpen, onClose, onCreate, canChangeStatus = false, initialForm = null, page = false }) {
  const [form, setForm] = useState(() => {
    const values = initialForm ? { ...emptyForm(), ...initialForm } : emptyForm()
    if (values.type === 'Executive Memorandum') {
      values.institution = [values.institution, values.additionalInstitution].filter(Boolean).join('\n')
      values.additionalInstitution = ''
    }
    return values
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [errors, setErrors] = useState({})
  const [created, setCreated] = useState(null)
  if (!isOpen) return null
  const memo = form.type === 'Executive Memorandum'
  const specialOrder = form.type === 'Special Order'
  const simple = ['Authority to Travel Abroad', 'Certificate of Travel'].includes(form.type)
  const travel = form.type === 'Travel Order'
  const fields = simple ? [['body', 'Body']] : [
    ...(initialForm ? [['reference', 'Reference number']] : []), ['recipientLabel', travel ? 'To / For' : 'Recipient label'], ['recipientName', travel ? 'Name/s of traveler/s' : 'Name of recipient'], ['recipientPosition', travel ? 'Position/Office' : 'Position / office'], ...(!travel ? [['institution', memo ? 'Name of institution or office' : 'Name of institution / office']] : []),
    ...(travel ? [['place', 'Destination'], ['travelFrom', 'Inclusive dates - From'], ['travelUntil', 'Inclusive dates - Until'], ['transportation', 'Mode of transportation'], ['purpose', 'Purpose'], ['remarks', 'Remarks']]
      : [['thru', 'Thru (Optional)'], ['subject', 'Subject'], ['date', 'Date'], ['body', 'Body'], ...(!memo ? [['additionalInstitution', 'Additional name of institution (Optional)']] : [])]),
  ]

  const recipientFields = ['recipientLabel', 'recipientName', 'recipientPosition', 'institution', 'thru', 'additionalInstitution']
  const sections = [
    { title: 'Recipient details', description: 'Who is this document addressed to?', fields: fields.filter(([name]) => recipientFields.includes(name)) },
    { title: travel ? 'Travel details' : 'Document content', description: travel ? 'Add the destination, schedule, and purpose of the trip.' : 'Write the details that will appear in the official document.', fields: fields.filter(([name]) => !recipientFields.includes(name)) },
  ].filter(section => section.fields.length)

  function updateField(event) {
    const { name, value } = event.target
    if (name === 'type') {
      setForm({ ...emptyForm(), type: value, recipientLabel: value === 'Travel Order' ? 'To' : 'For' })
      setErrors({})
      return
    }
    setForm(current => ({ ...current, [name]: value }))
    setErrors(current => ({ ...current, [name]: '' }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (busy) return
    const validation = {}
    fields.forEach(([name, label]) => { if (!['thru', 'additionalInstitution'].includes(name) && !form[name].trim()) validation[name] = `Please enter ${label.toLowerCase()}.` })
    if (!simple && !travel && form.date && (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || isNaN(Date.parse(form.date)) || new Date(form.date).toISOString().slice(0, 10) !== form.date)) validation.date = 'Choose a valid date.'
    if (travel) {
      for (const name of ['travelFrom', 'travelUntil']) {
        const value = form[name]
        if (!/^(19|20)\d{2}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) validation[name] = 'Choose a valid date from 1900 to 2099.'
      }
      if (!validation.travelFrom && !validation.travelUntil && form.travelUntil < form.travelFrom) validation.travelUntil = 'Until must be on or after From.'
    }
    setErrors(validation)
    if (Object.keys(validation).length) return
    setBusy(true)
    setError('')
    try {
      let logo
      if (memo || specialOrder) {
        const response = await fetch('/jhcsclogo.png')
        if (!response.ok) throw new Error('Unable to load the college logo. Please try again.')
        const blob = await response.blob()
        logo = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result).split(',')[1])
          reader.onerror = () => reject(new Error('Unable to read the college logo.'))
          reader.readAsDataURL(blob)
        })
      }
      const dateLabel = value => new Date(value + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
      const inclusiveDate = travel ? (form.travelFrom === form.travelUntil ? dateLabel(form.travelFrom) : `${dateLabel(form.travelFrom)} to ${dateLabel(form.travelUntil)}`) : form.inclusiveDate
      const result = await onCreate({ ...form, autoReference: !initialForm, inclusiveDate, logo, status: canChangeStatus ? form.status : 'Draft' })
      setForm(emptyForm())
      setCreated(result)
    } catch (failure) {
      setError(failure.message || 'Unable to create the document. Please try again.')
    } finally { setBusy(false) }
  }

  function field(name, label) {
    if (memo && name === 'body') return <div key={name} className="create-field full">
      <label htmlFor="document-body">Body</label>
      <Suspense fallback={<p>Loading editor…</p>}><RichTextEditor key={form.requestId} value={form.bodyRich} plainText={form.body} disabled={busy} error={errors.body} onChange={(bodyRich, body) => {
        setForm(current => ({ ...current, bodyRich, body }))
        setErrors(current => ({ ...current, body: '' }))
      }} /></Suspense>
    </div>
    if (memo && name === 'recipientLabel') return <div key={name} className="create-field full">
      <span className="create-field-caption" id="recipient-label-caption">Recipient label</span>
      <div className="create-recipient-options" role="group" aria-labelledby="recipient-label-caption">
        {['For', 'To'].map(value => <button key={value} type="button" aria-pressed={form.recipientLabel === value} disabled={busy} onClick={() => updateField({ target: { name, value } })}>{value}</button>)}
      </div>
    </div>
    if (memo && name === 'institution') {
      const institutions = form.institution.split(/\r?\n/)
      return <div key={name} className="create-field full">
        <label htmlFor="document-institution">{label}</label>
        <div className="create-institution-list">{institutions.map((value, index) => <div className="create-institution-row" key={index}>
          <input id={index === 0 ? 'document-institution' : `document-institution-${index}`} aria-label={`${label} ${index + 1}`} value={value} disabled={busy} maxLength={2000} required={index === 0} aria-invalid={!!errors.institution} aria-describedby={errors.institution ? 'error-institution' : undefined} onChange={event => updateField({ target: { name, value: institutions.map((item, row) => row === index ? event.target.value : item).join('\n') } })} />
          {index > 0 && <button type="button" disabled={busy} aria-label={`Remove institution ${index + 1}`} onClick={() => updateField({ target: { name, value: institutions.filter((_, row) => row !== index).join('\n') } })}>−</button>}
          {index === institutions.length - 1 && <button type="button" disabled={busy} aria-label="Add institution" onClick={() => updateField({ target: { name, value: `${form.institution}\n` } })}>+</button>}
        </div>)}</div>
        {errors.institution && <span className="create-field-error" id="error-institution">{errors.institution}</span>}
      </div>
    }
    if (memo && name === 'thru') return <details key={`${form.requestId}-${name}`} className="create-field full create-thru" open={form.thru ? true : undefined}>
      <summary>Thru <small>Optional</small></summary>
      <label htmlFor="document-thru">Thru recipient</label>
      <textarea id="document-thru" name="thru" value={form.thru} onChange={updateField} disabled={busy} maxLength={2000} rows={2} />
    </details>
    const multiline = ['body', 'institution', 'thru', 'additionalInstitution', 'purpose', 'remarks'].includes(name) || (travel && name === 'recipientName')
    const optional = ['thru', 'additionalInstitution'].includes(name)
    const Tag = name === 'recipientLabel' ? 'select' : multiline ? 'textarea' : 'input'
    return <div key={name} className={`create-field${multiline || name === 'subject' || (memo && name === 'recipientName') || (travel && !['travelFrom', 'travelUntil'].includes(name)) ? ' full' : ''}`}>
      <label htmlFor={`document-${name}`}>{label.replace(/ \(Optional\)/, '')}{optional && <small>Optional</small>}</label>
      <Tag id={`document-${name}`} name={name} value={form[name]} onChange={updateField} disabled={busy || (!!initialForm && name === 'reference')} required={!optional} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `error-${name}` : undefined}
        {...(name === 'recipientLabel' ? {} : { maxLength: name === 'body' ? 50000 : 2000, ...(multiline ? { rows: name === 'body' ? 9 : 2 } : { type: ['date', 'travelFrom', 'travelUntil'].includes(name) ? 'date' : 'text', ...(['travelFrom', 'travelUntil'].includes(name) ? { min: name === 'travelUntil' ? form.travelFrom || '1900-01-01' : '1900-01-01', max: '2099-12-31' } : {}) }) })}>
        {name === 'recipientLabel' ? <><option>To</option><option>For</option></> : undefined}
      </Tag>
      {errors[name] && <span className="create-field-error" id={`error-${name}`}>{errors[name]}</span>}
    </div>
  }
  function close() { if (!busy) { setCreated(null); onClose() } }

  return <div className={page ? 'create-document-page-content' : 'create-document-overlay'} onMouseDown={event => !page && event.target === event.currentTarget && close()}>
    <section className={`create-document-modal${page ? ' create-document-panel' : ''}`} role={page ? undefined : 'dialog'} aria-modal={page ? undefined : true} aria-labelledby="create-document-title" aria-busy={busy} onKeyDown={event => { if (!page && event.key === 'Escape') { event.stopPropagation(); close() } }}>
      <header><div><p>Office of the President ? Document registry</p><h2 id="create-document-title">{initialForm ? 'Edit document' : 'Create new document'}</h2><span>{initialForm ? 'Update the details of your official document.' : 'Choose a document type, fill in the details, and save your draft.'}</span></div><button type="button" onClick={close} disabled={busy} aria-label="Close">×</button></header>
      {created ? <div className="create-result" role="status"><p>Document saved successfully</p><p>Reference number: <strong>{created.id}</strong></p><a href={created.url} target="_blank" rel="noreferrer">Open {created.type}</a><p>Saved to Google Drive, MAIN Files, and {sheetNames[created.type]}.</p><button type="button" onClick={close}>Done</button></div> : <form onSubmit={handleSubmit} noValidate>
        <section className="create-section create-setup" aria-labelledby="create-setup-title">
          <div className="create-section-heading"><span className="create-section-icon" aria-hidden="true">01</span><div><h3 id="create-setup-title">Document setup</h3><p>Start with the type of document you need.</p></div></div>
          <div className="create-section-fields">
            <div className="create-field"><label htmlFor="document-type">Document type</label><select id="document-type" name="type" value={form.type} onChange={updateField} disabled={busy || !!initialForm}>{types.map(type => <option key={type} value={type}>{documentTypeLabel(type)}</option>)}</select></div>
            {!initialForm && <div className="create-field"><label htmlFor="document-status">Status</label><select id="document-status" name="status" value={canChangeStatus ? form.status : 'Draft'} onChange={updateField} disabled={busy || !canChangeStatus}>{['Draft', 'For Review', 'For Signature', 'Approved', 'Out'].map(status => <option key={status}>{status}</option>)}</select></div>}
          </div>
          <div className="create-reference-note"><span aria-hidden="true">#</span><p><strong>{travel ? 'Travel Order No.' : 'Reference number'}</strong>{initialForm ? form.reference : 'Assigned automatically when you save.'}{(simple || travel) && <small>{travel ? 'The series year follows the recorded creation date.' : 'The creation date is recorded automatically.'}</small>}</p></div>
        </section>
        {sections.map((section, index) => <section className="create-section" key={section.title} aria-labelledby={`create-section-${index}`}>
          <div className="create-section-heading"><span className="create-section-icon" aria-hidden="true">{String(index + 2).padStart(2, '0')}</span><div><h3 id={`create-section-${index}`}>{section.title}</h3><p>{section.description}</p></div></div>
          <div className="create-section-fields">{section.fields.map(([name, label]) => field(name, label))}</div>
        </section>)}
        {(memo || specialOrder || form.type === 'Travel Order') && <details className="create-signatory"><summary><span>Signing authority<small>{form.signatory || 'Set the document signatory'}</small></span></summary><div className="create-section-fields">{field('signatory', 'Signatory name')}{field('signatoryPosition', 'Signatory position')}</div></details>}
        {error && <p className="create-field-error create-field full" role="alert">{error}</p>}
        <div className="create-form-actions"><p>{initialForm ? 'Review your changes before saving.' : 'Your reference number will be assigned on save.'}</p><button type="button" onClick={close} disabled={busy}>Cancel</button><button type="submit" disabled={busy}>{busy ? 'Saving document…' : initialForm ? 'Save changes' : 'Create document'}</button></div>
      </form>}
    </section>
  </div>
}
