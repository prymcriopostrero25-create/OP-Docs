export const filingTypes = ['Executive Memorandum', 'Special Order', 'Travel Order', 'Authority to Travel Abroad', 'Certificate of Travel']

const patterns = [
  /\bexecutive\s+memo(?:randum)?\b|\bEM\s*(?:NO\s*)?\d/i,
  /\bspecial\s+order\b|\bSO\s*(?:NO\s*)?\d/i,
  /\btravel\s+order\b|\bTO\s*(?:NO\s*)?\d/i,
  /\bauthority\s+to\s+travel\s+abroad\b|\btravel\s+authority(?:\s+abroad)?\b|\b(?:ATA|TAA)\s*\d/i,
  /\btravel\s+certificate\b|\bcertificat(?:e|ion)\s+(?:of|to|for)\s+travel\b|\bCTA\s*\d/i,
]

function normalize(value) { return value.replace(/[_.-]+/g, ' ').replace(/\s+/g, ' ').trim() }
function typesIn(text) { return filingTypes.filter((_, index) => patterns[index].test(normalize(text))) }
function uniqueYear(text) {
  const years = [...new Set(text.match(/\b(?:19|20)\d{2}\b/g) || [])]
  return years.length === 1 ? years[0] : ''
}

// Filename labels distinguish the reference PDFs that contain both travel forms.
// Ambiguous content requires an explicit choice; a body reference is not proof of type.
export function classifyDocument(name, text = '') {
  const filenameTypes = typesIn(name)
  const contentTypes = typesIn(text)
  const type = filenameTypes.length === 1 ? filenameTypes[0] : contentTypes.length === 1 ? contentTypes[0] : ''
  const seriesYears = [...text.matchAll(/(?:series\s+of|\bs\s*\.)\s*((?:19|20)\d{2})\b/gi)].map(match => match[1])
  const filenameYear = uniqueYear(normalize(name))
  const seriesYear = new Set(seriesYears).size === 1 ? seriesYears[0] : ''
  const year = filenameYear && seriesYear && filenameYear !== seriesYear ? '' : filenameYear || seriesYear || uniqueYear(text)
  return { type, year, typeSource: filenameTypes.length === 1 ? 'filename' : type ? 'PDF text' : '', needsReview: !type || !year }
}
