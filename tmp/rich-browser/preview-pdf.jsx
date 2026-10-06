import React from 'react'
import { createRoot } from 'react-dom/client'
import DocumentPage from '../../src/components/DocumentPage'
import DocumentRecordPage from '../../src/pages/documents/DocumentRecordPage'
import { DocumentContext } from '../../src/lib/documentContext'
import { previewPdfFile } from '../../src/lib/previewPdf'
import '../../src/index.css'
import '../../src/pages/Dashboard.css'
const form = { type: 'Executive Memorandum', reference: 'Executive Memorandum No. 001, s. 2026', recipientName: 'Test Recipient', recipientLabel: 'For', subject: 'PREVIEW PDF CHECK', date: '2026-10-06', body: 'This document verifies the actual preview PDF. The signature and approval timestamp must match the preview.', status: 'Approved', approvedAt: '2026-10-06T06:30:00Z' }
const integration = location.search.includes('integration')
if (integration) {
 const fetchOriginal = window.fetch.bind(window)
 window.fetch = async (url, options) => {
  if (options?.method === 'POST') {
   const request = JSON.parse(options.body)
   if (request.action === 'editorCapabilities') return new Response(JSON.stringify({ success: true, previewEmailPdfVersion: 1 }))
   if (request.action === 'sendDocument') { window.sentPreview = request.previewPdf; return new Response(JSON.stringify({ success: true, document: { id: request.id, status: 'Out' } })) }
   if (request.action !== 'documentPage') throw Error('Unexpected server export: ' + request.action)
   return new Response(JSON.stringify({ success: true, form, type: form.type }), { headers: { 'Content-Type': 'application/json' } })
  }
  return fetchOriginal(url, options)
 }
}
const record = { ...form, title: 'Preview download test', url: 'https://drive.google.com/file/d/mock-file/view', updated: '2026-10-06T06:30:00Z' }
createRoot(document.getElementById('root')).render(integration
 ? <DocumentContext.Provider value={{ records: [record], permissions: { changeStatus: true }, loading: false, setFiles: () => {} }}><DocumentRecordPage title="Documents" /></DocumentContext.Provider>
 : <DocumentPage form={form} />)
window.exportPreview = async () => {
 const file = await previewPdfFile(document.querySelector('article'), form.reference)
 return { bytes: Array.from(new Uint8Array(await file.arrayBuffer())), name: file.name }
}

window.renderExport = async () => {
 const result = await window.exportPreview()
 const pdfjs = await import('pdfjs-dist')
 const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
 pdfjs.GlobalWorkerOptions.workerSrc = worker.default
 const doc = await pdfjs.getDocument({ data: new Uint8Array(result.bytes) }).promise
 const page = await doc.getPage(1)
 const viewport = page.getViewport({ scale: 4 / 3 })
 const canvas = document.createElement('canvas')
 canvas.width = viewport.width; canvas.height = viewport.height
 await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
 return canvas.toDataURL('image/png')
}
