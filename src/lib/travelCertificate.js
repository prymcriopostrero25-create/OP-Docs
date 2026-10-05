export function certificateDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return value || ''
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export function certificateTravelDates(form) {
  if (!form.travelFrom) return form.inclusiveDate || '[TRAVEL DATE/S]'
  return form.travelFrom === form.travelUntil ? certificateDate(form.travelFrom) : [certificateDate(form.travelFrom), certificateDate(form.travelUntil)].filter(Boolean).join(' to ')
}

export function certificateBody(form) {
  return [
    `This is to certify that the requested travel abroad to ${form.place || '[DESTINATION]'}, from ${certificateTravelDates(form)}, by ${form.recipientName || form.recipient || '[EMPLOYEE NAME]'} (Salary Grade ${form.salaryGrade || '[SALARY GRADE]'}), a ${form.employmentStatus || '[EMPLOYMENT STATUS]'} employee of J.H. Cerilles State College, is considered ${form.travelClassification || '[PERSONAL LEAVE / OTHER APPROVED CLASSIFICATION]'} only. The personnel concerned will not represent the institution and will not utilize government funds for the said personal travel.`,
    `This certificate is issued on ${certificateDate(form.issueDate || form.date) || '[DATE ISSUED]'}, at the JHCSC Main Campus, Mati, San Miguel, Zamboanga del Sur, for whatever legal purpose it may serve.`,
  ].join('\n\n')
}
