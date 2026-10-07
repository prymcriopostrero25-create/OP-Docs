import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'

export const rowHeight = value => Math.round(Math.max(24, Math.min(1000, Number(value) || 24)))

export const TableRowResize = Extension.create({
  name: 'tableRowResize',
  addGlobalAttributes() {
    return [{ types: ['tableRow'], attributes: { height: {
      default: null,
      parseHTML: element => element.style.height ? rowHeight(parseFloat(element.style.height)) : null,
      renderHTML: attrs => attrs.height ? { style: `height:${attrs.height}px` } : {},
    } } }]
  },
  addProseMirrorPlugins() {
    let cleanup
    function edge(view, event) {
      if (!view.editable || !(event.target instanceof Element)) return null
      const cell = event.target.closest('td, th')
      const row = cell?.parentElement
      if (!row || !view.dom.contains(row)) return null
      const bounds = row.getBoundingClientRect()
      return Math.abs(event.clientY - bounds.bottom) <= 6 ? { row, bounds } : null
    }
    return [new Plugin({
      props: { handleDOMEvents: {
        mousemove(view, event) {
          view.dom.classList.toggle('row-resize-cursor', Boolean(edge(view, event)))
          return false
        },
        mouseleave(view) { view.dom.classList.remove('row-resize-cursor'); return false },
        mousedown(view, event) {
          const target = edge(view, event)
          if (!target || event.button !== 0) return false
          const resolved = view.state.doc.resolve(view.posAtDOM(target.row, 0))
          let depth = resolved.depth
          while (depth > 0 && resolved.node(depth).type.name !== 'tableRow') depth--
          if (!depth) return false
          const position = resolved.before(depth)
          const original = view.state.doc.nodeAt(position)
          const startY = event.clientY, startHeight = target.bounds.height
          const priorStyle = target.row.style.height
          let height = rowHeight(startHeight)
          cleanup?.()
          event.preventDefault()
          const move = current => {
            height = rowHeight(startHeight + current.clientY - startY)
            target.row.style.height = `${height}px`
          }
          const finish = () => {
            cleanup()
            if (!view.isDestroyed && view.editable && view.state.doc.nodeAt(position) === original) {
              view.dispatch(view.state.tr.setNodeMarkup(position, undefined, { ...original.attrs, height }))
            }
          }
          cleanup = () => {
            document.removeEventListener('mousemove', move)
            document.removeEventListener('mouseup', finish)
            window.removeEventListener('blur', cleanup)
            target.row.style.height = priorStyle
            view.dom.classList.remove('row-resize-cursor')
          }
          document.addEventListener('mousemove', move)
          document.addEventListener('mouseup', finish)
          window.addEventListener('blur', cleanup, { once: true })
          return true
        },
      } },
      view: () => ({ destroy: () => cleanup?.() }),
    })]
  },
})
