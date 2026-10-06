export function preparedPdfFile(result) {
  if (typeof result?.data !== 'string' || result.data.length > Math.ceil(25 * 1024 * 1024 / 3) * 4) {
    throw new Error('The preview service returned an invalid or oversized PDF.')
  }
  let binary
  try { binary = atob(result.data) }
  catch { throw new Error('The preview service returned unreadable PDF data.') }
  if (!binary.startsWith('%PDF-')) throw new Error('The preview service did not return a PDF. Retry preparation.')
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return new File([bytes], result.name || 'Document.pdf', { type: 'application/pdf' })
}
