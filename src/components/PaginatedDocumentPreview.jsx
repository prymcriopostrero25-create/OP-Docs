import { useEffect, useRef } from 'react'
import { measurePreviewPages } from '../lib/previewPdf'

function cloneStyledPaper(paper) {
  const clone = paper.cloneNode(true)
  const originals = [paper, ...paper.querySelectorAll('*')]
  const copies = [clone, ...clone.querySelectorAll('*')]
  originals.forEach((original, index) => {
    const computed = getComputedStyle(original)
    for (const property of computed) copies[index].style.setProperty(property, computed.getPropertyValue(property))
  })
  return clone
}

// Keep the preview as selectable HTML while matching the PDF's paper and slices.
export default function PaginatedDocumentPreview({ source, revision, onError }) {
  const container = useRef(null)
  const callbacks = useRef(onError)
  useEffect(() => { callbacks.current = onError }, [onError])

  useEffect(() => {
    const host = container.current
    let cancelled = false
    let observer
    async function render() {
      try {
        await document.fonts.ready
        const paper = source.current?.querySelector('article')
        if (!paper) return
        await Promise.all(Array.from(paper.querySelectorAll('img'), image => image.decode()))
        if (cancelled) return
        const { width, height, footer, footerHeight, bottomPadding, pagePixels, segments } = measurePreviewPages(paper)
        // Read computed styles once, then reuse the detached templates per page.
        const contentTemplate = cloneStyledPaper(paper)
        const styledFooter = contentTemplate.querySelector('footer[aria-label="Document footer"]')
        const footerTemplate = footer ? contentTemplate.cloneNode(false) : null
        if (styledFooter && footerTemplate) footerTemplate.append(styledFooter)
        const fragment = document.createDocumentFragment()
        for (const [index, { start, end }] of segments.entries()) {
          const slot = document.createElement('section')
          slot.className = 'html-preview-page-slot'
          slot.setAttribute('aria-label', `Page ${index + 1} of ${segments.length}`)
          const page = document.createElement('div')
          page.className = 'html-preview-page'
          page.style.width = `${width}px`
          page.style.height = `${pagePixels}px`
          const clip = document.createElement('div')
          Object.assign(clip.style, { position: 'absolute', top: `${footer && index > 0 ? 24 * width / 595.28 : 0}px`, width: '100%', height: `${end - start}px`, overflow: 'hidden' })
          const content = contentTemplate.cloneNode(true)
          Object.assign(content.style, { position: 'absolute', top: `${-start}px`, width: `${width}px`, maxWidth: 'none', height: `${height}px`, margin: '0', boxShadow: 'none' })
          clip.append(content)
          page.append(clip)
          if (footer) {
            const footerClip = document.createElement('div')
            Object.assign(footerClip.style, { position: 'absolute', bottom: `${bottomPadding}px`, width: '100%', height: `${footerHeight}px`, overflow: 'hidden' })
            // Preserve the article's typography and horizontal footer padding.
            const footerPaper = footerTemplate.cloneNode(true)
            Object.assign(footerPaper.style, { width: `${width}px`, maxWidth: 'none', height: `${footerHeight}px`, minHeight: '0', paddingTop: '0', paddingBottom: '0', margin: '0', boxShadow: 'none' })
            const footerClone = footerPaper.querySelector('footer')
            footerClone.style.marginTop = '0'
            const number = footerClone.querySelector('[data-page-number]')
            if (number) {
              number.textContent = number.dataset.pageNumber === 'total' ? `Page ${index + 1} of ${segments.length}` : String(index + 1)
              number.setAttribute('aria-label', `Page ${index + 1} of ${segments.length}`)
            }
            footerClip.append(footerPaper)
            page.append(footerClip)
          }
          slot.append(page)
          fragment.append(slot)
        }
        host.replaceChildren(fragment)
        const resize = () => {
          const scale = Math.min(1, Math.max(1, host.clientWidth - 32) / width)
          for (const slot of host.children) {
            slot.style.width = `${width * scale}px`
            slot.style.height = `${pagePixels * scale}px`
            slot.firstChild.style.transform = `scale(${scale})`
          }
        }
        observer = new ResizeObserver(resize)
        observer.observe(host)
        resize()
      } catch (error) { if (!cancelled) callbacks.current?.(error) }
    }
    void render()
    return () => { cancelled = true; observer?.disconnect(); host.replaceChildren() }
  }, [source, revision])

  return <div ref={container} className="html-preview-pages" />
}
