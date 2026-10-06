import { useEffect, useRef } from 'react'

// Render the original pages without invoking the browser's PDF viewer/download settings.
export default function DocumentPages({ file, onReady, onError }) {
  const container = useRef(null)
  const callbacks = useRef({ onReady, onError })
  useEffect(() => { callbacks.current = { onReady, onError } }, [onReady, onError])

  useEffect(() => {
    const host = container.current
    let cancelled = false
    let task
    let observer, renderTask, pdf, running = false
    const slots = [], visible = new Set(), queue = new Set()
    async function drain() {
      if (running || cancelled) return
      running = true
      try {
        while (queue.size && !cancelled) {
          const number = queue.values().next().value
          queue.delete(number)
          if (!visible.has(number)) continue
          const slot = slots[number - 1]
          if (slot.firstChild) continue
          const page = await pdf.getPage(number)
          if (cancelled) return
          const natural = page.getViewport({ scale: 1 })
          const width = Math.min(natural.width * 1.5, Math.max(1, host.clientWidth - 40))
          const cssScale = width / natural.width
          const scale = Math.min(cssScale * Math.min(2, window.devicePixelRatio || 1), Math.sqrt(4000000 / (natural.width * natural.height)))
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          canvas.style.width = `${width}px`
          slot.style.width = `${width}px`
          slot.style.height = `${natural.height * cssScale}px`
          canvas.setAttribute('role', 'img')
          canvas.setAttribute('aria-label', `Document page ${number} of ${pdf.numPages}`)
          renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport })
          await renderTask.promise
          renderTask = null
          if (cancelled) return
          if (visible.has(number)) slot.appendChild(canvas)
          else { canvas.width = 0; canvas.height = 0 }
          if (number === 1) callbacks.current.onReady?.()
          page.cleanup()
        }
      } catch (error) { if (!cancelled) callbacks.current.onError?.(error) }
      finally { running = false }
    }
    async function render() {
      try {
        const [pdfjs, { default: workerUrl }] = await Promise.all([
          import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
        ])
        const data = new Uint8Array(await file.arrayBuffer())
        if (cancelled) return
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
        task = pdfjs.getDocument({ data, isEvalSupported: false })
        pdf = await task.promise
        const first = await pdf.getPage(1)
        if (cancelled) return
        const natural = first.getViewport({ scale: 1 })
        const width = Math.min(natural.width * 1.5, Math.max(1, host.clientWidth - 40))
        const fragment = document.createDocumentFragment()
        for (let number = 1; number <= pdf.numPages; number++) {
          const slot = document.createElement('div')
          slot.className = 'document-preview-page'
          slot.dataset.page = number
          slot.style.width = `${width}px`
          slot.style.height = `${width * natural.height / natural.width}px`
          slots.push(slot)
          fragment.appendChild(slot)
        }
        host.appendChild(fragment)
        observer = new IntersectionObserver(entries => {
          for (const entry of entries) {
            const number = Number(entry.target.dataset.page)
            if (entry.isIntersecting) { visible.add(number); queue.add(number) }
            else {
              visible.delete(number); queue.delete(number)
              const canvas = entry.target.firstChild
              if (canvas) { canvas.width = 0; canvas.height = 0; canvas.remove() }
            }
          }
          void drain()
        }, { root: host.closest('.preview-frame-wrap'), rootMargin: '600px 0px' })
        slots.forEach(slot => observer.observe(slot))
        visible.add(1); queue.add(1)
        void drain()
      } catch (error) {
        if (!cancelled) callbacks.current.onError?.(error)
      }
    }
    render()
    return () => {
      cancelled = true
      observer?.disconnect()
      renderTask?.cancel()
      void task?.destroy().catch(() => {})
      host.querySelectorAll('canvas').forEach(canvas => { canvas.width = 0; canvas.height = 0 })
      host.replaceChildren()
    }
  }, [file])

  return <div ref={container} className="document-preview-pages" />
}
