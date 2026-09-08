import { useState } from 'react'

const types = ['Executive Memorandum', 'Travel Order', 'Certification of Travel Abroad', 'Travel Authority Abroad', 'Special Order']
const emptyForm = { title: '', type: types[0], reference: '', owner: 'Office of the President', status: 'Draft', content: '' }

export default function CreateDocument({ isOpen, onClose, onCreate, canChangeStatus = false }) {
  const [form, setForm] = useState(emptyForm)
  if (!isOpen) return null

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    onCreate?.({ ...form, status: canChangeStatus ? form.status : 'Draft' })
    setForm(emptyForm)
    onClose()
  }

  return (
    <div className="create-document-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="create-document-modal" role="dialog" aria-modal="true" aria-labelledby="create-document-title">
        <header><div><p>Document registry</p><h2 id="create-document-title">Create new document</h2><span>Add a record to your office document registry.</span></div><button type="button" onClick={onClose} aria-label="Close">×</button></header>
        <form onSubmit={handleSubmit}>
          <div className="create-field full"><label htmlFor="document-title">Document title</label><input id="document-title" name="title" value={form.title} onChange={updateField} placeholder="Enter the official document title" required autoFocus /></div>
          <div className="create-field"><label htmlFor="document-type">Document type</label><select id="document-type" name="type" value={form.type} onChange={updateField}>{types.map((type) => <option key={type}>{type}</option>)}</select></div>
          <div className="create-field"><label htmlFor="document-reference">Reference number</label><input id="document-reference" name="reference" value={form.reference} onChange={updateField} placeholder="e.g. OP-EM-2026-043" required /></div>
          <div className="create-field"><label htmlFor="document-owner">Originating office</label><select id="document-owner" name="owner" value={form.owner} onChange={updateField}><option>Office of the President</option><option>Administrative Office</option><option>Human Resource Office</option><option>Finance Office</option><option>International Affairs</option></select></div>
          {canChangeStatus && <div className="create-field"><label htmlFor="document-status">Initial status</label><select id="document-status" name="status" value={form.status} onChange={updateField}><option>Draft</option><option>For Review</option><option>For Signature</option><option>Approved</option><option>Out</option></select></div>}
          <div className="create-field full"><label htmlFor="document-content">Content</label><textarea id="document-content" name="content" value={form.content} onChange={updateField} placeholder="Enter the document content..." rows="7" required /></div>
          <div className="create-form-actions"><button type="button" onClick={onClose}>Cancel</button><button type="submit">Create document</button></div>
        </form>
      </section>
    </div>
  )
}
