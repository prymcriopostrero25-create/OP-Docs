import { verificationCodeFromQr } from './documentQr.js'

const PREFIX = '\n%OP-ISSUED-FILE:v1:'

async function checksum(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('PDF file checking requires HTTPS and a supported browser.')
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}

// Like the transmittal system, append a comment after EOF. This is a
// consistency checksum, not an issuer signature: it can be recomputed.
export async function sealDocumentPdf(file, code) {
  if (verificationCodeFromQr(code) !== code) throw new Error('Invalid document verification code.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  return new File([bytes, `${PREFIX}${code}:${await checksum(bytes)}\n`], file.name, { type: 'application/pdf' })
}

export async function inspectDocumentPdf(file) {
  if (!/\.pdf$/i.test(file.name) || !file.size || file.size > 25 * 1024 * 1024) throw new Error('Choose a PDF file up to 25 MB.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  // A one-byte decoder keeps marker offsets equal to byte offsets.
  const text = new TextDecoder('latin1').decode(bytes)
  const index = text.lastIndexOf(PREFIX)
  if (index < 0) return { sealed: false }
  const marker = text.slice(index + PREFIX.length)
  const match = /^([a-f0-9-]{72}):([a-f0-9]{64})\n$/i.exec(marker)
  if (!match || verificationCodeFromQr(match[1]) !== match[1]) throw new Error('The PDF file check is damaged. Choose the original PDF downloaded from the portal.')
  if (await checksum(bytes.slice(0, index)) !== match[2].toLowerCase()) throw new Error('This PDF has changed since its file check was created. Choose the original PDF downloaded from the portal.')
  return { sealed: true, code: match[1], name: file.name }
}
