// Capture the rendered paper, including Tailwind styles, signature and timestamp.
export async function previewPdfFile(paper, name = 'Document.pdf') {
  if (!paper) throw new Error('The document preview is not ready.')
  const [{ toCanvas }, { PDFDocument }] = await Promise.all([import('html-to-image'), import('pdf-lib')])
  await document.fonts.ready
  await Promise.all(Array.from(paper.querySelectorAll('img'), async image => {
    await image.decode()
    if (!image.naturalWidth) throw new Error('A preview image could not be loaded.')
  }))
  const bounds = paper.getBoundingClientRect()
  const width = Math.ceil(bounds.width), height = Math.ceil(bounds.height)
  if (!width || !height || height > 16000) throw new Error('The preview is too large to export. Reduce the document length and retry.')
  const a4 = /Authority|Certificate|Travel Certificate/i.test(paper.getAttribute('aria-label') || '')
  const pageWidth = a4 ? 595.28 : 612
  const pageHeight = a4 ? 841.89 : 792
  // Protect text lines and images from being cut at page boundaries.
  const protectedRects = []
  const walker = document.createTreeWalker(paper, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    if (!walker.currentNode.textContent.trim()) continue
    const range = document.createRange()
    range.selectNodeContents(walker.currentNode)
    for (const rect of range.getClientRects()) protectedRects.push({ top: rect.top - bounds.top, bottom: rect.bottom - bounds.top })
  }
  for (const image of paper.querySelectorAll('img')) {
    const rect = image.getBoundingClientRect()
    protectedRects.push({ top: rect.top - bounds.top, bottom: rect.bottom - bounds.top })
  }
  const canvas = await toCanvas(paper, { pixelRatio: 2, backgroundColor: '#ffffff', width, height,
    style: { margin: '0', boxShadow: 'none' }, onImageErrorHandler: () => { throw new Error('A preview image could not be embedded.') } })
  const pdf = await PDFDocument.create()
  const segments = previewPageSegments(height, width * pageHeight / pageWidth, protectedRects)
  for (const { start, end } of segments) {
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    const scale = canvas.height / height
    const sourceTop = Math.round(start * scale), sourceEnd = Math.round(end * scale)
    slice.height = sourceEnd - sourceTop
    const context = slice.getContext('2d')
    if (!context) throw new Error('PDF rendering is unavailable in this browser.')
    context.drawImage(canvas, 0, sourceTop, canvas.width, slice.height, 0, 0, slice.width, slice.height)
    const image = await pdf.embedPng(slice.toDataURL('image/png'))
    const drawnHeight = (end - start) * pageWidth / width
    pdf.addPage([pageWidth, pageHeight]).drawImage(image, { x: 0, y: pageHeight - drawnHeight, width: pageWidth, height: drawnHeight })
  }
  return new File([await pdf.save()], name.replace(/\.pdf$/i, '') + '.pdf', { type: 'application/pdf' })
}

export function previewPageSegments(height, pageHeight, protectedRects = []) {
  const pages = []
  for (let start = 0; start < height;) {
    let end = Math.min(height, start + pageHeight)
    if (end < height) {
      // Moving upward can encounter an overlapping line; resolve until stable.
      for (let count = 0; count < protectedRects.length; count++) {
        const crossing = protectedRects.filter(rect => rect.top < end && rect.bottom > end)
        if (!crossing.length) break
        const next = Math.floor(Math.min(...crossing.map(rect => rect.top)))
        // Oversized images cannot fit on a page; preserve forward progress.
        if (next <= start) break
        end = next
      }
    }
    pages.push({ start, end })
    start = end
  }
  return pages
}
