from pathlib import Path
s=Path('tests/travelCertificate.test.js').read_text();start=s.index("test('PDF renderer");end=s.index("test('download upgrades",start);s=s[start:end].replace('certificate tables','authority tables').replace("certificateStructured: true", "authorityStructured: true").replace("'Certificate of Travel', 'college-logo'", "'Authority to Travel Abroad', 'college-logo'").replace("'TRAVEL CERTIFICATE'", "'AUTHORITY TO TRAVEL ABROAD'").replace("rows[1][1] === 'Japan'", "rows[6][1] === 'Japan'").replace("issued on October 5, 2026", "Issued this 5 day of October, 2026").replace("Travel Certificate | Page 1 of 1", "Authority to Travel Abroad | Page 1 of 1").replace('CERTIFIED BY:', 'APPROVED:').replace('data.certificateLayoutVersion, 3', 'data.authorityLayoutVersion, 1')
header="import { test } from 'node:test'\nimport assert from 'node:assert/strict'\nimport fs from 'node:fs'\nimport vm from 'node:vm'\nimport { authorityBody } from '../src/lib/travelAuthority.js'\n\n"
extra="""test('authority fields and wording agree between form and backend', () => {
  const context = vm.createContext({})
  vm.runInContext(fs.readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8'), context)
  const form = { authorityStructured: true, body: 'Generated wording', recipientName: 'Maria Santos', recipientPosition: 'Instructor', salaryGrade: '18', employmentStatus: 'Permanent', travelFrom: '2026-10-10', travelUntil: '2026-10-15', purpose: 'Personal leave', place: 'Japan', travelClassification: 'PERSONAL LEAVE', date: '2026-10-05', signatory: 'President', signatoryPosition: 'SUC President II', cc: 'HRMO' }
  const data = context.validateTemplateDocument(form, 'Authority to Travel Abroad')
  assert.equal(data.recipientPosition, 'Instructor')
  assert.equal(data.issueDate, '2026-10-05')
  assert.equal(context.travelAuthorityBody(data), authorityBody(form))
  assert.throws(() => context.validateTemplateDocument({ ...form, travelUntil: '2026-10-01' }, 'Authority to Travel Abroad'), /end date/)
})

"""
Path('tests/travelAuthority.test.js').write_text(header+extra+s)
