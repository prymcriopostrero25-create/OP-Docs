export function filterRecords(records, { type, query = '', status = 'All statuses', start = '', end = '', sort = 'newest' }) {
  const search = query.trim().toLowerCase()
  return records.filter(record => {
    const date = new Date(record.updated || record.date)
    return (!type || record.type === type) && (status === 'All statuses' || record.status === status)
      && (!search || [record.title, record.reference, record.type, record.owner, record.status].some(value => String(value || '').toLowerCase().includes(search)))
      && (!start || date >= new Date(`${start}T00:00:00`)) && (!end || date <= new Date(`${end}T23:59:59.999`))
  // Sort by the document date so status updates keep the row in place.
  }).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : ((Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)) * (sort === 'oldest' ? -1 : 1))
}
export function recordsCsv(records) {
  const cell = value => '"' + String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"'
  return '\uFEFF' + [['Reference', 'Document', 'Type', 'Owner', 'Date', 'Status'], ...records.map(r => [r.reference, r.title, r.type, r.owner, r.updated, r.status])].map(row => row.map(cell).join(',')).join('\r\n')
}
export function downloadFile(blob, name) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
