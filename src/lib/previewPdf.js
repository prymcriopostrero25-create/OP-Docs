export const previewPageWidth = 595.28
export const previewPageHeight = 841.89

// Both the HTML preview and the exported file use these exact page boundaries.
export function measurePreviewPages(paper) {
  const pageWidth = previewPageWidth, pageHeight = previewPageHeight
  const bounds = paper.getBoundingClientRect()
  const width = Math.ceil(bounds.width), height = Math.ceil(bounds.height)
  if (!width || !height || height > 16000) throw new Error('The preview is too large to export. Reduce the document length and retry.')
  const footer = paper.querySelector('footer[aria-label="Document footer"]')
  const footerBounds = footer?.getBoundingClientRect()
  // Snapshot all coordinates together: scrolling during image capture must not
  // move the page number relative to the already measured footer.
  const number = footer?.querySelector('[data-page-number]')
  const numberBounds = number?.getBoundingClientRect()
  const numberLayout = numberBounds ? {
    left: numberBounds.left - bounds.left,
    top: numberBounds.top - footerBounds.top,
    width: numberBounds.width,
    height: numberBounds.height,
    fontSize: parseFloat(getComputedStyle(number).fontSize),
    total: number.dataset.pageNumber === 'total',
  } : null
  const footerHeight = footerBounds ? Math.ceil(footerBounds.height) : 0
  const bottomPadding = parseFloat(getComputedStyle(paper).paddingBottom) || 16
  const footerTop = footerBounds ? footerBounds.top - bounds.top : height
  // Exclude flex auto-margin space and the footer from the flowing content.
  const contentHeight = footer ? Math.ceil(Math.max(1, ...Array.from(paper.children)
    .filter(child => child !== footer)
    .map(child => child.getBoundingClientRect().bottom - bounds.top + (parseFloat(getComputedStyle(child).marginBottom) || 0)))) : height
  const pagePixels = width * pageHeight / pageWidth
  const continuationPadding = 24 * width / pageWidth
  const contentPageHeight = Math.floor(pagePixels - footerHeight - bottomPadding - continuationPadding)
  if (contentPageHeight <= 0) throw new Error('The footer is too large for the page.')
  // Protect text lines and images from being cut at page boundaries.
  const protectedRects = []
  const walker = document.createTreeWalker(paper, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    if (!walker.currentNode.textContent.trim() || footer?.contains(walker.currentNode)) continue
    const range = document.createRange()
    range.selectNodeContents(walker.currentNode)
    for (const rect of range.getClientRects()) protectedRects.push({ top: rect.top - bounds.top, bottom: rect.bottom - bounds.top })
  }
  for (const image of paper.querySelectorAll('img')) {
    if (footer?.contains(image)) continue
    const rect = image.getBoundingClientRect()
    protectedRects.push({ top: rect.top - bounds.top, bottom: rect.bottom - bounds.top })
  }
  return { width, height, footer, footerTop, footerHeight, bottomPadding, numberLayout, pagePixels,
    segments: previewPageSegments(contentHeight, footer ? contentPageHeight : pagePixels, protectedRects) }
}

// Capture the rendered paper, including Tailwind styles, signature and timestamp.
export async function previewPdfFile(paper, name = 'Document.pdf') {
  if (!paper) throw new Error('The document preview is not ready.')
  const [{ toCanvas }, { PDFDocument, rgb }] = await Promise.all([import('html-to-image'), import('pdf-lib')])
  await document.fonts.ready
  await Promise.all(Array.from(paper.querySelectorAll('img'), async image => {
    await image.decode()
    if (!image.naturalWidth) throw new Error('A preview image could not be loaded.')
  }))
  const pageWidth = previewPageWidth, pageHeight = previewPageHeight
  const { width, height, footer, footerTop, footerHeight, bottomPadding, numberLayout, segments } = measurePreviewPages(paper)
  const canvas = await toCanvas(paper, { pixelRatio: 2, backgroundColor: '#ffffff', width, height,
    style: { margin: '0', boxShadow: 'none' }, onImageErrorHandler: () => { throw new Error('A preview image could not be embedded.') } })
  const pdf = await PDFDocument.create()
  let footerImage
  if (footer) {
    const footerCanvas = document.createElement('canvas')
    const scale = canvas.height / height
    footerCanvas.width = canvas.width
    footerCanvas.height = Math.ceil(footerHeight * scale)
    const context = footerCanvas.getContext('2d')
    if (!context) throw new Error('PDF rendering is unavailable in this browser.')
    context.drawImage(canvas, 0, Math.round(footerTop * scale), canvas.width, footerCanvas.height, 0, 0, footerCanvas.width, footerCanvas.height)
    // Remove the preview's literal "1" before reusing this footer on every page.
    if (numberLayout) {
      context.fillStyle = '#ffffff'
      context.fillRect(numberLayout.left * scale - 2, numberLayout.top * scale - 2,
        numberLayout.width * scale + 4, numberLayout.height * scale + 4)
    }
    footerImage = await pdf.embedPng(footerCanvas.toDataURL('image/png'))
  }
  for (const [index, { start, end }] of segments.entries()) {
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
    const page = pdf.addPage([pageWidth, pageHeight])
    const topPadding = footer && index > 0 ? 24 : 0
    page.drawImage(image, { x: 0, y: pageHeight - topPadding - drawnHeight, width: pageWidth, height: drawnHeight })
    if (footerImage) {
      const factor = pageWidth / width
      const footerY = bottomPadding * factor
      page.drawImage(footerImage, { x: 0, y: footerY, width: pageWidth, height: footerHeight * factor })
      if (numberLayout) {
        const x = numberLayout.left * factor
        const y = footerY + (footerHeight - numberLayout.top - numberLayout.height) * factor
        page.drawText(numberLayout.total ? `Page ${index + 1} of ${segments.length}` : String(index + 1), {
          x, y: y + 2, size: numberLayout.fontSize * factor, color: rgb(0.27, 0.34, 0.42),
        })
      }
    }
  }
  return new File([await pdf.save()], name.replace(/\.pdf$/i, '') + '.pdf', { type: 'application/pdf' })
}

export function previewPageSegments(height, pageHeight, protectedRects = []) {
  // Canvas slices use whole pixels. A fractional A4 boundary can otherwise
  // leave a subpixel last page whose canvas serializes as "data:," instead of PNG.
  pageHeight = Math.max(1, Math.round(pageHeight))
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
