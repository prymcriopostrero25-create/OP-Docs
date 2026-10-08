import { verificationCodeFromQr } from './documentQr.js'

export async function generateDocumentQr(code, portalUrl) {
  if (verificationCodeFromQr(code) !== code) throw new Error('The registry returned an invalid verification code.')
  const url = new URL(portalUrl)
  url.search = ''
  url.hash = ''
  url.searchParams.set('verify', code)
  const { default: QRCode } = await import('qrcode')
  // Whole pixels per module and a four-module quiet zone help PDF/camera scans.
  const qr = await QRCode.toDataURL(url.href, { scale: 8, margin: 4, errorCorrectionLevel: 'M' })
  return { qr, url: url.href }
}
