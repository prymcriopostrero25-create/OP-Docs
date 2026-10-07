import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Schema } from '@tiptap/pm/model'
import { EditorState } from '@tiptap/pm/state'
import { TableRowResize } from '../src/lib/tableRowResize.js'

test('dragging a horizontal border changes only its row and removes drag listeners', () => {
  const schema = new Schema({ nodes: {
    doc: { content: 'table' }, table: { content: 'tableRow+' },
    tableRow: { content: 'tableCell+', attrs: { height: { default: null } } },
    tableCell: { content: 'paragraph' }, paragraph: { content: 'text*' }, text: {},
  } })
  const doc = schema.nodeFromJSON({ type: 'doc', content: [{ type: 'table', content: [
    { type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph' }] }] },
    { type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph' }] }] },
  ] }] })
  const prior = { Element: globalThis.Element, document: globalThis.document, window: globalThis.window }
  const listeners = new Map()
  class Element { closest() { return { parentElement: row } } }
  const row = { style: { height: '' }, getBoundingClientRect: () => ({ bottom: 100, height: 60 }) }
  const events = { addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name) }
  Object.assign(globalThis, { Element, document: events, window: events })
  try {
    const plugin = TableRowResize.config.addProseMirrorPlugins()[0]
    const view = { editable: true, state: EditorState.create({ doc }), posAtDOM: () => 2, dom: { contains: () => true, classList: { toggle() {}, remove() {} } }, dispatch(transaction) { this.state = this.state.apply(transaction) } }
    const event = { target: new Element(), clientY: 100, button: 0, preventDefault() {} }
    assert.equal(plugin.props.handleDOMEvents.mousedown(view, event), true)
    listeners.get('mousemove')({ clientY: 150 })
    assert.equal(row.style.height, '110px')
    listeners.get('mouseup')()
    assert.equal(view.state.doc.firstChild.firstChild.attrs.height, 110)
    assert.equal(view.state.doc.firstChild.lastChild.attrs.height, null)
    assert.equal(listeners.size, 0)
    assert.equal(row.style.height, '')
    assert.equal(plugin.props.handleDOMEvents.mousedown(view, { ...event, clientY: 70 }), false)
    view.editable = false
    assert.equal(plugin.props.handleDOMEvents.mousedown(view, event), false)
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  }
})
