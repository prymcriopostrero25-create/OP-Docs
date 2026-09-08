import { classifyDocument } from './documentClassification'

export async function readPdfClassification(file) {
  let task
  try {
    const pdfjs = await import('pdfjs-dist')
    const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false })
    // Password-protected files can still be filed using explicit user selections.
    task.onPassword = () => { void task.destroy() }
    const pdf = await task.promise
    let text = ''
    for (let index = 1; index <= Math.min(pdf.numPages, 5); index++) {
      const page = await pdf.getPage(index)
      const content = await page.getTextContent()
      text += '\n' + content.items.map(item => item.str || '').join(' ')
      page.cleanup()
    }
    return { ...classifyDocument(file.name, text), note: text.trim() ? 'Detected from the filename and the first five pages. Check the type and document year below.' : 'No readable PDF text. Check the filename suggestion or select the type and year.' }
  } catch {
    return { ...classifyDocument(file.name), note: 'PDF text could not be read. Check the filename suggestion or select the type and year.' }
  } finally {
    if (task) await task.destroy().catch(() => {})
  }
}
