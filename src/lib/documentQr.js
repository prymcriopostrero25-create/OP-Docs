export function verificationCodeFromQr(value) {
  let code = String(value || '').trim()
  if (!/^[a-f0-9-]{72}$/i.test(code)) {
    try { code = new URL(code).searchParams.get('verify') || '' } catch { return null }
  }
  return /^[a-f0-9-]{72}$/i.test(code) ? code : null
}

export function qrDecoderFromModule(module) {
  // CommonJS interop differs between Node, Vite development, and production.
  const decoder = [module, module?.default, module?.default?.default].find(value => typeof value === 'function')
  if (!decoder) throw new Error('Unable to load the QR scanner. Refresh the page and retry.')
  return decoder
}

export async function scanDocumentCanvas(canvas) {
  const jsQR = qrDecoderFromModule(await import('jsqr'))
  const pixels = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height)
  const result = jsQR(pixels.data, pixels.width, pixels.height)
  if (!result) return null
  const code = verificationCodeFromQr(result.data)
  if (!code) throw new Error('This QR code is not a document verification code.')
  return code
}

export async function scanDocumentPdf(file) {
  if (!/\.pdf$/i.test(file.name) || !file.size || file.size > 25 * 1024 * 1024) throw new Error('Choose a PDF file up to 25 MB.')
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false })
  const canvas = document.createElement('canvas')
  try {
    const pdf = await task.promise
    const page = await pdf.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: Math.min(3, 2400 / Math.max(base.width, base.height)) })
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    await page.render({ canvasContext: canvas.getContext('2d', { willReadFrequently: true }), viewport }).promise
    // Read our page-1 verification band first, away from letterhead QR codes.
    const footer = document.createElement('canvas')
    footer.width = Math.min(canvas.width, Math.ceil(110 * viewport.scale))
    footer.height = Math.min(canvas.height, Math.ceil(100 * viewport.scale))
    footer.getContext('2d', { willReadFrequently: true }).drawImage(canvas,
      canvas.width - footer.width, canvas.height - footer.height, footer.width, footer.height,
      0, 0, footer.width, footer.height)
    let code
    try { code = await scanDocumentCanvas(footer) }
    finally { footer.width = footer.height = 0 }
    if (!code) code = await scanDocumentCanvas(canvas)
    if (!code) throw new Error('No verification QR code was found on page 1. Upload a PDF downloaded from this portal with its QR code attached.')
    return code
  } finally { canvas.width = canvas.height = 0; await task.destroy() }
}
