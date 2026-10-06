export async function sendWithConfirmation(form, request, { pollInterval = 3000 } = {}) {
  // Keep the send running once, but check its persisted Gmail receipt while
  // spreadsheet logging or the original HTTP response is still pending.
  const sending = Promise.resolve().then(() => request({ ...form, action: 'sendDocument' }))
    .then(result => ({ result }), error => ({ error }))
  let outcome
  while (!outcome) {
    let timer
    const next = await Promise.race([sending, new Promise(resolve => { timer = setTimeout(() => resolve(null), pollInterval) })])
    clearTimeout(timer)
    if (next) { outcome = next; break }
    const checking = Promise.resolve().then(() => request({ ...form, action: 'documentSendStatus' })).catch(() => null)
    const checked = await Promise.race([sending, checking.then(result => ({ checked: result }))])
    if ('checked' in checked) {
      if (checked.checked?.document?.id === form.id && checked.checked.document.status === 'Out') return checked.checked.document
    } else outcome = checked
  }
  let result
  try {
    if (outcome.error) throw outcome.error
    result = outcome.result
  } catch (error) {
    // A transport failure can happen after Gmail accepted the message. Only
    // check the existing request here; never start a second send automatically.
    if (!/404|502|504|timed out|too long|fetch|network|webpage|invalid response/i.test(error.message)) throw error
    try { result = await request({ ...form, action: 'documentSendStatus' }) } catch { /* Keep delivery uncertain. */ }
    if (result?.document?.id !== form.id || result.document.status !== 'Out') {
      throw new Error('The email may have been sent, but confirmation could not be retrieved. Check Gmail Sent before starting another email. You can retry this same form to recover the existing send.', { cause: error })
    }
  }
  if (result?.document?.id !== form.id || result.document.status !== 'Out') {
    throw new Error('The server did not confirm the email result. Check Gmail Sent, then retry this same form to recover the existing send.')
  }
  return result.document
}
