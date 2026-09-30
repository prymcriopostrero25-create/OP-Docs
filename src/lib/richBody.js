export const plainBodyDocument = text => ({ type: 'doc', content: String(text || '').split(/\r?\n/).map(line => ({ type: 'paragraph', ...(line ? { content: [{ type: 'text', text: line }] } : {}) })) })

export function richBodyText(node) {
  if (!node) return ''
  if (node.type === 'text') return node.text || ''
  if (node.type === 'hardBreak') return '\n'
  if (node.type === 'image') return '[Image]'
  const separator = ['doc', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'table', 'tableRow', 'tableCell', 'tableHeader'].includes(node.type) ? '\n' : ''
  return (node.content || []).map(richBodyText).join(separator)
}

export const safeBodyLink = value => /^(https?:\/\/|mailto:)/i.test(value || '') ? value : undefined
