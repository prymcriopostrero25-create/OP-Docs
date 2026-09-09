import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createHash } from 'node:crypto'
import { Buffer } from 'node:buffer'

const sample = { token: 'session', requestId: 'acceptance-request-203', number: '203', year: '2026', recipient: 'MS. FEBE KEITH JUMOC\nCurriculum and Instruction Director', subject: 'Submission of Complete U-Forms for All Campuses', date: '2026-09-09', body: 'In reference to Executive Memorandum No. 198, s. 2026, all concerned are directed to submit the complete and updated U-Forms for all campuses, together with the corresponding progress report.\n\nPlease ensure that all submitted information is accurate, complete, and properly validated.\n\nFor guidance and compliance.', signatory: 'EDGARDO H. ROSALES, JD, Ed.D.', position: 'SUC President II', logo: 'logo' }
function fixture() {
  const rows = [], notes = {}, properties = {}, log = [], destinations = []
  const shortRows = { EX_Memo: [], Trav_Ord: [], Spe_Ord: [], Auth_Travel: [], Cert_Travel: [] }
  const shortNotes = {}
  const f = { rows, properties, log, shortRows, destinations, allocations: 0, renders: 0, failRegistry: false, failCategory: false, failShortLog: false, failRender: false, authenticated: true, admin: false }
  const shortSheets = Object.fromEntries(Object.entries(shortRows).map(([name, data]) => [name, {
    getLastRow: () => data.length,
    getRange: (r, c, n = 1, w = 1) => ({
      getDisplayValues: () => Array.from({ length: n }, (_, i) => (data[r - 1 + i] || []).slice(c - 1, c - 1 + w)),
      getNotes: () => Array.from({ length: n }, (_, i) => [shortNotes[name + ':' + (r + i)] || '']),
      setNote: value => { shortNotes[name + ':' + r] = value; if (!data[r - 1]) data[r - 1] = [] },
      setValues: values => { data[r - 1] = Array.from(values[0]) },
      setValue: value => { data[r - 1][c - 1] = value },
      setRichTextValues: values => { if (f.failShortLog) throw Error('Short log failure'); data[r - 1] = Array.from(values[0], v => v.text); f.shortLink = values[0][0].url },
    }),
  }]))
  const sheet = { getLastRow: () => rows.length + 1, getRange: (r, c, n = 1, w = 1) => ({
    getDisplayValues: () => rows.slice(r - 2, r - 2 + n).map(row => row.slice(c - 1, c - 1 + w)),
    setRichTextValues(values) { if (f.failRegistry) throw Error('write failure'); rows[r - 2] = values[0].map(v => v.text) },
    getNote: () => notes[r] || '', setNote: value => { notes[r] = value },
  }) }
  const doc = { getId: () => 'actual-google-doc-id', saveAndClose() {} }
  const ctx = {
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: value => ({ setMimeType: () => JSON.parse(value) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties[key], setProperty: (key, value) => { properties[key] = value }, deleteProperty: key => { delete properties[key] } }) },
    CacheService: { getScriptCache: () => ({ get: () => 'user@jhcsc.edu.ph' }) },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (_, value) => createHash('sha256').update(value).digest(), base64Encode: value => Buffer.from(value).toString('base64'), base64EncodeWebSafe: value => Buffer.from(value).toString('base64url'), formatDate: () => '2026-09-09', base64Decode: value => value, newBlob: value => value },
    SpreadsheetApp: { openById: () => ({ getSheetByName: name => shortSheets[name], getSpreadsheetTimeZone: () => 'Asia/Shanghai' }), flush() {}, newRichTextValue: () => { const result = {}; return { setText(value) { result.text = value; return this }, setLinkUrl(url) { result.url = url; return this }, build: () => result } } },
    DocumentApp: { create() { f.allocations++; return doc }, openById: () => doc },
    DriveApp: { getFilesByName: () => ({ hasNext: () => false }), getFileById: () => ({ isTrashed: () => false, setName() {}, moveTo(folder) { destinations.push(folder.path) } }), getFolderById: id => { assert.equal(id, '1OVvmtvYjsp4WZz-RY7NkExyNIotO-Vji'); return { path: 'OP Systems', isTrashed: () => false } } },
  }
  vm.createContext(ctx)
  vm.runInContext(fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8'), ctx)
  ctx.getDocumentSession = () => f.authenticated
  ctx.canChangeDocumentStatus = () => f.admin
  ctx.isSuperAdminSession = () => false
  ctx.mainFilesSheet = () => sheet
  ctx.typeLogSheet = () => ({ getLastRow: () => log.length + 1 })
  ctx.existingTypeLogRow = (_, id) => log.find(item => item.id === id) ? 2 : 0
  ctx.writeTypeLog = (_, __, value) => { if (f.failCategory) throw Error('log failure'); log.push(value) }
  ctx.filingSubfolder = (parent, name) => ({ path: parent.path + '/' + name })
  f.render = ctx.renderExecutiveMemorandum
  ctx.renderExecutiveMemorandum = (_, data) => { if (f.failRender) throw Error('render failure'); f.renders++; f.rendered = data }
  ctx.renderCreatedDocument = (_, data) => { if (f.failRender) throw Error('render failure'); f.renders++; f.rendered = data }
  f.ctx = ctx
  return f
}

test('acceptance memorandum is saved before registry logging with uppercase subject and actual URL', () => {
  const f = fixture()
  const result = f.ctx.createExecutiveMemorandum(sample)
  assert.equal(result.success, true)
  assert.deepEqual(Array.from(f.rows[0]), ['EXECUTIVE MEMORANDUM', 'Executive Memorandum No. 203, s. 2026', 'September 9, 2026', sample.subject.toUpperCase(), 'https://drive.google.com/file/d/actual-google-doc-id/view'])
  assert.equal(result.document.status, 'Draft')
  assert.equal(f.rendered.body, sample.body)
  assert.equal(f.rendered.recipient, sample.recipient)
  assert.equal(f.log.length, 1)
})

test('same request retries once; different request and zero-padded equivalent cannot duplicate', () => {
  const f = fixture()
  assert.equal(f.ctx.createExecutiveMemorandum(sample).success, true)
  assert.equal(f.ctx.createExecutiveMemorandum(sample).success, true)
  assert.match(f.ctx.createExecutiveMemorandum({ ...sample, requestId: 'different-request-203', number: '000203' }).message, /already exists/)
  assert.equal(f.allocations, 1)
  assert.equal(f.rows.length, 1)
  assert.equal(f.log.length, 1)
})

test('registry and category failures are repairable without another document', () => {
  for (const fault of ['failRegistry', 'failCategory', 'failShortLog']) {
    const f = fixture()
    f[fault] = true
    assert.match(f.ctx.createExecutiveMemorandum(sample).message, /Document was created/)
    f[fault] = false
    assert.equal(f.ctx.createExecutiveMemorandum(sample).success, true)
    assert.equal(f.allocations, 1)
    assert.equal(f.rows.length, 1)
    assert.equal(f.log.length, 1)
    assert.equal(f.shortRows.EX_Memo.length, 2)
  }
})

test('failed generation never logs a row, and retries reuse the allocated document', () => {
  const f = fixture()
  f.failRender = true
  assert.equal(f.ctx.createExecutiveMemorandum(sample).success, false)
  assert.equal(f.rows.length, 0)
  f.failRender = false
  assert.equal(f.ctx.createExecutiveMemorandum(sample).success, true)
  assert.equal(f.allocations, 1)
})

test('required fields, invalid dates and unauthorized requests cannot allocate files', () => {
  const f = fixture()
  for (const key of ['number', 'year', 'recipient', 'subject', 'date', 'body', 'signatory', 'position']) {
    assert.equal(f.ctx.createExecutiveMemorandum({ ...sample, [key]: '' }).success, false)
  }
  for (const change of [{ date: '2026-02-30' }, { number: '0' }, { year: '2100' }]) assert.equal(f.ctx.createExecutiveMemorandum({ ...sample, ...change }).success, false)
  f.authenticated = false
  assert.equal(f.ctx.createExecutiveMemorandum(sample).success, false)
  assert.equal(f.allocations, 0)
})

test('USER status is forced to Draft; ADMIN can choose status; activity logs remain restricted', () => {
  const f = fixture()
  assert.equal(f.ctx.createExecutiveMemorandum({ ...sample, status: 'Approved' }).document.status, 'Draft')
  const g = fixture()
  g.admin = true
  assert.equal(g.ctx.createExecutiveMemorandum({ ...sample, status: 'Approved' }).document.status, 'Approved')
  assert.equal(g.ctx.doPost({ postData: { contents: JSON.stringify({ action: 'activityLogs', token: 'session' }) } }).success, false)
})

test('renderer emits A4 minimalist header, aligned FOR section and unchanged paragraphs', () => {
  const f = fixture(), paragraphs = [], headings = [], sizes = {}
  function paragraph(text) {
    const p = { text, setAlignment() { return this }, setSpacingAfter() { return this }, setSpacingBefore() { return this }, setLineSpacing() { return this }, setKeepWithNext() { return this }, editAsText() { return this }, setFontFamily() { return this }, setFontSize() { return this }, setBold(value) { this.bold = value; return this }, appendInlineImage() { return { getWidth: () => 100, getHeight: () => 100, setHeight() { return this }, setWidth() { return this } } } }
    return p
  }
  const body = { clear() {}, setPageWidth(v) { sizes.width = v; return this }, setPageHeight(v) { sizes.height = v; return this }, setMarginTop() { return this }, setMarginBottom() { return this }, setMarginLeft() { return this }, setMarginRight() { return this }, setAttributes() {}, appendParagraph(text) { const p = paragraph(text); paragraphs.push(p); return p }, appendTable(values) { sizes.info = values; const cell = { setPaddingTop() { return this }, setPaddingBottom() { return this }, editAsText: () => paragraph('') }; return { setBorderWidth() { return this }, setColumnWidth() { return this }, getCell: () => cell } } }
  const header = { clear() {}, appendParagraph(text) { headings.push(text); return paragraph(text) } }
  f.ctx.DocumentApp.Attribute = { FONT_FAMILY: 'font', FONT_SIZE: 'size' }
  f.ctx.DocumentApp.HorizontalAlignment = { CENTER: 'center' }
  f.render({ getBody: () => body, getHeader: () => header, saveAndClose() {} }, f.ctx.validateExecutiveMemorandum(sample), 'logo')
  assert.equal(sizes.width, 595.28)
  assert.equal(sizes.height, 841.89)
  assert.equal(sizes.info[0][0], 'FOR')
  assert.equal(sizes.info[2][2], 'SEPTEMBER 9, 2026')
  assert.ok(headings.includes('OFFICE OF THE PRESIDENT'))
  assert.ok(paragraphs.some(p => p.text === 'Executive Memorandum Order No. 203'))
  assert.equal(paragraphs.find(p => p.text === sample.signatory).bold, true)
  assert.equal(paragraphs.find(p => p.text === sample.position).bold, false)
  assert.ok(paragraphs.some(p => p.text === 'For guidance and compliance.' && !p.bold))
})

test('EX_Memo matches its live-sheet columns and links its internal ID to the saved file', () => {
  const f = fixture()
  assert.equal(f.ctx.createExecutiveMemorandum(sample).success, true)
  assert.deepEqual(f.shortRows.EX_Memo[1], ['EM-2026-203', 'Executive Memorandum No. 203, s. 2026', 'For', '', '', '', '', sample.subject.toUpperCase(), 'September 9, 2026', sample.body, 'Draft', ''])
  assert.equal(f.shortLink, 'https://drive.google.com/file/d/actual-google-doc-id/view')
  assert.deepEqual(f.destinations, ['OP Systems/Executive Memorandum/2026'])
})

test('all other creation types persist to their matching tab and type/year Drive folder', () => {
  for (const [type, tab] of [['Travel Order', 'Trav_Ord'], ['Special Order', 'Spe_Ord'], ['Authority to Travel Abroad', 'Auth_Travel'], ['Certificate of Travel', 'Cert_Travel']]) {
    const f = fixture()
    const request = { ...sample, type, reference: tab + '-2026-007', title: 'Official subject', content: 'Document body.\nSecond paragraph.', to: 'Travel recipient', recipient: 'Office recipient', destination: 'Pagadian', travelDates: 'September 10-11, 2026', transportation: 'Official vehicle', purpose: 'Conference', remarks: 'Approved itinerary' }
    assert.equal(f.ctx.createDocument(request).success, true)
    assert.deepEqual(f.destinations, ['OP Systems/' + type + '/2026'])
    assert.equal(f.rows[0][1], request.reference)
    assert.equal(f.shortRows[tab].length, 2)
    if (tab === 'Trav_Ord') assert.deepEqual(f.shortRows.Trav_Ord[1].slice(1), [request.reference, 'To', '', '', request.destination, request.travelDates, request.transportation, request.purpose, request.remarks])
    else if (tab === 'Spe_Ord') assert.equal(f.shortRows[tab][1][7], request.title)
    else assert.deepEqual(f.shortRows[tab][1].slice(1), ['September 9, 2026', request.content])
    assert.equal(f.ctx.createDocument(request).success, true)
    assert.equal(f.allocations, 1)
    assert.equal(f.shortRows[tab].length, 2)
  }
})

test('createdDocumentSheet accepts the live EX_Memo header row', () => {
  const f = fixture()
  f.shortRows.EX_Memo[0] = ['id', 'reference number', 'recipient label', 'name of the recipient', 'position/office', 'name of the institution or office', 'thru', 'subject', 'date', 'body', 'status', 'additional name of office']
  assert.equal(f.ctx.createdDocumentSheet('Executive Memorandum').getLastRow(), 1)
})

test('createdDocumentSheet rejects an obsolete EX_Memo column layout', () => {
  const f = fixture()
  f.shortRows.EX_Memo[0] = ['ID', 'REFERENCE NO.', 'RECIPIENT LABEL (TO OR FOR)', 'POSITION', 'NAME OF INSTITUTION', 'THRU (OPTIONAL)', 'SUBJECT', 'DATE', 'BODY', 'STATUS', 'ADDITIONAL NAME OF INSTITUTION OPTIONAL']
  assert.throws(() => f.ctx.createdDocumentSheet('Executive Memorandum'), /Check the EX_Memo sheet headers/)
})

test('incompatible short-tab headers stop creation without overwriting the sheet', () => {
  const f = fixture()
  f.shortRows.EX_Memo[0] = ['CUSTOM HEADER']
  assert.equal(f.ctx.createExecutiveMemorandum(sample).success, false)
  assert.equal(f.allocations, 0)
  assert.equal(f.shortRows.EX_Memo[0][0], 'CUSTOM HEADER')
})

const templateSample = { ...sample, templateVersion: 2, type: 'Executive Memorandum', reference: '203', recipientLabel: 'To', recipientName: 'Dr. Ana Santos', recipientPosition: 'Director', institution: 'JHCSC', thru: 'Vice President', additionalInstitution: 'Main Campus' }

test('PDF memo and special-order schemas log each field in the specified column', () => {
  for (const [type, tab] of [['Executive Memorandum', 'EX_Memo'], ['Special Order', 'Spe_Ord']]) {
    const f = fixture()
    const request = { ...templateSample, type }
    const result = f.ctx.createDocument(request)
    assert.equal(result.success, true)
    assert.equal(f.shortRows[tab][0].length, ['Executive Memorandum', 'Special Order'].includes(type) ? 12 : 11)
    assert.deepEqual(f.shortRows[tab][1].slice(2), ['Executive Memorandum', 'Special Order'].includes(type)
      ? ['To', 'Dr. Ana Santos', 'Director', 'JHCSC', 'Vice President', type === 'Executive Memorandum' ? sample.subject.toUpperCase() : sample.subject, 'September 9, 2026', sample.body, 'Draft', 'Main Campus']
      : [])
    assert.equal(f.rendered.recipientPosition, 'Director')
    assert.equal(f.rendered.thru, 'Vice President')
    assert.equal(f.rendered.additionalInstitution, 'Main Campus')
  }
})

test('authority and certificate need only body and retain the server creation date on retries', () => {
  for (const [type, tab] of [['Authority to Travel Abroad', 'Auth_Travel'], ['Certificate of Travel', 'Cert_Travel']]) {
    const f = fixture()
    const request = { token: sample.token, requestId: sample.requestId, templateVersion: 2, type, body: 'Approved travel.\nReturn as scheduled.', date: '2000-01-01' }
    assert.equal(f.ctx.createDocument(request).success, true)
    f.ctx.Utilities.formatDate = () => '2027-01-01'
    assert.equal(f.ctx.createDocument(request).success, true)
    assert.deepEqual(f.shortRows[tab][0], ['ID', 'DATE (date created)', 'BODY'])
    assert.deepEqual(f.shortRows[tab][1].slice(1), ['September 9, 2026', request.body])
    assert.deepEqual(f.destinations, ['OP Systems/' + type + '/2026'])
    assert.equal(f.allocations, 1)
  }
})

test('travel-order PDF fields require no subject/date/body and log ten columns', () => {
  const f = fixture()
  const request = { token: sample.token, requestId: sample.requestId, templateVersion: 2, type: 'Travel Order', reference: 'TO-203', recipientLabel: 'For', recipientPosition: 'Instructor', institution: 'JHCSC', place: 'Pagadian', inclusiveDate: 'September 10-11, 2026', transportation: 'College vehicle', purpose: 'Training', remarks: 'Return after training' }
  assert.equal(f.ctx.createDocument(request).success, true)
  assert.deepEqual(f.shortRows.Trav_Ord[1].slice(1), ['TO-203', 'For', 'Instructor', 'JHCSC', 'Pagadian', 'September 10-11, 2026', 'College vehicle', 'Training', 'Return after training'])
  assert.equal(f.shortRows.Trav_Ord[0].length, 10)
})

test('template validation allows optional fields and rejects unsupported recipient labels', () => {
  const f = fixture()
  assert.equal(f.ctx.createDocument({ ...templateSample, recipientLabel: 'CC' }).success, false)
  assert.equal(f.allocations, 0)
  assert.equal(f.ctx.createDocument({ ...templateSample, thru: '', additionalInstitution: '' }).success, true)
})

test('status synchronization changes only STATUS in the matching PDF-template row', () => {
  const f = fixture()
  f.ctx.createDocument(templateSample)
  const before = f.shortRows.EX_Memo[1].slice()
  f.ctx.syncCreatedDocumentStatus('Executive Memorandum', 'EM-2026-203', 'Approved')
  assert.equal(f.shortRows.EX_Memo[1][10], 'Approved')
  assert.deepEqual(f.shortRows.EX_Memo[1].filter((_, i) => i !== 10), before.filter((_, i) => i !== 10))
})

test('failed allocation recovers the reservation on retry, including a reopened form', () => {
  const f = fixture()
  const create = f.ctx.DocumentApp.create
  f.ctx.console = { error() {} }
  f.ctx.DocumentApp.create = () => { throw Error('Authorization required') }
  assert.match(f.ctx.createExecutiveMemorandum(sample).message, /checkCreateDocumentSetup/)
  assert.equal(f.rows.length, 0)
  f.ctx.DocumentApp.create = create
  assert.equal(f.ctx.createExecutiveMemorandum({ ...sample, requestId: 'reopened-form-request-203' }).success, true)
  assert.equal(f.allocations, 1)
})

test('orphaned stale reservations without any registry evidence are ignored so a new request can create safely', () => {
  const f = fixture()
  f.properties['EM-2026-203'] = JSON.stringify({ requestId: 'old-request-203', owner: 'user@jhcsc.edu.ph', fingerprint: 'stale-fingerprint', status: 'Draft' })
  const request = { ...sample, requestId: 'fresh-request-203', subject: 'Fresh subject' }
  assert.equal(f.ctx.createExecutiveMemorandum(request).success, true)
  assert.equal(f.rows.length, 1)
  assert.equal(f.log.length, 1)
})

test('lost file-ID persistence recovers a blank pending file instead of allocating twice', () => {
  const f = fixture()
  f.ctx.createExecutiveMemorandum(sample)
  const state = JSON.parse(f.properties['EM-2026-203'])
  delete state.fileId
  delete state.rendered
  f.properties['EM-2026-203'] = JSON.stringify(state)
  f.rows.length = 0
  let available = true
  f.ctx.DriveApp.getFilesByName = () => ({ hasNext: () => available, next: () => { available = false; return { isTrashed: () => false, getMimeType: () => 'application/vnd.google-apps.document', getId: () => 'actual-google-doc-id' } } })
  f.ctx.DocumentApp.openById = () => ({ getBody: () => ({ getText: () => '' }), saveAndClose() {} })
  assert.equal(f.ctx.createExecutiveMemorandum(sample).success, true)
  assert.equal(f.allocations, 1)
})

test('recovery never overwrites a matching document with existing content', () => {
  const f = fixture()
  f.ctx.console = { error() {} }
  f.ctx.DocumentApp.create = () => { throw Error('Denied') }
  f.ctx.createExecutiveMemorandum(sample)
  let available = true
  f.ctx.DriveApp.getFilesByName = () => ({ hasNext: () => available, next: () => { available = false; return { isTrashed: () => false, getMimeType: () => 'application/vnd.google-apps.document', getId: () => 'existing' } } })
  f.ctx.DocumentApp.openById = () => ({ getBody: () => ({ getText: () => 'Existing official document' }) })
  assert.match(f.ctx.createExecutiveMemorandum(sample).message, /already contains content/)
  assert.equal(f.allocations, 0)
  assert.equal(f.rows.length, 0)
})

test('running createdDocumentSheet from the editor routes to setup without accepting invalid types', () => {
  const f = fixture()
  let setupCalls = 0
  f.ctx.checkCreateDocumentSetup = () => { setupCalls++ }
  f.ctx.createdDocumentSheet()
  assert.equal(setupCalls, 1)
  assert.throws(() => f.ctx.createdDocumentSheet('Invalid type'), /Unsupported document type/)
  assert.throws(() => f.ctx.createdDocumentSheet(undefined), /Unsupported document type/)
  assert.equal(setupCalls, 1)
  assert.ok(f.ctx.createdDocumentSheet('Executive Memorandum'))
})

test('live EX_Memo headers are accepted so createDocument can save without header errors', () => {
  const f = fixture()
  f.shortRows.EX_Memo[0] = ['ID', 'REFERENCE NUMBER', 'RECIPIENT LABEL', 'NAME OF THE RECIPIENT', 'POSITION/OFFICE', 'NAME OF THE INSTITUTION OR OFFICE', 'THRU', 'SUBJECT', 'DATE', 'BODY', 'STATUS', 'ADDITIONAL NAME OF OFFICE']
  assert.ok(f.ctx.createdDocumentSheet('Executive Memorandum'))
})

test('live Spe_Ord headers are accepted so Special Order can save without header errors', () => {
  const f = fixture()
  f.shortRows.Spe_Ord[0] = ['ID', 'REFERENCE NUMBER', 'RECIPIENT LABEL (To or For)', 'NAME OF THE RECIPIENT', 'POSITION/OFFICE', 'NAME OF INSTITUTION/OFFICE', 'THRU (Optional)', 'SUBJECT', 'DATE', 'BODY', 'STATUS', 'ADDITIONAL NAME OF INSTITUTION (OPTIONAL)']
  assert.ok(f.ctx.createdDocumentSheet('Special Order'))
})

test('reopened form resumes a failed render with its existing file', () => {
  const f = fixture()
  f.failRender = true
  assert.equal(f.ctx.createExecutiveMemorandum(sample).success, false)
  f.failRender = false
  assert.equal(f.ctx.createExecutiveMemorandum({ ...sample, requestId: 'new-form-after-render-failure' }).success, true)
  assert.equal(f.allocations, 1)
  assert.equal(f.rows.length, 1)
})

test('reopened form repairs partially logged creation without reporting a duplicate', () => {
  const f = fixture()
  f.failShortLog = true
  assert.equal(f.ctx.createExecutiveMemorandum(sample).success, false)
  f.failShortLog = false
  assert.equal(f.ctx.createExecutiveMemorandum({ ...sample, requestId: 'new-form-after-logging-failure' }).success, true)
  assert.equal(f.allocations, 1)
  assert.equal(f.rows.length, 1)
  assert.equal(f.shortRows.EX_Memo.length, 2)
})

test('unpublished failed file accepts corrected fields but completed documents stay protected', () => {
  const f = fixture()
  f.failRender = true
  f.ctx.createExecutiveMemorandum(sample)
  f.failRender = false
  const corrected = { ...sample, subject: 'Corrected subject', requestId: 'corrected-unfinished-request' }
  assert.equal(f.ctx.createExecutiveMemorandum(corrected).success, true)
  assert.equal(f.rows[0][3], 'CORRECTED SUBJECT')
  assert.equal(f.allocations, 1)
  assert.match(f.ctx.createExecutiveMemorandum({ ...corrected, requestId: 'new-completed-document-request' }).message, /already exists/)
})
