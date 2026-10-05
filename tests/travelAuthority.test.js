import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { authorityBody } from '../src/lib/travelAuthority.js'

test('authority fields and wording agree between form and backend', () => {
  const context = vm.createContext({})
  vm.runInContext(fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8'), context)
  const form = { authorityStructured: true, body: 'Generated wording', recipientName: 'Maria Santos', recipientPosition: 'Instructor', salaryGrade: '18', employmentStatus: 'Permanent', travelFrom: '2026-10-10', travelUntil: '2026-10-15', purpose: 'Personal leave', place: 'Japan', travelClassification: 'PERSONAL LEAVE', date: '2026-10-05', signatory: 'President', signatoryPosition: 'SUC President II', cc: 'HRMO' }
  const data = context.validateTemplateDocument(form, 'Authority to Travel Abroad')
  assert.equal(data.recipientPosition, 'Instructor')
  assert.equal(data.issueDate, '2026-10-05')
  assert.equal(context.travelAuthorityBody(data), authorityBody(form))
  assert.throws(() => context.validateTemplateDocument({ ...form, travelUntil: '2026-10-01' }, 'Authority to Travel Abroad'), /end date/)
})

test('PDF renderer includes authority tables, letterhead, body, signature and footer', () => {
  const tables = [], paragraphs = []
  let closed = false, insertedLogo
  const signatureWidths = []
  const signatureLines = []
  const image = { getHeight: () => 100, getWidth: () => 100, setHeight() { return image }, setWidth() { return image } }
  const element = new Proxy({}, { get(_, key) {
    if (key === 'setColumnWidth') return (column, value) => { signatureWidths.push([column, value]); return element }
    if (key === 'setText' || key === 'appendParagraph') return text => { signatureLines.push(text); return element }
    if (key === 'getNumChildren') return () => 1
    if (key === 'appendInlineImage') return logo => { insertedLogo = logo; return image }
    return () => element
  } })
  const section = { clear() {}, appendParagraph(text) { paragraphs.push(text); return element }, appendTable(rows) { tables.push(rows); return element } }
  for (const key of ['setPageWidth', 'setPageHeight', 'setMarginLeft', 'setMarginRight', 'setMarginTop', 'setMarginBottom', 'setAttributes']) section[key] = () => section
  const context = vm.createContext({ DocumentApp: { Attribute: {}, HorizontalAlignment: { CENTER: 'center', JUSTIFY: 'justify' } } })
  vm.runInContext(fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8'), context)
  const data = { authorityStructured: true, recipientName: 'Maria Santos', place: 'Japan', salaryGrade: '18', employmentStatus: 'permanent', travelClassification: 'personal leave', inclusiveDate: 'October 10, 2026', issueDate: '2026-10-05', signatory: 'Certifying Officer', position: 'President', cc: 'HRMO' }
  context.renderCreatedDocument({ getBody: () => section, getHeader: () => null, getFooter: () => section, saveAndClose() { closed = true } }, data, 'Authority to Travel Abroad', 'college-logo')
  assert.equal(insertedLogo, 'college-logo')
  assert.ok(tables.some(rows => rows[0][0] === 'AUTHORITY TO TRAVEL ABROAD'))
  assert.ok(tables.some(rows => rows[0][1] === 'Maria Santos' && rows[6][1] === 'Japan'))
  assert.ok(paragraphs.some(text => text.includes('Issued this 5 day of October, 2026')))
  assert.ok(signatureLines.includes('Certifying Officer'))
  assert.ok(signatureLines.includes('President'))
  assert.ok(paragraphs.includes('cc: HRMO'))
  assert.ok(tables.some(rows => rows[0][1] === 'Authority to Travel Abroad | Page 1 of 1'))
  assert.ok(closed)
  assert.ok(signatureWidths.some(([column, value]) => column === 0 && value === 491.94 * 0.49))
  assert.ok(signatureLines.includes('APPROVED:'))
  assert.equal(data.authorityLayoutVersion, 2)
})


test('authority saves every input in its corresponding A:P column and updates the same row', () => {
  const context = vm.createContext({})
  vm.runInContext(fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8'), context)
  context.SpreadsheetApp = { newRichTextValue: () => {
    let text
    const builder = { setText(value) { text = value; return builder }, setLinkUrl() { return builder }, build() { return text } }
    return builder
  } }
  const data = { body: 'Authorization body', issueDate: '2026-10-05', recipientName: 'Maria Santos', recipientPosition: 'Instructor', salaryGrade: '18', employmentStatus: 'Permanent', travelFrom: '2026-11-16', travelUntil: '2026-11-20', purpose: 'Personal leave', place: 'Thailand', travelClassification: 'Personal travel', signatory: 'Approving officer', signatoryPosition: 'President', cc: 'HRMO' }
  let saved
  const sheet = { getRange(row, column, height, width) { return { setNote() {}, setRichTextValues(values) { saved = { row, width, values: values[0] } } } } }
  const record = { type: 'Authority to Travel Abroad', id: 'ATA-001', date: 'October 5, 2026', url: 'https://example.com/doc' }
  const expected = ['internal-id', record.date, data.body, data.issueDate, data.recipientName, data.recipientPosition, data.salaryGrade, data.employmentStatus, data.travelFrom, data.travelUntil, data.purpose, data.place, data.travelClassification, data.signatory, data.signatoryPosition, data.cc]
  context.logCreatedDocument(sheet, record, data, 'internal-id', { lastRow: 1, rows: [], notes: [] })
  assert.equal(saved.width, 16)
  assert.deepEqual(Array.from(saved.values), expected)
  context.logCreatedDocument(sheet, record, { ...data, place: 'Japan' }, 'internal-id', { lastRow: 4, rows: [['internal-id']], notes: [['']] })
  assert.equal(saved.row, 2)
  assert.equal(saved.values[11], 'Japan')
})

test('authority accepts the screenshot headers and extends only an empty legacy header tail', () => {
  const context = vm.createContext({})
  vm.runInContext(fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8'), context)
  const expected = Array.from(vm.runInContext('CREATED_DOCUMENT_HEADERS.Auth_Travel', context))
  let headers = [...expected], writes = 0
  const sheet = { getLastRow: () => 2, getRange(row, col, height, width) { return {
    getDisplayValues: () => [headers.slice(col - 1, col - 1 + width)],
    setValues(values) { writes++; headers.splice(col - 1, width, ...values[0]) },
  } } }
  context.appSpreadsheet = () => ({ getSheetByName: () => sheet })
  assert.equal(context.createdDocumentSheet('Authority to Travel Abroad'), sheet)
  assert.equal(writes, 0)
  headers = [...expected.slice(0, 3), ...Array(13).fill('')]
  context.createdDocumentSheet('Authority to Travel Abroad')
  assert.deepEqual(headers, expected)
  assert.equal(writes, 1)
  headers[5] = 'Wrong column'
  assert.throws(() => context.createdDocumentSheet('Authority to Travel Abroad'), /headers/)
  assert.equal(writes, 1)
})

test('existing authority wording is corrected before PDF export and only once', () => {
  let metadata = { type: 'Authority to Travel Abroad', form: { authorityStructured: true, authorityLayoutVersion: 1, body: 'This is to CERTIFY that, where applicable to personal travel', place: 'Thailand', inclusiveDate: 'November 16, 2026', issueDate: '2026-10-05' } }
  const events = []
  const cell = { getNote: () => JSON.stringify(metadata), setNote: value => { metadata = JSON.parse(value) } }
  const context = vm.createContext({
    DriveApp: { getFileById: () => ({ isTrashed: () => false, getMimeType: () => 'application/vnd.google-apps.document', getId: () => 'doc', getName: () => 'Authority' }) },
    DocumentApp: { openById: () => ({ getBody: () => ({ replaceText(from, to) { events.push('replace'); assert.ok(from.includes('CERTIFY')); assert.ok(to.includes('AUTHORIZED')) } }), saveAndClose() { events.push('save') } }) },
    Utilities: { base64Encode: () => 'AQI=' },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: { flush() {} },
  })
  vm.runInContext(fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8'), context)
  context.getDocumentSession = () => true
  context.jsonResponse = value => value
  context.mainFilesSheet = () => ({ getLastRow: () => 2, getRange: (row, col, count, width) => width === 5 ? { getDisplayValues: () => [['Created', 'ATA-1', '', '', 'https://drive.google.com/file/d/doc/view']] } : cell })
  context.preparedDocumentPdf = () => { events.push('export'); return { getBytes: () => [] } }
  const result = context.prepareDocumentPreview({ id: 'ATA-1', token: 'session' })
  assert.equal(result.success, true)
  assert.equal(result.authorityLayoutVersion, 2)
  assert.ok(metadata.form.body.includes('AUTHORIZED'))
  assert.deepEqual(events, ['replace', 'save', 'export'])
  context.prepareDocumentPreview({ id: 'ATA-1', token: 'session' })
  assert.deepEqual(events, ['replace', 'save', 'export', 'export'])
})
