import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { Extension, Node } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle, Color, FontFamily, FontSize } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import { TableRowResize } from '../lib/tableRowResize'
import { TableKit } from '@tiptap/extension-table'
import { plainBodyDocument, richBodyText, safeBodyLink } from '../lib/richBody'
import './RichTextEditor.css'

const PageBreak = Node.create({
  name: 'pageBreak', group: 'block', atom: true,
  parseHTML: () => [{ tag: 'div[data-page-break]' }],
  renderHTML: () => ['div', { 'data-page-break': 'true', class: 'rich-page-break' }],
})
const ParagraphLayout = Extension.create({
  name: 'paragraphLayout',
  // Table shortcuts run first so Tab still moves between cells.
  priority: 50,
  addKeyboardShortcuts() {
    const indent = amount => {
      if (!this.editor.isEditable) return false
      if (this.editor.isActive('listItem')) {
        if (amount > 0) this.editor.commands.sinkListItem('listItem')
        else this.editor.commands.liftListItem('listItem')
        return true
      }
      const type = this.editor.isActive('heading') ? 'heading' : 'paragraph'
      if (!this.editor.isActive(type)) return false
      const current = this.editor.getAttributes(type).firstLineIndent || 0
      this.editor.commands.updateAttributes(type, { firstLineIndent: Math.min(8, Math.max(0, current + amount)) })
      return true
    }
    return {
      Tab: () => indent(1),
      'Shift-Tab': () => indent(-1),
      // Allow keyboard users to leave the body without changing its content.
      Escape: () => { this.editor.commands.blur(); return true },
    }
  },
  addGlobalAttributes: () => [{ types: ['doc'], attributes: { marginLeft: { default: 0.75 }, marginRight: { default: 0.75 } } }, { types: ['paragraph', 'heading'], attributes: {
    indent: { default: 0, parseHTML: element => Math.min(8, Math.max(0, parseFloat(element.style.marginLeft) / 32 || 0)), renderHTML: attrs => ({ style: `margin-left:${attrs.indent * 24}pt` }) },
    firstLineIndent: { default: 0, parseHTML: element => Math.min(8, Math.max(0, parseFloat(element.style.textIndent) / (element.style.textIndent.endsWith('pt') ? 24 : 32) || 0)), renderHTML: attrs => ({ style: `text-indent:${attrs.firstLineIndent * 24}pt` }) },
    lineSpacing: { default: 1.15, parseHTML: element => parseFloat(element.style.lineHeight) || 1.15, renderHTML: attrs => ({ style: `line-height:${attrs.lineSpacing}` }) },
  } }],
})
const extensions = [StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false, code: false, link: { openOnClick: false, protocols: ['http', 'https', 'mailto'] } }), TextStyle, Color, FontFamily, FontSize, TextAlign.configure({ types: ['heading', 'paragraph'] }), Highlight.configure({ multicolor: true }), Image.configure({ allowBase64: true }), TableKit.configure({ table: { resizable: true, cellMinWidth: 40 } }), PageBreak, ParagraphLayout, TableRowResize]

export default function RichTextEditor({ value, plainText, onChange, disabled, error }) {
  const upload = useRef(null)
  const [message, setMessage] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const [link, setLink] = useState('')
  const [tableOpen, setTableOpen] = useState(false)
  const [tableRows, setTableRows] = useState(3)
  const [tableColumns, setTableColumns] = useState(3)
  const editor = useEditor({
    extensions,
    content: value || plainBodyDocument(plainText),
    editable: !disabled,
    editorProps: { attributes: { id: 'document-body', role: 'textbox', 'aria-label': 'Body', 'aria-multiline': 'true', spellcheck: 'true' } },
    onUpdate: ({ editor: current }) => {
      const document = current.getJSON()
      onChange(document, richBodyText(document))
    },
  })
  useEffect(() => { editor?.setEditable(!disabled) }, [editor, disabled])
  const state = useEditorState({ editor, selector: ({ editor: current }) => current ? {
    bold: current.isActive('bold'), italic: current.isActive('italic'), underline: current.isActive('underline'), strike: current.isActive('strike'),
    bulletList: current.isActive('bulletList'), orderedList: current.isActive('orderedList'), blockquote: current.isActive('blockquote'),
    heading: current.getAttributes('heading').level || 0, table: current.isActive('table'),
    rowHeight: current.getAttributes('tableRow').height || 24,
    image: current.isActive('image'), imageWidth: current.getAttributes('image').width || 480,
    font: current.getAttributes('textStyle').fontFamily || 'Arial', size: current.getAttributes('textStyle').fontSize || '12pt',
    align: current.getAttributes(current.isActive('heading') ? 'heading' : 'paragraph').textAlign || 'left',
    spacing: current.getAttributes(current.isActive('heading') ? 'heading' : 'paragraph').lineSpacing || 1.15,
    undo: current.can().undo(), redo: current.can().redo(),
    marginLeft: current.state.doc.attrs.marginLeft, marginRight: current.state.doc.attrs.marginRight,
  } : null })
  if (!editor || !state) return null
  const run = callback => callback(editor.chain().focus()).run()
  const button = (label, action, active, unavailable = false) => <button key={label} type="button" disabled={disabled || unavailable} aria-pressed={active} onMouseDown={event => event.preventDefault()} onClick={action}>{label}</button>
  function layout(name, value) { run(chain => chain.updateAttributes('paragraph', { [name]: value }).updateAttributes('heading', { [name]: value })) }
  function indent(amount) {
    if (editor.isActive('listItem')) { run(chain => amount > 0 ? chain.sinkListItem('listItem') : chain.liftListItem('listItem')); return }
    const attrs = editor.getAttributes(editor.isActive('heading') ? 'heading' : 'paragraph')
    layout('indent', Math.min(8, Math.max(0, (attrs.indent || 0) + amount)))
  }
  async function insertImage(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type) || file.size > 1024 * 1024) { setMessage('Choose a PNG, JPEG, or GIF image smaller than 1 MB.'); return }
    try {
      const src = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file) })
      if (JSON.stringify(editor.getJSON()).length + src.length > 2800000) { setMessage('The body images are too large. Use smaller images before adding another.'); return }
      run(chain => chain.setImage({ src, alt: file.name, width: 480 }))
      setMessage('')
    } catch { setMessage('Unable to read this image. Please try another file.') }
  }
  return <div className="rich-editor" aria-invalid={!!error}>
    <div className="rich-toolbar" role="toolbar" aria-label="Body formatting">
      <div className="rich-tool-group">
        {button('↶ Undo', () => run(chain => chain.undo()), undefined, !state.undo)}
        {button('↷ Redo', () => run(chain => chain.redo()), undefined, !state.redo)}
        {button('Page break', () => run(chain => chain.insertContent({ type: 'pageBreak' })))}
        {button('Insert image', () => upload.current.click())}
        {button('Insert table', () => setTableOpen(value => !value), tableOpen, state.table)}
      </div>
      <div className="rich-tool-group">
        {['bold', 'italic', 'underline', 'strike'].map((mark, index) => button(['Bold', 'Italic', 'Underline', 'Strikethrough'][index], () => run(chain => chain.toggleMark(mark)), state[mark]))}
        {button('Link', () => { setLink(editor.getAttributes('link').href || ''); setLinkOpen(true) })}
        {button('Unlink', () => run(chain => chain.unsetLink()))}
        {['left', 'center', 'right', 'justify'].map(align => button(align[0].toUpperCase() + align.slice(1), () => run(chain => chain.setTextAlign(align)), state.align === align))}
      </div>
      <div className="rich-tool-group">
        {button('Bullets', () => run(chain => chain.toggleBulletList()), state.bulletList)}
        {button('Numbered', () => run(chain => chain.toggleOrderedList()), state.orderedList)}
        {button('Decrease indent', () => indent(-1))}{button('Increase indent', () => indent(1))}
      </div>
      <div className="rich-tool-group">
        {button('Paragraph', () => run(chain => chain.setParagraph()), !state.heading)}
        {[1, 2, 3].map(level => button(`H${level}`, () => run(chain => chain.toggleHeading({ level })), state.heading === level))}
        {button('Quote', () => run(chain => chain.toggleBlockquote()), state.blockquote)}
        {button('Horizontal line', () => run(chain => chain.setHorizontalRule()))}
      </div>
      <div className="rich-tool-group">
        <label>Color<input type="color" defaultValue="#000000" disabled={disabled} onChange={event => run(chain => chain.setColor(event.target.value))} /></label>
        {button('Clear color', () => run(chain => chain.unsetColor()))}
        <label>Highlight<input type="color" defaultValue="#fff3a3" disabled={disabled} onChange={event => run(chain => chain.setHighlight({ color: event.target.value }))} /></label>
        {button('Clear highlight', () => run(chain => chain.unsetHighlight()))}
        {button('Clear formatting', () => run(chain => chain.unsetAllMarks().clearNodes().resetAttributes('paragraph', ['indent', 'firstLineIndent', 'lineSpacing', 'textAlign'])))}
        <label>Font<select value={state.font} disabled={disabled} onChange={event => run(chain => chain.setFontFamily(event.target.value))}>{['Arial', 'Times New Roman', 'Calibri', 'Georgia', 'Verdana'].map(font => <option key={font}>{font}</option>)}</select></label>
        <label>Size<select value={state.size} disabled={disabled} onChange={event => run(chain => chain.setFontSize(event.target.value))}>{[8, 9, 10, 11, 12, 14, 16, 18, 24, 30, 36].map(size => <option key={size} value={`${size}pt`}>{size}</option>)}</select></label>
        <label>Line spacing<select value={state.spacing} disabled={disabled} onChange={event => layout('lineSpacing', Number(event.target.value))}>{[1, 1.15, 1.5, 2].map(spacing => <option key={spacing}>{spacing}</option>)}</select></label>
        {['marginLeft', 'marginRight'].map(name => <label key={name}>{name === 'marginLeft' ? 'Left margin' : 'Right margin'}<select aria-label={name === 'marginLeft' ? 'Left margin' : 'Right margin'} value={state[name]} disabled={disabled} onChange={event => run(chain => chain.command(({ tr }) => { tr.setDocAttribute(name, Number(event.target.value)); return true }))}>{[0.5, 0.75, 1, 1.25, 1.5].map(margin => <option key={margin} value={margin}>{margin}″</option>)}</select></label>)}
      </div>
      {state.table && <div className="rich-tool-group" aria-label="Table editing">
        <label>Row height: {state.rowHeight}px<input type="range" min="24" max="1000" value={state.rowHeight} disabled={disabled} onChange={event => run(chain => chain.updateAttributes('tableRow', { height: Number(event.target.value) }))} /></label>{button('Auto height', () => run(chain => chain.resetAttributes('tableRow', ['height'])))}
        {button('Add row', () => run(chain => chain.addRowAfter()))}{button('Add column', () => run(chain => chain.addColumnAfter()))}
        {button('Delete row', () => run(chain => chain.deleteRow()))}{button('Delete column', () => run(chain => chain.deleteColumn()))}{button('Delete table', () => run(chain => chain.deleteTable()))}
      </div>}
    </div>
    {state.image && <div className="rich-link-form"><label>Image width: {state.imageWidth}px<input type="range" min="24" max="640" value={state.imageWidth} disabled={disabled} onChange={event => { const width = Number(event.target.value); if (width >= 24 && width <= 640) run(chain => chain.updateAttributes('image', { width, height: null })) }} /></label>{button('Delete image', () => run(chain => chain.deleteSelection()))}</div>}
    {tableOpen && <div className="rich-link-form"><label>Rows<input type="number" min="1" max="100" value={tableRows} disabled={disabled} onChange={event => setTableRows(event.target.value)} /></label><label>Columns<input type="number" min="1" max="12" value={tableColumns} disabled={disabled} onChange={event => setTableColumns(event.target.value)} /></label>{button('Add table', () => { const rows = Number(tableRows), cols = Number(tableColumns); if (!Number.isInteger(rows) || rows < 1 || rows > 100 || !Number.isInteger(cols) || cols < 1 || cols > 12) { setMessage('Choose 1?100 rows and 1?12 columns.'); return } run(chain => chain.insertTable({ rows, cols, withHeaderRow: true })); setTableOpen(false); setMessage('') })}{button('Cancel table', () => setTableOpen(false))}</div>}
    {linkOpen && <div className="rich-link-form"><label>Link address<input type="url" value={link} placeholder="https://example.com" onChange={event => setLink(event.target.value)} /></label>{button('Apply link', () => { if (!safeBodyLink(link)) { setMessage('Enter a link starting with https://, http://, or mailto:.'); return } run(chain => chain.extendMarkRange('link').setLink({ href: link })); setLinkOpen(false); setMessage('') })}{button('Cancel', () => setLinkOpen(false))}</div>}
    <input ref={upload} type="file" accept="image/png,image/jpeg,image/gif" hidden onChange={insertImage} disabled={disabled} />
    <EditorContent editor={editor} className="rich-body-content rich-editor-paper" style={{ '--body-left-margin': `${state.marginLeft}in`, '--body-right-margin': `${state.marginRight}in` }} />
    {(message || error) && <p className="rich-editor-error" role="alert">{message || error}</p>}
  </div>
}
