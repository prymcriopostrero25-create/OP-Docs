import LoadingModal from './LoadingModal'
import { useEffect, useRef, useState } from 'react'
import { prepareEmailAttachment, sendDocument } from '../lib/appsScriptApi'

function MailIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>
}

export default function SendDocument({ record, onClose, onSent }) {
  const dialog = useRef(null)
  const sending = useRef(false)
  const [form, setForm] = useState({ to: '', cc: '', subject: record.title, message: 'Good day,\n\nPlease see the attached official document.\n\nThank you.', requestId: crypto.randomUUID() })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [attachment, setAttachment] = useState(null)
  const [attachmentError, setAttachmentError] = useState('')
  const [prepareAttempt, setPrepareAttempt] = useState(0)
  useEffect(() => { dialog.current.showModal() }, [])
  useEffect(() => {
    let active = true
    prepareEmailAttachment(record.reference).then(result => {
      if (active) setAttachment(result)
    }).catch(failure => { if (active) setAttachmentError(failure.message) })
    return () => { active = false }
  }, [record.reference, prepareAttempt])
  async function submit(event) {
    event.preventDefault()
    if (sending.current || sent || !attachment) return
    sending.current = true
    setBusy(true); setError('')
    try { const result = await sendDocument({ ...form, attachmentRevision: attachment.revision, id: record.reference }); setSent(true); onSent(result) }
    catch (failure) { setError(failure.message) }
    finally { sending.current = false; setBusy(false) }
  }
  if (sent) return <dialog ref={dialog} open className="record-action-dialog email-dialog" onCancel={onClose} aria-labelledby="email-sent-title"><div className="email-success"><span className="email-success-icon" aria-hidden="true">✓</span><h2 id="email-sent-title">PDF sent successfully</h2><p>The official PDF was emailed to <strong>{form.to}</strong>{form.cc && <> with a copy to <strong>{form.cc}</strong></>}.</p><p className="email-status-note">The document is now <strong>OUT</strong> and editing is locked.</p><button type="button" className="primary-action" autoFocus onClick={onClose}>Done</button></div></dialog>
  return <dialog ref={dialog} className="record-action-dialog email-dialog" onCancel={event => { if (busy) event.preventDefault(); else onClose() }} aria-labelledby="send-title"><form onSubmit={submit}>
    {busy && <LoadingModal title="Sending PDF..." description="Sending the prepared PDF and confirming delivery. Please wait." />}
    <header className="email-header"><span className="email-icon"><MailIcon /></span><div><h2 id="send-title">Send PDF by email</h2><p>Share an official document with your recipients.</p></div><button type="button" className="email-close" aria-label="Close email" disabled={busy} onClick={onClose}>×</button></header>
    <div className="email-content">
      <div className="email-attachment"><span className="email-file-icon" aria-hidden="true">PDF</span><div><span className="email-eyebrow">ATTACHMENT</span><strong>{attachment?.name || record.title || record.reference}</strong><span>{record.reference} · Official PDF</span></div><span className="email-attached" role="status">{attachment ? 'Ready' : attachmentError ? 'Unavailable' : 'Preparing...'}</span></div>
      {attachmentError && <p className="email-error" role="alert">{attachmentError} <button type="button" onClick={() => { setAttachmentError(''); setPrepareAttempt(value => value + 1) }}>Retry attachment</button></p>}
      <div className="email-fields">
        {['to', 'cc', 'subject'].map(name => <div className="email-field" key={name}><label htmlFor={`email-${name}`}>{({ to: 'To', cc: 'Cc', subject: 'Subject' })[name]}{name === 'cc' ? <span className="email-optional">Optional</span> : <span className="email-required"> *</span>}</label><input id={`email-${name}`} autoFocus={name === 'to'} type={name === 'subject' ? 'text' : 'email'} multiple={name !== 'subject'} required={name !== 'cc'} aria-describedby={name !== 'subject' ? 'email-recipient-help' : undefined} placeholder={name === 'to' ? 'recipient@jhcsc.edu.ph' : name === 'cc' ? 'Add copy recipients' : ''} maxLength={name === 'subject' ? 200 : 2000} value={form[name]} disabled={busy} onChange={event => setForm({ ...form, [name]: event.target.value })} />{name === 'cc' && <p id="email-recipient-help" className="email-field-help">Separate multiple email addresses with commas.</p>}</div>)}
      </div>
      <label className="email-message" htmlFor="email-message">Message<textarea id="email-message" rows="6" required maxLength={10000} value={form.message} disabled={busy} onChange={event => setForm({ ...form, message: event.target.value })} /></label>
      <p className="email-status-note">Sending changes the document status to <strong>OUT</strong> and locks editing.</p>
      {error && <p className="email-error" role="alert">{error}</p>}
    </div>
    <footer className="email-footer"><span>{attachment ? 'PDF ready to send' : 'Preparing PDF attachment'}</span><div><button type="button" className="email-cancel" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="primary-action email-submit" disabled={busy || !attachment}><MailIcon />{busy ? 'Sending...' : 'Send PDF'}</button></div></footer>
  </form></dialog>
}

