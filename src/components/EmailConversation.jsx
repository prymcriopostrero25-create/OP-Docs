import EmailIcon from './EmailIcon'
import { useEffect, useRef, useState } from 'react'
import { fetchEmailThread, replyEmail } from '../lib/appsScriptApi'
import EmailReplyEditor from './EmailReplyEditor'
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
  const composer = useRef(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [showImages, setShowImages] = useState(false)
  const [replyTarget, setReplyTarget] = useState(null)
  const [replyFiles, setReplyFiles] = useState([])
  const [fileError, setFileError] = useState('')
  async function addReplyFiles(event) {
    const files = [...event.target.files]
    event.target.value = ''
    if (replyFiles.length + files.length > 10 || replyFiles.reduce((sum, file) => sum + file.size, 0) + files.reduce((sum, file) => sum + file.size, 0) > 20 * 1024 * 1024) { setFileError('Choose up to 10 attachments totaling 20 MB.'); return }
    try {
      const added = await Promise.all(files.map(file => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve({ name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, data: String(reader.result).split(',')[1] })
        reader.onerror = () => reject(new Error('Unable to read ' + file.name))
        reader.readAsDataURL(file)
      })))
      setReplyFiles(previous => [...previous, ...added]); setFileError('')
    } catch (error) { setFileError(error.message) }
  }
  const [replyRich, setReplyRich] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [replyState, setReplyState] = useState('')
  const replyId = useRef(null)
  async function sendReply(event) {
    event.preventDefault()
    if (!replyId.current) replyId.current = crypto.randomUUID()
    setReplyState('sending')
    try {
      await replyEmail(email.link, replyTarget.id, replyText, replyId.current, replyRich, replyFiles)
      setReplyState('sent'); setReplyFiles([]); setReplyText(''); setReplyTarget(null); replyId.current = null
      setAttempt(value => value + 1)
    } catch (reason) { setReplyState(reason.message) }
  }
  const [expandAll, setExpandAll] = useState(false)
  const [selectedAttachment, setSelectedAttachment] = useState(null)
  useEffect(() => { read.current = onRead }, [onRead])
  useEffect(() => { dialog.current.showModal() }, [])
  useEffect(() => {
    if (replyTarget) {
      composer.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      composer.current?.querySelector('[role="textbox"]')?.focus({ preventScroll: true })
    }
  }, [replyTarget])
  useEffect(() => {
    let active = true
    fetchEmailThread(email.link).then(value => {
      if (!active) return
      setResult(value)
      read.current(email, value.latestMessageId)
    }).catch(reason => { if (active) setError(reason.message) })
    return () => { active = false }
  }, [email, attempt])
  return <dialog ref={dialog} className="email-conversation" aria-labelledby="email-conversation-title" onCancel={event => { if (event.target === dialog.current) onClose() }} onClose={event => { if (event.target === dialog.current) onClose() }}>
    <header className="email-conversation-heading">
      <div><p className="eyebrow">{email.reference || 'Inbox conversation'}</p><h2 id="email-conversation-title">{email.subject || 'Email conversation'}</h2></div>
      <button type="button" className="secondary-action" onClick={onClose} aria-label="Close conversation"><EmailIcon name="close" /></button>
    </header>
    <div className="email-conversation-content">
      {result && <div className="email-conversation-toolbar"><span>{result.messages.length} {result.messages.length === 1 ? 'message' : 'messages'}</span><button type="button" className="secondary-action" aria-pressed={expandAll} onClick={() => setExpandAll(value => !value)}>{expandAll ? 'Collapse earlier messages' : 'Expand all messages'}</button><button type="button" className="secondary-action" aria-pressed={showImages} onClick={() => setShowImages(value => !value)}>{showImages ? 'Hide external images' : 'Show external images'}</button></div>}
      {!result && !error && <p role="status">Loading conversation...</p>}
      {error && <div role="alert"><p>{error}</p><button type="button" className="secondary-action" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Try again</button></div>}
      {result && !result.messages.length && <p>No messages are available in this conversation.</p>}
      {result?.messages.map((message, index) => <details className="email-message" key={message.id} open={expandAll || index === result.messages.length - 1}>
        <summary><span className="email-message-avatar" aria-hidden="true">{(message.from || "Unknown").replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase()}</span><strong>{message.from || 'Unknown sender'}</strong><time dateTime={message.date}>{new Date(message.date).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })}</time></summary>
        {message.to && <div className="email-message-addresses">To: {message.to}</div>}
        {message.cc && <div className="email-message-addresses">CC: {message.cc}</div>}
        {!!message.attachments.length && <div className="email-message-attachments"><strong>Attachments</strong>{message.attachments.map((file, index) => <button type="button" className="email-attachment-card" key={index} onClick={() => setSelectedAttachment({ messageId: message.id, file })}><span className="email-attachment-icon"><EmailIcon name="attach" size={22} /></span><span><strong>{file.name}</strong><small>{Math.ceil(file.size / 1024)} KB &middot; Open attachment</small></span></button>)}</div>}
        {message.html ? <iframe title={`Message from ${message.from}`} sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={emailDocument(message.html, showImages)} /> : <pre className="email-message-text">{message.text || 'This message has no readable text body.'}</pre>}
        {message.canReply !== false && <div className="email-reply-trigger"><button type="button" className="secondary-action" disabled={replyState === 'sending'} onClick={() => { setReplyTarget(message); setReplyText(''); setReplyRich(null); setReplyFiles([]); setFileError(''); setReplyState(''); replyId.current = null }}><EmailIcon name="reply" /> Reply</button></div>}
      </details>)}
      {replyState === 'sent' && <p role="status">Reply sent successfully.</p>}
      {replyTarget && <form ref={composer} className="email-reply-composer" onSubmit={sendReply}>
        <header><span className="email-compose-icon"><EmailIcon name="reply" size={22} /></span><div><strong>Write a reply</strong><span>To: {replyTarget.replyTo || replyTarget.from}</span></div><span className="email-compose-badge">In this conversation</span></header>
        <p className="email-reply-label">Your message</p>
        <EmailReplyEditor key={replyTarget.id} disabled={replyState === 'sending'} onChange={(text, rich) => { setReplyText(text); setReplyRich(rich) }} />
        <div className="email-reply-files"><label className="email-file-picker"><EmailIcon name="attach" size={16} /> Attach files<input type="file" multiple disabled={replyState === 'sending'} onChange={addReplyFiles} /></label><small>Up to 10 files &middot; 20 MB total</small>
          {replyFiles.map((file, index) => <div className="email-reply-file" key={index}><span>{file.name} ({Math.ceil(file.size / 1024)} KB)</span><button type="button" disabled={replyState === 'sending'} aria-label={'Remove ' + file.name} onClick={() => setReplyFiles(previous => previous.filter((_, i) => i !== index))}>Remove</button></div>)}
          {fileError && <p role="alert">{fileError}</p>}
        </div>
        {replyState && replyState !== 'sending'  && <p role="alert">{replyState}</p>}
        <footer><button type="submit" className="email-send-action" disabled={!replyText.trim() || replyState === 'sending'}><EmailIcon name="send" size={16} />{replyState === 'sending' ? 'Sending...' : 'Send reply'}</button><button type="button" className="secondary-action" disabled={replyState === 'sending'} onClick={() => { setReplyTarget(null); setReplyText(''); setReplyState(''); replyId.current = null }}>Discard</button><small className="email-compose-hint">Your reply stays in this email thread.</small></footer>
      </form>}
    </div>
    {selectedAttachment && <EmailAttachment link={email.link} {...selectedAttachment} onClose={() => setSelectedAttachment(null)} />}
  </dialog>
}
