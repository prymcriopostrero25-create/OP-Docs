import { useEffect } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle, Color, FontFamily, FontSize } from '@tiptap/extension-text-style'
import TextAlign from '@tiptap/extension-text-align'

export default function EmailReplyEditor({ disabled, onChange }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: false, codeBlock: false, code: false, horizontalRule: false, link: false }), TextStyle, Color, FontFamily, FontSize, TextAlign.configure({ types: ['paragraph'] })],
    content: '<p></p>',
    editorProps: { attributes: { role: 'textbox', 'aria-label': 'Your reply', 'aria-multiline': 'true' } },
    onUpdate: ({ editor }) => onChange(editor.getText(), editor.getJSON()),
  })
  useEffect(() => { editor?.setEditable(!disabled) }, [editor, disabled])
  const state = useEditorState({ editor, selector: ({ editor }) => editor ? { empty: editor.isEmpty, bold: editor.isActive('bold'), italic: editor.isActive('italic'), underline: editor.isActive('underline'), strike: editor.isActive('strike'), bullet: editor.isActive('bulletList'), ordered: editor.isActive('orderedList'), quote: editor.isActive('blockquote') } : {} })
  if (!editor) return null
  const button = (label, text, action, active) => <button type="button" title={label} aria-label={label} aria-pressed={active} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={action}>{text}</button>
  return <div className="email-rich-reply">
    <div className="email-format-toolbar" role="toolbar" aria-label="Reply formatting">
      {button('Undo', '↶', () => editor.chain().focus().undo().run())}{button('Redo', '↷', () => editor.chain().focus().redo().run())}
      <select aria-label="Font" disabled={disabled} defaultValue="Arial" onChange={event => editor.chain().focus().setFontFamily(event.target.value).run()}>{['Arial', 'Times New Roman', 'Calibri', 'Georgia', 'Verdana'].map(font => <option key={font}>{font}</option>)}</select>
      <select aria-label="Text size" disabled={disabled} defaultValue="12pt" onChange={event => editor.chain().focus().setFontSize(event.target.value).run()}>{['8','10','12','14','18','24','36'].map(size => <option key={size} value={size + 'pt'}>{size}</option>)}</select>
      {button('Bold', <b>B</b>, () => editor.chain().focus().toggleBold().run(), state.bold)}
      {button('Italic', <i>I</i>, () => editor.chain().focus().toggleItalic().run(), state.italic)}
      {button('Underline', <u>U</u>, () => editor.chain().focus().toggleUnderline().run(), state.underline)}
      <label title="Text color">A<input type="color" aria-label="Text color" disabled={disabled} onChange={event => editor.chain().focus().setColor(event.target.value).run()} /></label>
      <select aria-label="Text alignment" disabled={disabled} defaultValue="left" onChange={event => editor.chain().focus().setTextAlign(event.target.value).run()}>{['left','center','right','justify'].map(value => <option key={value}>{value}</option>)}</select>
      {button('Numbered list', '1.', () => editor.chain().focus().toggleOrderedList().run(), state.ordered)}
      {button('Bullet list', '•', () => editor.chain().focus().toggleBulletList().run(), state.bullet)}
      {button('Decrease list indent', '⇤', () => editor.chain().focus().liftListItem('listItem').run())}
      {button('Increase list indent', '⇥', () => editor.chain().focus().sinkListItem('listItem').run())}
      {button('Quote', '❞', () => editor.chain().focus().toggleBlockquote().run(), state.quote)}
      {button('Strikethrough', <s>S</s>, () => editor.chain().focus().toggleStrike().run(), state.strike)}
      {button('Clear formatting', 'Tx', () => editor.chain().focus().unsetAllMarks().clearNodes().run())}
    </div>
    <div className="email-editor-writing-area"><EditorContent editor={editor} />{state.empty && <span className="email-editor-placeholder">Write your response here...</span>}</div>
  </div>
}
