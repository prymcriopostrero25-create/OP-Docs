import { useEffect, useId, useRef } from 'react'
import './LoadingModal.css'
import { lockBodyScroll } from '../lib/scrollLock'
import { isApprovalPromptOpen } from '../lib/approvalPassword'

export default function LoadingModal({ title = 'Loading...', description = 'Please wait.' }) {
  const dialog = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const element = dialog.current
    const trigger = document.activeElement
    let active = true
    let unlockScroll
    function hide() {
      element.close()
      unlockScroll?.()
      unlockScroll = undefined
    }
    function show() {
      if (!active || !element.isConnected || element.open || isApprovalPromptOpen()) return
      unlockScroll = lockBodyScroll()
      element.showModal()
    }
    function promptChanged(event) {
      if (event.detail.open) hide()
      else if (event.detail.authorized) queueMicrotask(show)
    }
    window.addEventListener('approval-prompt', promptChanged)
    // Open after any containing dialog so the loader stays above it.
    queueMicrotask(show)
    return () => {
      active = false
      window.removeEventListener('approval-prompt', promptChanged)
      hide()
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
