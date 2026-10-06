export async function sendWithConfirmation(form, request) {
  let result
  try {
    result = await request({ ...form, action: 'sendDocument' })
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
