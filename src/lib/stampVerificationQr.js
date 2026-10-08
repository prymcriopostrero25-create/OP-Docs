export async function stampVerificationQr(file, qr) {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib')
  const pdf = await PDFDocument.load(await file.arrayBuffer())
  const page = pdf.getPages()[0]
  if (!page) throw new Error('The PDF has no pages.')
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const image = await pdf.embedPng(qr)
  // Reserve space below the original content, preserving the page count.
  const { width, height } = page.getSize()
  const original = await pdf.embedPage(page)
  const replacement = pdf.insertPage(0, [width, height])
  replacement.drawPage(original, { x: 0, y: 96, width, height: height - 96 })
  replacement.drawImage(image, { x: width - 96, y: 6, width: 84, height: 84 })
  replacement.drawText('Scan to verify this document', { x: 24, y: 30, size: 9, font, color: rgb(0.2, 0.39, 0.26) })
  pdf.removePage(1)
  return new File([await pdf.save()], file.name, { type: 'application/pdf' })
}
