/**
 * Whether the report should be read as page images rather than in an iframe.
 *
 * A PDF in an iframe works where a mouse is the pointer. On a touch device it
 * does not: iOS and iPadOS Safari paint page 1 as a still picture and never
 * scroll to page 2, and Android Chrome shows nothing at all. So a finger
 * (`pointer: coarse`) gets the page images.
 *
 * iPadOS asking for the desktop site reports itself as a Mac, and with a
 * trackpad attached its primary pointer can read as fine; a Mac with a touch
 * screen is how it gives itself away. A touch-screen Windows laptop keeps
 * the iframe: its browser shows the PDF inline perfectly well.
 */
export function prefersTouchReader(win: Window = window): boolean {
  if (typeof win.matchMedia !== 'function') return false
  if (win.matchMedia('(pointer: coarse)').matches) return true
  const nav = win.navigator
  return nav.maxTouchPoints > 1 && /Macintosh/.test(nav.userAgent)
}
