import { createContext } from 'react'

export const DocumentContext = createContext(null)

export const initialRecords = [
  { title: 'Executive Memorandum No. 042, s. 2026', reference: 'OP-EM-2026-042', type: 'Executive Memorandum', owner: 'Office of the President', updated: 'Jul 28, 2026', status: 'For signature' },
  { title: 'Travel Order No. 118, s. 2026', reference: 'OP-TO-2026-118', type: 'Travel Order', owner: 'Administrative Office', updated: 'Jul 27, 2026', status: 'Approved' },
  { title: 'Certification of Travel Abroad', reference: 'OP-CTA-2026-016', type: 'Certification', owner: 'International Affairs', updated: 'Jul 26, 2026', status: 'In review' },
  { title: 'Travel Authority Abroad No. 021', reference: 'OP-TAA-2026-021', type: 'Travel Authority', owner: 'Office of the President', updated: 'Jul 25, 2026', status: 'Filed' },
  { title: 'Special Order No. 091, s. 2026', reference: 'OP-SO-2026-091', type: 'Special Order', owner: 'Human Resource Office', updated: 'Jul 24, 2026', status: 'For signature' },
  { title: 'Executive Memorandum No. 041, s. 2026', reference: 'OP-EM-2026-041', type: 'Executive Memorandum', owner: 'Office of the President', updated: 'Jul 23, 2026', status: 'Approved' },
  { title: 'Travel Order No. 117, s. 2026', reference: 'OP-TO-2026-117', type: 'Travel Order', owner: 'Finance Office', updated: 'Jul 22, 2026', status: 'Draft' },
  { title: 'Special Order No. 090, s. 2026', reference: 'OP-SO-2026-090', type: 'Special Order', owner: 'Human Resource Office', updated: 'Jul 21, 2026', status: 'In review' },
]
