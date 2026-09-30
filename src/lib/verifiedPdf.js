import { verificationLink } from './appsScriptApi'

export async function verifiedPdf(file, id) {
  const [{ default: QRCode }, { PDFDocument, rgb, StandardFonts }] = await Promise.all([import('qrcode'), import('pdf-lib')])
  const code = await verificationLink(id)
  const url = new URL(window.location.pathname, window.location.origin)
  url.searchParams.set('verify', code)
  const qr = await QRCode.toDataURL(url.href, { width: 240, margin: 2, errorCorrectionLevel: 'M' })
  const pdf = await PDFDocument.load(await file.arrayBuffer())
  // A separate verification page preserves every original page and its formatting.
  const page = pdf.addPage([595.28, 841.89])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const image = await pdf.embedPng(qr)
  page.drawText('Office of the President', { x: 50, y: 760, size: 20, font, color: rgb(0.45, 0.05, 0.14) })
  page.drawText('Document registry verification', { x: 50, y: 727, size: 16, font })
  page.drawImage(image, { x: 50, y: 530, width: 170, height: 170 })
  page.drawText('Scan to check the reference, document type, and current status.', { x: 50, y: 495, size: 11, font })
  page.drawText('This confirms the registry entry, not the authenticity of every page.', { x: 50, y: 475, size: 11, font })
  return { file: new File([await pdf.save()], file.name, { type: 'application/pdf' }), qr, url: url.href }
}
