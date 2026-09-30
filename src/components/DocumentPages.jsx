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
    async function render() {
      try {
        const [pdfjs, { default: workerUrl }] = await Promise.all([
          import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
        ])
        const data = new Uint8Array(await file.arrayBuffer())
        if (cancelled) return
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
        task = pdfjs.getDocument({ data, isEvalSupported: false })
        const pdf = await task.promise
        for (let number = 1; number <= pdf.numPages; number++) {
          if (cancelled) return
          const page = await pdf.getPage(number)
          if (cancelled) return
          const natural = page.getViewport({ scale: 1 })
          const scale = Math.min(2, window.devicePixelRatio || 1) * 1.5
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          canvas.style.width = `${natural.width * 1.5}px`
          canvas.setAttribute('role', 'img')
          canvas.setAttribute('aria-label', `Document page ${number} of ${pdf.numPages}`)
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
          if (cancelled) return
          host.appendChild(canvas)
          if (number === 1) callbacks.current.onReady()
          page.cleanup()
        }
      } catch (error) {
        if (!cancelled) callbacks.current.onError(error)
      }
    }
    render()
    return () => {
      cancelled = true
      task?.destroy()
      host.replaceChildren()
    }
  }, [file])

  return <div ref={container} className="document-preview-pages" />
}
