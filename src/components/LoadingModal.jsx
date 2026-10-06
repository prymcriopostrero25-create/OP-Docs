import { useEffect, useId, useRef } from 'react'
import './LoadingModal.css'
import { lockBodyScroll } from '../lib/scrollLock'

export default function LoadingModal({ title = 'Loading...', description = 'Please wait.' }) {
  const dialog = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const element = dialog.current
    const trigger = document.activeElement
    let active = true
    const unlockScroll = lockBodyScroll()
    // Open after any containing dialog so the loader stays above it.
    queueMicrotask(() => { if (active && element.isConnected) element.showModal() })
    return () => {
      active = false
      element.close()
      unlockScroll()
      if (trigger?.isConnected) trigger.focus()
    }
  }, [])

  return <dialog ref={dialog} className="loading-modal" aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy="true" onCancel={event => event.preventDefault()}>
    <div role="status" aria-live="polite">
      <span className="loading-modal-spinner" aria-hidden="true" />
      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId}>{description}</p>
    </div>
  </dialog>
}
