import { useEffect, useRef, useState } from 'react'
import { fetchEmailAttachment } from '../lib/appsScriptApi'

export default function EmailAttachment({ link, messageId, file, onClose }) {
  const dialog = useRef(null)
  const [attachment, setAttachment] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { dialog.current.showModal() }, [])
  useEffect(() => {
    let active = true, url
    fetchEmailAttachment(link, messageId, file.partId).then(result => {
      if (!active) return
      const bytes = Uint8Array.from(atob(result.data), char => char.charCodeAt(0))
      const type = result.mimeType.toLowerCase().split(';')[0]
      const previewable = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'text/plain'].includes(type)
      url = URL.createObjectURL(new Blob([bytes], { type: previewable ? type : 'application/octet-stream' }))
      setAttachment({ url, type, name: result.name, text: type === 'text/plain' ? new TextDecoder().decode(bytes) : '' })
    }).catch(reason => { if (active) setError(reason.message) })
    return () => { active = false; if (url) URL.revokeObjectURL(url) }
  }, [link, messageId, file.partId])
  return <dialog ref={dialog} className="email-conversation email-attachment-preview" aria-labelledby="attachment-title" onCancel={event => { event.stopPropagation(); onClose() }}>
    <header className="email-conversation-heading"><h2 id="attachment-title">{file.name}</h2><button type="button" className="secondary-action" onClick={onClose}>Close preview</button></header>
    <div className="email-conversation-content">
      {error && <p role="alert">{error}</p>}
      {!attachment && !error && <p role="status">Loading attachment...</p>}
      {attachment && <>
        <a className="secondary-action" href={attachment.url} download={attachment.name}>Download attachment</a>
        {attachment.type === 'application/pdf' ? <iframe className="email-attachment-frame" title={attachment.name} src={attachment.url} />
          : ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(attachment.type) ? <img className="email-attachment-image" src={attachment.url} alt={attachment.name} />
          : attachment.type === 'text/plain' ? <pre className="email-message-text">{attachment.text}</pre>
          : <p>Preview is unavailable for this file type. Download it to open it.</p>}
      </>}
    </div>
  </dialog>
}
