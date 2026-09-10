import { useState } from 'react'

const types = ['Executive Memorandum', 'Special Order', 'Travel Order', 'Authority to Travel Abroad', 'Certificate of Travel']
const sheetNames = { 'Executive Memorandum': 'EX_Memo', 'Travel Order': 'Trav_Ord', 'Special Order': 'Spe_Ord', 'Authority to Travel Abroad': 'Auth_Travel', 'Certificate of Travel': 'Cert_Travel' }
const emptyForm = () => ({ templateVersion: 2, type: types[0], reference: '', recipientLabel: 'For', recipientName: '', recipientPosition: '', institution: '', thru: '', subject: '', date: '', body: '', status: 'Draft', additionalInstitution: '', place: '', inclusiveDate: '', travelFrom: '', travelUntil: '', transportation: '', purpose: '', remarks: '', signatory: 'EDGARDO H. ROSALES, JD, Ed.D.', signatoryPosition: 'SUC President II', requestId: crypto.randomUUID() })

export default function CreateDocument({ isOpen, onClose, onCreate, canChangeStatus = false }) {
  const [form, setForm] = useState(emptyForm)
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
    ['reference', 'Reference number'], ['recipientLabel', travel ? 'Recipient label (To or For)' : 'Recipient label'], ['recipientName', travel ? 'Name of the recipient' : 'Name of recipient'], ['recipientPosition', travel ? 'Position/Office' : 'Position / office'], ...(!travel ? [['institution', memo ? 'Name of institution or office' : 'Name of institution / office']] : []),
    ...(travel ? [['place', 'Place'], ['travelFrom', 'Inclusive dates - From'], ['travelUntil', 'Inclusive dates - Until'], ['transportation', 'Mode of transportation'], ['purpose', 'Purpose'], ['remarks', 'Remarks']]
      : [['thru', 'Thru (Optional)'], ['subject', 'Subject'], ['date', 'Date'], ['body', 'Body'], ['additionalInstitution', 'Additional name of institution (Optional)']]),
  ]

  function updateField(event) {
    const { name, value } = event.target
    if (name === 'type') {
      setForm({ ...emptyForm(), type: value })
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
      if (specialOrder) {
        const response = await fetch(memo ? '/jhcsclogo.png' : '/order-template-logo.png')
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
      const result = await onCreate({ ...form, inclusiveDate, logo, status: canChangeStatus ? form.status : 'Draft' })
      setForm(emptyForm())
      setCreated(result)
    } catch (failure) {
      setError(failure.message || 'Unable to create the document. Please try again.')
    } finally { setBusy(false) }
  }

  function field(name, label) {
    const multiline = ['body', 'institution', 'thru', 'additionalInstitution', 'purpose', 'remarks'].includes(name)
    const optional = ['thru', 'additionalInstitution'].includes(name)
    const Tag = name === 'recipientLabel' ? 'select' : multiline ? 'textarea' : 'input'
    return <div key={name} className={`create-field${multiline ? ' full' : ''}`}>
      <label htmlFor={`document-${name}`}>{label}</label>
      <Tag id={`document-${name}`} name={name} value={form[name]} onChange={updateField} disabled={busy} required={!optional} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `error-${name}` : undefined}
        {...(name === 'recipientLabel' ? {} : { maxLength: name === 'body' ? 50000 : 2000, ...(multiline ? { rows: name === 'body' ? 9 : 2 } : { type: ['date', 'travelFrom', 'travelUntil'].includes(name) ? 'date' : 'text', ...(['travelFrom', 'travelUntil'].includes(name) ? { min: name === 'travelUntil' ? form.travelFrom || '1900-01-01' : '1900-01-01', max: '2099-12-31' } : {}) }) })}>
        {name === 'recipientLabel' ? <><option>To</option><option>For</option></> : undefined}
      </Tag>
      {errors[name] && <span className="create-field-error" id={`error-${name}`}>{errors[name]}</span>}
    </div>
  }
  function close() { if (!busy) { setCreated(null); onClose() } }

  return <div className="create-document-overlay" onMouseDown={event => event.target === event.currentTarget && close()}>
    <section className="create-document-modal" role="dialog" aria-modal="true" aria-labelledby="create-document-title" aria-busy={busy} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close() } }}>
      <header><div><p>Document registry</p><h2 id="create-document-title">Create new document</h2><span>Create and save an official document.</span></div><button type="button" onClick={close} disabled={busy} aria-label="Close">×</button></header>
      {created ? <div className="create-result" role="status"><p>Document Created Successfully</p><a href={created.url} target="_blank" rel="noreferrer">Open {created.type}</a><p>Saved to Google Drive, MAIN Files, and {sheetNames[created.type]}.</p><button type="button" onClick={close}>Done</button></div> : <form onSubmit={handleSubmit} noValidate>
        <div className="create-field full"><label htmlFor="document-type">Document type</label><select id="document-type" name="type" value={form.type} onChange={updateField} disabled={busy}>{types.map(type => <option key={type}>{type}</option>)}</select></div>
        <div className="create-field full"><span className="create-field-caption">ID</span><span>Assigned automatically when saved.</span>{simple && <p>Date created is recorded automatically.</p>}</div>
        {fields.map(([name, label]) => field(name, label))}
        {!simple && !travel && <div className="create-field"><label htmlFor="document-status">Status</label><select id="document-status" name="status" value={canChangeStatus ? form.status : 'Draft'} onChange={updateField} disabled={busy || !canChangeStatus}>{['Draft', 'For Review', 'For Signature', 'Approved', 'Out'].map(status => <option key={status}>{status}</option>)}</select></div>}
        {(memo || specialOrder || travel) && <details className="create-field full"><summary>Signatory</summary>{field('signatory', 'Signatory name')}{field('signatoryPosition', 'Signatory position')}</details>}
        {error && <p className="create-field-error create-field full" role="alert">{error}</p>}
        <div className="create-form-actions"><button type="button" onClick={close} disabled={busy}>Cancel</button><button type="submit" disabled={busy}>{busy ? 'Creating document…' : 'Create document'}</button></div>
      </form>}
    </section>
  </div>
}
