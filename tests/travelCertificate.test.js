import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { certificateBody, certificateTravelDates } from '../src/lib/travelCertificate.js'

test('certificate wording includes the entered employee, travel, and issue details', () => {
  const form = { recipientName: 'Maria Santos', salaryGrade: '18', employmentStatus: 'permanent', place: 'Japan', travelFrom: '2026-10-10', travelUntil: '2026-10-15', travelClassification: 'personal leave', date: '2026-10-05' }
  const body = certificateBody(form)
  for (const value of ['Maria Santos', 'Salary Grade 18', 'permanent', 'Japan', 'October 10, 2026 to October 15, 2026', 'personal leave', 'October 5, 2026']) assert.ok(body.includes(value), value)
  assert.ok(body.includes('will not utilize government funds'))
  assert.ok(!body.includes('['))
})

test('one-day travel prints one date and edited dates supersede an old range', () => {
  assert.equal(certificateTravelDates({ travelFrom: '2026-10-10', travelUntil: '2026-10-10', inclusiveDate: 'Old range' }), 'October 10, 2026')
  assert.equal(certificateTravelDates({ inclusiveDate: 'Legacy range' }), 'Legacy range')
})

test('backend retains certificate fields and writes all fourteen sheet columns', () => {
  const context = vm.createContext({ Utilities: { formatDate: () => 'October 10, 2026' }, Session: { getScriptTimeZone: () => 'Asia/Manila' } })
  vm.runInContext(fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8'), context)
  const request = { certificateStructured: true, body: 'Certificate body', recipientName: 'Maria Santos', salaryGrade: '18', employmentStatus: 'permanent', place: 'Japan', travelFrom: '2026-10-10', travelUntil: '2026-10-15', travelClassification: 'personal leave', date: '2026-10-05', signatory: 'Certifying Officer', signatoryPosition: 'President', cc: 'HRMO' }
  const data = context.validateTemplateDocument(request, 'Certificate of Travel')
  assert.equal(data.recipientName, 'Maria Santos')
  assert.equal(data.place, 'Japan')
  assert.equal(data.issueDate, '2026-10-05')
  assert.equal(data.signatory, 'Certifying Officer')
  assert.throws(() => context.validateTemplateDocument({ ...request, travelUntil: '2026-10-01' }, 'Certificate of Travel'), /end date/)
  let cells
  context.SpreadsheetApp = { newRichTextValue: () => { let value; const builder = { setText(text) { value = text; return builder }, setLinkUrl() { return builder }, build() { return value } }; return builder } }
  const sheet = { getRange(row, col, rows, columns) { return { setNote() {}, setRichTextValues(values) { assert.equal(columns, 14); cells = values[0] } } } }
  context.logCreatedDocument(sheet, { type: 'Certificate of Travel', id: 'CTA-1', date: 'October 6, 2026', url: 'https://example.com/doc' }, data, 'internal-id', { lastRow: 1, rows: [], notes: [] })
  assert.equal(cells[3], '2026-10-05')
  assert.equal(cells[4], 'Maria Santos')
  assert.equal(cells[9], 'Japan')
  assert.equal(cells[11], 'Certifying Officer')
  assert.equal(cells[13], 'HRMO')
})

test('PDF renderer includes certificate tables, letterhead, body, signature and footer', () => {
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
  const data = { certificateStructured: true, recipientName: 'Maria Santos', place: 'Japan', salaryGrade: '18', employmentStatus: 'permanent', travelClassification: 'personal leave', inclusiveDate: 'October 10, 2026', issueDate: '2026-10-05', signatory: 'Certifying Officer', position: 'President', cc: 'HRMO' }
  context.renderCreatedDocument({ getBody: () => section, getHeader: () => null, getFooter: () => section, saveAndClose() { closed = true } }, data, 'Certificate of Travel', 'college-logo')
  assert.equal(insertedLogo, 'college-logo')
  assert.ok(tables.some(rows => rows[0][0] === 'TRAVEL CERTIFICATE'))
  assert.ok(tables.some(rows => rows[0][1] === 'Maria Santos' && rows[1][1] === 'Japan'))
  assert.ok(paragraphs.some(text => text.includes('issued on October 5, 2026')))
  assert.ok(signatureLines.includes('Certifying Officer'))
  assert.ok(signatureLines.includes('President'))
  assert.ok(paragraphs.includes('cc: HRMO'))
  assert.ok(tables.some(rows => rows[0][1] === 'Travel Certificate | Page 1 of 1'))
  assert.ok(closed)
  assert.ok(signatureWidths.some(([column, value]) => column === 0 && value === 491.94 * 0.49))
  assert.ok(signatureLines.includes('CERTIFIED BY:'))
  assert.equal(data.certificateLayoutVersion, 3)
})

test('download upgrades an older saved certificate before exporting it', () => {
  let metadata = { type: 'Certificate of Travel', form: { recipientName: 'Maria Santos', place: 'Japan', certificateLayoutVersion: 1 } }
  const events = []
  const cell = { getNote: () => JSON.stringify(metadata), setNote: value => { metadata = JSON.parse(value) } }
  const context = vm.createContext({
    DriveApp: { getFileById: () => ({ isTrashed: () => false, getMimeType: () => 'application/vnd.google-apps.document', getId: () => 'doc', getName: () => 'Certificate' }) },
    DocumentApp: { openById: () => ({}) },
    Utilities: { base64Decode: () => [], newBlob: () => 'logo', base64Encode: () => 'AQI=' },
    LockService: { getScriptLock: () => ({ waitLock() { events.push('lock') }, releaseLock() {} }) },
    SpreadsheetApp: { flush() {} },
  })
  vm.runInContext(fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8'), context)
  context.getDocumentSession = () => true
  context.jsonResponse = value => value
  cell.createTextFinder = () => ({ matchEntireCell() { return this }, matchCase() { return this }, useRegularExpression() { return this }, findNext: () => ({ getRow: () => 2 }) })
  context.mainFilesSheet = () => ({ getLastRow: () => 2, getRange: (row, col, count, width) => width === 5 ? { getDisplayValues: () => [['Created', 'CTA-1', '', '', 'https://drive.google.com/file/d/doc/view']] } : cell })
  context.renderTravelCertificate = (doc, form) => { events.push('render'); assert.equal(form.recipientName, 'Maria Santos'); form.certificateLayoutVersion = 3 }
  context.preparedDocumentPdf = () => { events.push('export'); return { getBytes: () => [] } }
  const result = context.prepareDocumentPreview({ id: 'CTA-1', token: 'session', logo: 'base64' })
  assert.equal(result.success, true)
  assert.equal(result.certificateLayoutVersion, 3)
  assert.deepEqual(events, ['lock', 'render', 'export'])
  context.prepareDocumentPreview({ id: 'CTA-1', token: 'session', logo: 'base64' })
  assert.deepEqual(events, ['lock', 'render', 'export', 'export'])
})
