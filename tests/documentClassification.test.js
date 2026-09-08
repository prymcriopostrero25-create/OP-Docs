import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyDocument } from '../src/lib/documentClassification.js'

test('recognizes all five reference filename conventions', () => {
  const cases = [
    ['Executive-Memo-No.195s.2026. ONLINE MEETING.pdf', 'Executive Memorandum'],
    ['SO No. 051, s. 2026.PATALINGHUG. VPRIDE.pdf', 'Special Order'],
    ['TO104.pdf', 'Travel Order'],
    ['Authority to Travel Abroad.Barnido.2.pdf', 'Authority to Travel Abroad'],
    ['Certificate to Travel Abroad.Barnido.2.pdf', 'Certificate of Travel'],
  ]
  for (const [name, type] of cases) assert.equal(classifyDocument(name).type, type)
})

test('uses document text for a travel order year, not the upload year', () => {
  assert.equal(classifyDocument('TO104.pdf', 'September 2, 2025 TRAVEL ORDER NO. 104 Inclusive Dates: September 4, 2025').year, '2025')
})

test('series years handle future end dates and ambiguous cited regulation years', () => {
  const result = classifyDocument('scan.pdf', 'SPECIAL ORDER NO. 051 Series of 2026. Effective until 2028. NBC s. 2013.')
  // Multiple series references remain ambiguous without the reference filename.
  assert.equal(result.year, '')
  assert.equal(classifyDocument('SO No. 051, s. 2026.pdf', 'SPECIAL ORDER Series of 2026. Effective until 2028.').year, '2026')
})

test('combined travel forms are distinguished by filename, otherwise require selection', () => {
  const text = 'TRAVEL CERTIFICATE Issued June 17, 2026 AUTHORITY TO TRAVEL ABROAD Travel July 12, 2026'
  assert.equal(classifyDocument('Authority to Travel Abroad.Barnido.2.pdf', text).type, 'Authority to Travel Abroad')
  assert.equal(classifyDocument('Certificate to Travel Abroad.Barnido.2.pdf', text).type, 'Certificate of Travel')
  assert.equal(classifyDocument('scan.pdf', text).type, '')
})

test('unknown scans, ordinary TO address labels, and conflicting years are not guessed', () => {
  assert.equal(classifyDocument('scan.pdf').needsReview, true)
  assert.equal(classifyDocument('scan.pdf', 'TO: Personnel. Please attend.').type, '')
  assert.equal(classifyDocument('TO2025.pdf', 'TRAVEL ORDER Series of 2026').year, '2026')
  assert.equal(classifyDocument('Travel Order 2025.pdf', 'TRAVEL ORDER Series of 2026').year, '')
})
