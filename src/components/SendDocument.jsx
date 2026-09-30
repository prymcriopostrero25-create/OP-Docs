import { useEffect, useRef, useState } from 'react'
import { sendDocument } from '../lib/appsScriptApi'

export default function SendDocument({ record, onClose, onSent }) {
  const dialog = useRef(null)
  const [form, setForm] = useState({ to: '', cc: '', subject: record.title, message: 'Good day,\n\nPlease see the attached official document.\n\nThank you.', requestId: crypto.randomUUID() })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { dialog.current.showModal() }, [])
  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try { const result = await sendDocument({ ...form, id: record.reference }); onSent(result); onClose() }
    catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  return <dialog ref={dialog} className="record-action-dialog email-dialog" onCancel={event => { if (busy) event.preventDefault(); else onClose() }} aria-labelledby="send-title"><form onSubmit={submit}>
    <h2 id="send-title">Send PDF by email</h2><p>The registered PDF will be attached. Sending marks this document OUT and locks editing.</p>
    {['to', 'cc', 'subject', 'message'].map(name => <label key={name}>{({ to: 'To (separate addresses with commas)', cc: 'CC (optional)', subject: 'Subject', message: 'Message' })[name]}{name === 'message' ? <textarea rows="6" required maxLength={10000} value={form[name]} disabled={busy} onChange={event => setForm({ ...form, [name]: event.target.value })} /> : <input required={name !== 'cc'} maxLength={name === 'subject' ? 200 : 2000} value={form[name]} disabled={busy} onChange={event => setForm({ ...form, [name]: event.target.value })} />}</label>)}
    {error && <p role="alert">{error}</p>}<footer><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="primary-action" disabled={busy}>{busy ? 'Sending…' : 'Send PDF'}</button></footer>
  </form></dialog>
}
