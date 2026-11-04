export default function EmailIcon({ name, size = 18 }) {
  const paths = {
    inbox: 'M4 4h16l2 10v6H2v-6L4 4ZM2 14h6l2 3h4l2-3h6',
    search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    refresh: 'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 2M18 18a8 8 0 0 1-13-2',
    arrow: 'M5 12h14m-5-5 5 5-5 5',
    check: 'M5 12l4 4L19 6',
    clock: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    info: 'M12 11v6M12 7h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    reply: 'M9 10H20M9 10l5-5M9 10l5 5M20 10v5a4 4 0 0 1-4 4H5',
    close: 'M6 6l12 12M18 6L6 18',
    attach: 'M8 12l6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9',
    send: 'M22 2L9 15M22 2l-7 20-6-7-7-6 20-7',
    external: 'M14 3h7v7M21 3l-10 10M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5',
    download: 'M12 3v12M7 10l5 5 5-5M4 16v5h16v-5',
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flexShrink: 0, verticalAlign: 'middle' }}><path d={paths[name] || paths.attach} /></svg>
}
