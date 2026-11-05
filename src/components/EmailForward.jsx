import { useEffect, useRef, useState } from 'react'
import { fetchEmailThread, forwardEmail } from '../lib/appsScriptApi'

export default function EmailForward({ email, onClose, onForwarded }) {
  const dialog = useRef(null)
  const requestId = useRef(null)
  const [messages, setMessages] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [selected, setSelected] = useState('')
  const [composing, setComposing] = useState(false)
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  useEffect(() => { dialog.current.showModal() }, [])
  useEffect(() => {
    let active = true
    fetchEmailThread(email.link).then(result => { if (active) setMessages(result.messages) }).catch(reason => { if (active) setError(reason.message) })
    return () => { active = false }
  }, [email.link, attempt])
  async function send(event) {
    event.preventDefault()
    const recipients = [...new Set(to.split(/[;,\s]+/).filter(Boolean))]
    if (!recipients.length || recipients.length > 30 || recipients.some(value => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) { setError('Enter valid email addresses, up to 30 recipients.'); return }
    setSending(true); setError('')
    if (!requestId.current) requestId.current = crypto.randomUUID()
    try {
      await forwardEmail({ link: email.link, messageId: selected, to: recipients.join(', '), subject, message: body, requestId: requestId.current })
      setSent(true)
      onForwarded?.()
    } catch (reason) { setError(reason.message) }
    finally { setSending(false) }
  }
  return <dialog ref={dialog} className="email-forward" aria-labelledby="email-forward-title" onCancel={event => { if (sending) event.preventDefault(); else onClose() }} onClose={onClose}>
    <header><h2 id="email-forward-title">{sent ? 'Email forwarded' : composing ? 'Compose forward' : 'Select an email to forward'}</h2><button type="button" className="secondary-action" disabled={sending} onClick={onClose} aria-label="Close forward">Close</button></header>
    {sent ? <p role="status">Your email was forwarded successfully.</p> : !composing ? <>
      <p>{email.subject || '(No subject)'}</p>
      {!messages && !error && <p role="status">Loading messages...</p>}
      {error && <div role="alert">{error} <button type="button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Try again</button></div>}
      {messages?.length === 0 && <p>No messages are available to forward.</p>}
      <div className="email-forward-messages">{messages?.map(message => <label key={message.id}><input type="radio" name="forward-message" value={message.id} checked={selected === message.id} onChange={() => setSelected(message.id)} /><span><strong>{message.subject || '(No subject)'}</strong><span>{message.from}</span><small>{new Date(message.date).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</small><span className="email-forward-excerpt">{message.text?.slice(0, 180)}</span></span></label>)}</div>
      <footer><button type="button" className="email-send-action" disabled={!selected} onClick={() => { const message = messages.find(item => item.id === selected); setSubject(message.subject || ''); setError(''); setComposing(true) }}>Continue</button></footer>
    </> : <form onSubmit={send}>
      <fieldset disabled={sending}>
        <label>To<input autoFocus required value={to} onChange={event => setTo(event.target.value)} placeholder="name@example.com, another@example.com" aria-describedby="forward-recipient-help" /></label>
        <small id="forward-recipient-help">Separate multiple addresses with commas, semicolons, or spaces. Maximum 30 recipients.</small>
        <label>Subject<input readOnly value={subject} placeholder="(No subject)" /></label><small>The original subject is preserved to keep this forward in the conversation.</small>
        <label>Body<textarea required rows={8} maxLength={20000} value={body} onChange={event => setBody(event.target.value)} /></label>
        <p>The selected email is included as an .eml attachment with its original content and attachments.</p>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <footer><button type="submit" className="email-send-action" disabled={sending || !body.trim()}>{sending ? 'Sending...' : 'Send forward'}</button><button type="button" className="secondary-action" disabled={sending} onClick={() => { setComposing(false); setError('') }}>Back</button></footer>
    </form>}
  </dialog>
}

