const locks = new Set()
let previousOverflow = ''

export function lockBodyScroll() {
  const token = Symbol('scroll lock')
  if (locks.size === 0) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  locks.add(token)
  return () => {
    if (!locks.delete(token)) return
    if (locks.size === 0) document.body.style.overflow = previousOverflow
  }
}
