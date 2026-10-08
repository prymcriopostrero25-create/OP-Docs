import { lockBodyScroll } from './scrollLock'
import './approvalPassword.css'

let approvalPromptOpen = false
export const isApprovalPromptOpen = () => approvalPromptOpen

// Keep the password only in memory for this request; validation lives on the server.
export function requestApprovalPassword(authorize) {
  return new Promise((resolve, reject) => {
    approvalPromptOpen = true
    window.dispatchEvent(new CustomEvent('approval-prompt', { detail: { open: true } }))
    const trigger = document.activeElement
    const unlock = lockBodyScroll()
    const dialog = document.createElement('dialog')
    dialog.className = 'approval-password-dialog'
    dialog.setAttribute('aria-labelledby', 'approval-password-title')
    dialog.setAttribute('aria-describedby', 'approval-password-description')
    dialog.innerHTML = `<form>
      <header class="approval-password-heading">
        <span class="approval-password-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/></svg></span>
        <div><span class="approval-password-eyebrow">DOCUMENT APPROVAL</span>
        <h2 id="approval-password-title">Authorize e-signature</h2></div>
      </header>
      <div class="approval-password-body">
        <p id="approval-password-description">Enter the president's password to approve this document and attach the e-signature.</p>
        <label for="approval-password-input">President's password</label>
        <input id="approval-password-input" name="approvalPassword" type="password" required autocomplete="off" autofocus placeholder="Enter password" />
        <p role="alert" class="approval-password-error" hidden></p>
      </div>
      <footer class="approval-password-footer">
        <button type="button" class="approval-password-cancel">Cancel</button>
        <button type="submit" class="approval-password-submit">Authorize</button>
      </footer>
    </form>`
    let busy = false
    function finish(result) {
      dialog.close()
      dialog.remove()
      unlock()
      trigger?.focus()
      approvalPromptOpen = false
      window.dispatchEvent(new CustomEvent('approval-prompt', { detail: { open: false, authorized: false } }))
      if (result === null) reject(new Error('Approval cancelled. The e-signature was not attached.'))
      else resolve(result)
    }
    dialog.addEventListener('cancel', event => { event.preventDefault(); if (!busy) finish(null) })
    dialog.querySelector('button[type="button"]').addEventListener('click', () => { if (!busy) finish(null) })
    dialog.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault()
      if (busy) return
      busy = true
      const input = dialog.querySelector('input')
      const submit = dialog.querySelector('button[type="submit"]')
      const error = dialog.querySelector('[role="alert"]')
      error.hidden = true
      dialog.querySelectorAll('button, input').forEach(element => { element.disabled = true })
      submit.textContent = 'Approving…'
      try { finish(await authorize(input.value)) }
      catch (failure) {
        error.textContent = failure.message
        error.hidden = false
        input.value = ''
        dialog.querySelectorAll('button, input').forEach(element => { element.disabled = false })
        submit.textContent = 'Authorize'
        input.focus()
      } finally { busy = false }
    })
    document.body.append(dialog)
    dialog.showModal()
  })
}
