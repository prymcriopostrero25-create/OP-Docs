import { safeBodyLink } from '../lib/richBody'
import './RichTextEditor.css'

function renderNode(node, key) {
  const attrs = node.attrs || {}
  const children = (node.content || []).map((child, index) => renderNode(child, index))
  const style = { textAlign: attrs.textAlign || undefined, lineHeight: attrs.lineSpacing || undefined, marginLeft: attrs.indent ? `${attrs.indent * 24}pt` : undefined }
  switch (node.type) {
    case 'text': return <span key={key}>{(node.marks || []).reduce((value, mark, index) => {
      const properties = mark.attrs || {}
      switch (mark.type) {
        case 'bold': return <strong key={index}>{value}</strong>
        case 'italic': return <em key={index}>{value}</em>
        case 'underline': return <u key={index}>{value}</u>
        case 'strike': return <s key={index}>{value}</s>
        case 'link': return <a key={index} href={safeBodyLink(properties.href)} target="_blank" rel="noreferrer">{value}</a>
        case 'highlight': return <mark key={index} style={{ backgroundColor: properties.color }}>{value}</mark>
        case 'textStyle': return <span key={index} style={{ color: properties.color || undefined, fontFamily: properties.fontFamily || undefined, fontSize: properties.fontSize || undefined }}>{value}</span>
        default: return value
      }
    }, node.text)}</span>
    case 'paragraph': return <p key={key} style={style}>{children.length ? children : <br />}</p>
    case 'heading': { const Heading = `h${Math.min(3, Math.max(1, attrs.level || 1))}`; return <Heading key={key} style={style}>{children}</Heading> }
    case 'hardBreak': return <br key={key} />
    case 'bulletList': return <ul key={key}>{children}</ul>
    case 'orderedList': return <ol key={key} start={attrs.start || 1}>{children}</ol>
    case 'listItem': return <li key={key}>{children}</li>
    case 'blockquote': return <blockquote key={key}>{children}</blockquote>
    case 'horizontalRule': return <hr key={key} />
    case 'pageBreak': return <div key={key} className="rich-page-break" data-page-break="true" aria-label="Page break" />
    case 'image': return /^data:image\/(png|jpeg|gif);base64,/.test(attrs.src || '') ? <img key={key} src={attrs.src} alt={attrs.alt || ''} width={attrs.width || undefined} /> : null
    case 'table': {
      const widths = (node.content?.[0]?.content || []).map(cell => cell.attrs?.colwidth?.[0] || 100)
      const total = widths.reduce((sum, width) => sum + width, 0)
      return <table key={key}><colgroup>{widths.map((width, index) => <col key={index} style={{ width: `${width / total * 100}%` }} />)}</colgroup><tbody>{children}</tbody></table>
    }
    case 'tableRow': return <tr key={key} style={attrs.height ? { height: `${attrs.height}px` } : undefined}>{children}</tr>
    case 'tableCell': return <td key={key}>{children}</td>
    case 'tableHeader': return <th key={key}>{children}</th>
    default: return <div key={key}>{children}</div>
  }
}

export default function RichBodyPreview({ value }) {
  return <div className="rich-body-content">{(value?.content || []).map(renderNode)}</div>
}
