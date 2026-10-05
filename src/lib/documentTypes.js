export const documentTypes = [
  { value: 'Executive Memorandum', label: 'Executive Memorandum', short: 'EM' },
  { value: 'Travel Order', label: 'Travel Order', short: 'TO' },
  { value: 'Certificate of Travel', label: 'Travel Certificate', short: 'CTA' },
  { value: 'Authority to Travel Abroad', label: 'Travel Authority', short: 'TAA' },
  { value: 'Special Order', label: 'Special Order', short: 'SO' },
]
export const documentTypeLabel = value => documentTypes.find(type => type.value === value)?.label || value
