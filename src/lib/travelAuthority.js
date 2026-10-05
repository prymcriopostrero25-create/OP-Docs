import { certificateTravelDates } from './travelCertificate.js'

export function authorityBody(form) {
  const value = form.issueDate || form.date
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').map(Number) : null
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return [
    `This refers to the proposed travel to ${form.place || '[DESTINATION]'} on ${certificateTravelDates(form)}. Relative to the aforementioned travel, please be informed that the request is hereby APPROVED as ${form.travelClassification || '[PERSONAL LEAVE / OFFICIAL TRAVEL / OTHER CLASSIFICATION]'} for the period stated above only.`,
    'This is to AUTHORIZED that, where applicable to personal travel, the personnel concerned shall not represent the institution and shall not utilize government funds for the approved travel.',
    `Issued this ${date ? date[2] : '[DAY]'} day of ${date ? months[date[1] - 1] : '[MONTH]'}, ${date ? date[0] : '[YEAR]'} at the JHCSC Main Campus, Mati, San Miguel, Zamboanga del Sur, for whatever legal purpose it may serve.`,
  ].join('\n\n')
}
