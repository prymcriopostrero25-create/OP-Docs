import { useEffect, useRef, useState } from 'react'
import { fetchEmailThread } from '../lib/appsScriptApi'
import EmailAttachment from './EmailAttachment'

function emailDocument(html, showImages) {
  const document = new DOMParser().parseFromString(html, 'text/html')
  document.querySelectorAll('script, iframe, object, embed, form, meta, base, link, svg, math').forEach(node => node.remove())
  document.querySelectorAll('*').forEach(node => {
    for (const attribute of [...node.attributes]) {
      if (/^on/i.test(attribute.name) || ['srcdoc', 'srcset', 'action', 'formaction', 'background'].includes(attribute.name)) node.removeAttribute(attribute.name)
    }
    if (node.hasAttribute('src') && !/^data:image\/(png|jpeg|gif|webp);base64,/i.test(node.getAttribute('src')) && !(showImages && node.tagName === 'IMG' && /^https:\/\//i.test(node.getAttribute('src')))) node.removeAttribute('src')
    if (node.hasAttribute('href')) {
      if (!/^(https?:\/\/|mailto:)/i.test(node.getAttribute('href'))) node.removeAttribute('href')
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }
  })
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:${showImages ? ' https:' : ''}; base-uri 'none'; form-action 'none'"><meta name="referrer" content="no-referrer"><style>body{font:14px Arial,sans-serif;overflow-wrap:anywhere;margin:16px;color:#202820}img{max-width:100%;height:auto}table{max-width:100%}</style>${document.head.innerHTML}</head><body>${document.body.innerHTML}</body></html>`
}

export default function EmailConversation({ email, onClose, onRead }) {
  const dialog = useRef(null)
  const read = useRef(onRead)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [showImages, setShowImages] = useState(false)
  const [selectedAttachment, setSelectedAttachment] = useState(null)
  useEffect(() => { read.current = onRead }, [onRead])
  useEffect(() => { dialog.current.showModal() }, [])
  useEffect(() => {
    let active = true
    fetchEmailThread(email.link).then(value => {
      if (!active) return
      setResult(value)
      read.current(email, value.latestMessageId)
    }).catch(reason => { if (active) setError(reason.message) })
    return () => { active = false }
  }, [email, attempt])
  return <dialog ref={dialog} className="email-conversation" aria-labelledby="email-conversation-title" onCancel={onClose} onClose={onClose}>
    <header className="email-conversation-heading">
      <div><p className="eyebrow">Inbox conversation</p><h2 id="email-conversation-title">{email.subject || 'Email conversation'}</h2></div>
      <button type="button" className="secondary-action" onClick={onClose} aria-label="Close conversation">✕</button>
    </header>
    <div className="email-conversation-content">
      {result && <button type="button" className="secondary-action" aria-pressed={showImages} onClick={() => setShowImages(value => !value)}>{showImages ? 'Hide external images' : 'Show external images'}</button>}
      {!result && !error && <p role="status">Loading conversation...</p>}
      {error && <div role="alert"><p>{error}</p><button type="button" className="secondary-action" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Try again</button></div>}
      {result && !result.messages.length && <p>No messages are available in this conversation.</p>}
      {result?.messages.map((message, index) => <details className="email-message" key={message.id} open={index === result.messages.length - 1}>
        <summary><strong>{message.from || 'Unknown sender'}</strong><time dateTime={message.date}>{new Date(message.date).toLocaleString()}</time></summary>
        {message.cc && <div className="email-message-addresses">CC: {message.cc}</div>}
        {message.html ? <iframe title={`Message from ${message.from}`} sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={emailDocument(message.html, showImages)} /> : <pre className="email-message-text">{message.text || 'This message has no readable text body.'}</pre>}
        {!!message.attachments.length && <div className="email-message-attachments"><strong>Attachments</strong>{message.attachments.map((file, index) => <button type="button" className="secondary-action" key={index} onClick={() => setSelectedAttachment({ messageId: message.id, file })}>{file.name} ({Math.ceil(file.size / 1024)} KB)</button>)}</div>}
      </details>)}
    </div>
    {selectedAttachment && <EmailAttachment link={email.link} {...selectedAttachment} onClose={() => setSelectedAttachment(null)} />}
  </dialog>
}
