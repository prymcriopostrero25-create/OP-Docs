import { verificationLink } from './appsScriptApi'
import { stampVerificationQr } from './stampVerificationQr'
import { generateDocumentQr } from './documentQrGenerator'
import { sealDocumentPdf } from './documentIntegrity'

export async function verifiedPdf(file, id) {
  const code = await verificationLink(id)
  const { qr, url } = await generateDocumentQr(code, new URL(window.location.pathname, window.location.origin).href)
  const stamped = await stampVerificationQr(file, qr)
  return { file: await sealDocumentPdf(stamped, code), qr, url }
}
