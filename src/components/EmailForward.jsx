import { useEffect, useRef, useState } from 'react'
import { fetchEmailThread, forwardEmail } from '../lib/appsScriptApi'
import EmailReplyEditor from './EmailReplyEditor'

function historyKey() {
  const account = JSON.parse(localStorage.getItem('op-dms-user') || 'null')
  return account?.email ? 'op-email-forward-history:' + account.email.toLowerCase() : null
}

function readHistory() {
  try {
    const key = historyKey()
    const saved = key ? JSON.parse(localStorage.getItem(key) || '[]') : []
    return Array.isArray(saved) ? saved.filter(value => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)).slice(0, 100) : []
  } catch { return [] }
}

export default function EmailForward({ email, onClose, onForwarded }) {
  const dialog = useRef(null)
  const requestId = useRef(null)
  const [messages, setMessages] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [selected, setSelected] = useState('')
  const [composing, setComposing] = useState(false)
  const [to, setTo] = useState('')
  const [history, setHistory] = useState(readHistory)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [bodyRich, setBodyRich] = useState(null)
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
    if (!body.trim() || body.length > 20000) { setError('Enter a body up to 20,000 characters.'); return }
    const recipients = [...new Set(to.split(/[;,\s]+/).filter(Boolean))]
    if (!recipients.length || recipients.length > 30 || recipients.some(value => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) { setError('Enter valid email addresses, up to 30 recipients.'); return }
    setSending(true); setError('')
    if (!requestId.current) requestId.current = crypto.randomUUID()
    try {
      await forwardEmail({ link: email.link, messageId: selected, to: recipients.join(', '), subject, message: body, bodyRich, requestId: requestId.current })
      const nextHistory = [...new Set([...recipients.map(value => value.toLowerCase()), ...readHistory(), ...history])].slice(0, 100)
      setHistory(nextHistory)
      try {
        const key = historyKey()
        if (key) localStorage.setItem(key, JSON.stringify(nextHistory))
      } catch { /* A confirmed forward still succeeds when browser storage is unavailable. */ }
      setSent(true)
      onForwarded?.()
    } catch (reason) { setError(reason.message) }
    finally { setSending(false) }
  }
  return <dialog ref={dialog} className="email-forward" aria-labelledby="email-forward-title" onCancel={event => { if (sending) event.preventDefault(); else onClose() }} onClose={onClose}>
    <header>
      <span className="email-forward-icon" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m14 4 7 7-7 7M21 11H10a7 7 0 0 0-7 7v2" /></svg></span>
      <div className="email-forward-heading"><small>{sent ? 'Complete' : composing ? 'Step 2 of 2 · Compose' : 'Step 1 of 2 · Select message'}</small><h2 id="email-forward-title">{sent ? 'Email forwarded' : composing ? 'Compose forward' : 'Forward an email'}</h2></div>
      <button type="button" className="secondary-action email-forward-close" disabled={sending} onClick={onClose} aria-label="Close forward">×</button>
    </header>
    {sent ? <p role="status">Your email was forwarded successfully.</p> : !composing ? <>
      <div className="email-forward-context"><small>CONVERSATION</small><strong>{email.subject || '(No subject)'}</strong><p>Choose the message you’d like to share.</p></div>
      {!messages && !error && <p role="status">Loading messages...</p>}
      {error && <div role="alert">{error} <button type="button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Try again</button></div>}
      {messages?.length === 0 && <p>No messages are available to forward.</p>}
      <div className="email-forward-messages" role="group" aria-label="Choose an email to forward">{messages?.map(message => <label key={message.id}><input type="radio" name="forward-message" value={message.id} checked={selected === message.id} onChange={() => setSelected(message.id)} /><span><strong>{message.subject || '(No subject)'}</strong><span className="email-forward-sender">{message.from}</span><small className="email-forward-date">{new Date(message.date).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</small><span className="email-forward-excerpt">{message.text?.slice(0, 180)}</span></span></label>)}</div>
      <footer><span className="email-forward-selection" role="status">{selected ? '1 message selected' : 'Select a message to continue'}</span><button type="button" className="email-send-action" disabled={!selected} onClick={() => { const message = messages.find(item => item.id === selected); setSubject(message.subject || ''); setError(''); setComposing(true) }}>Continue <span aria-hidden="true">→</span></button></footer>
    </> : <form onSubmit={send}>
      <fieldset disabled={sending}>
        <label>To<input autoFocus required value={to} onChange={event => setTo(event.target.value)} placeholder="name@example.com, another@example.com" aria-describedby="forward-recipient-help" /></label>
        <small id="forward-recipient-help">Separate multiple addresses with commas, semicolons, or spaces. Maximum 30 recipients.</small>
        <section className="email-forward-history" aria-label="Email history">
          <strong>Email history</strong>
          <small>{history.length ? 'Select an address to add it to To.' : 'Recipients will appear here after a successful forward.'}</small>
          {history.length > 0 && <div>{history.map(address => {
            const recipients = to.split(/[;,\s]+/).filter(Boolean)
            const included = recipients.some(value => value.toLowerCase() === address.toLowerCase())
            return <button type="button" key={address} disabled={included || recipients.length >= 30} onClick={() => setTo([...recipients, address].join(', '))}>{address}</button>
          })}</div>}
        </section>
        <label>Subject<input readOnly value={subject} placeholder="(No subject)" /></label><small>The original subject is preserved to keep this forward in the conversation.</small>
        <div className="email-forward-body-label">Body</div>
        <EmailReplyEditor disabled={sending} label="Forward body" placeholder="Add a message to your forward..." initialContent={bodyRich} onChange={(text, rich) => { setBody(text); setBodyRich(rich) }} />
        <p>All original attachments from the selected email are forwarded as separate files, keeping their filenames and file types.</p>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <footer><button type="submit" className="email-send-action" disabled={sending || !body.trim()}>{sending ? 'Sending...' : 'Send forward'}</button><button type="button" className="secondary-action" disabled={sending} onClick={() => { setComposing(false); setError('') }}>Back</button></footer>
    </form>}
  </dialog>
}

