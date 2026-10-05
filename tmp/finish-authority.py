from pathlib import Path
body="""export function authorityBody(form) {
  const value = form.issueDate || form.date
  const date = /^\\d{4}-\\d{2}-\\d{2}$/.test(value || '') ? value.split('-').map(Number) : null
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return [
    `This refers to the proposed travel to ${form.place || '[DESTINATION]'} on ${certificateTravelDates(form)}. Relative to the aforementioned travel, please be informed that the request is hereby APPROVED as ${form.travelClassification || '[PERSONAL LEAVE / OFFICIAL TRAVEL / OTHER CLASSIFICATION]'} for the period stated above only.`,
    'This is to CERTIFY that, where applicable to personal travel, the personnel concerned shall not represent the institution and shall not utilize government funds for the approved travel.',
    `Issued this ${date ? date[2] : '[DAY]'} day of ${date ? months[date[1] - 1] : '[MONTH]'}, ${date ? date[0] : '[YEAR]'} at the JHCSC Main Campus, Mati, San Miguel, Zamboanga del Sur, for whatever legal purpose it may serve.`,
  ].join('\\n\\n')
}
"""
Path('src/lib/travelAuthority.js').write_text("import { certificateTravelDates } from './travelCertificate.js'\n\n"+body)
p=Path('google-apps-script/Code.gs');s=p.read_text();server=body.replace('export function authorityBody(form)', 'function travelAuthorityBody(form)').replace('certificateTravelDates(form)', "(form.inclusiveDate || '[TRAVEL DATE/S]')")
s=s.replace('function renderTravelAuthority(',server+'\nfunction renderTravelAuthority(')
p.write_text(s)
s=Path('src/components/previews/PreviewCertificateOfTravel.jsx').read_text().replace("import { certificateTravelDates, certificateBody }", "import { certificateTravelDates }")
s="import { authorityBody } from '../../lib/travelAuthority'\n"+s
s=s.replace('PreviewCertificateOfTravel', 'PreviewTravelAuthority').replace("form.certificateStructured ? certificateBody(form) : form.body || form.content || certificateBody(form)", "form.authorityStructured ? authorityBody(form) : form.body || form.content || authorityBody(form)")
s=s.replace('Travel Certificate', 'Authority to Travel Abroad').replace('TRAVEL CERTIFICATE', 'AUTHORITY TO TRAVEL ABROAD').replace('CERTIFICATION', 'AUTHORIZATION').replace('CERTIFIED BY:', 'APPROVED:').replace('[NAME OF CERTIFYING AUTHORITY]', '[NAME OF APPROVING AUTHORITY]').replace('[HRMO / Records / Other concerned office]', 'HRMO | Records/File')
s=s.replace("[[ 'Employee', employee ], [ 'Destination', destination ], [ 'Travel date/s', travelDates ]]", "[[ \"Employee s name\", employee ], ['Position', form.recipientPosition || '[POSITION / DESIGNATION]'], ['Salary grade', form.salaryGrade || '[SG]'], ['Status', form.employmentStatus || '[PERMANENT / TEMPORARY / COS / OTHER]'], ['Travel date/s', travelDates], ['Purpose', form.purpose || '[PERSONAL LEAVE / OFFICIAL PURPOSE]'], ['Destination', destination]]")
s=s.replace('text-[19px]', 'text-[18px]')
Path('src/components/previews/PreviewTravelAuthority.jsx').write_text(s)
# Use the issue date when editing, independently of the automatic registry date.
p=Path('src/components/CreateDocument.jsx');s=p.read_text().replace("values.type === 'Certificate of Travel' && values.issueDate", "['Certificate of Travel', 'Authority to Travel Abroad'].includes(values.type) && values.issueDate");p.write_text(s)
