import { describe, expect, it } from 'vitest'
import { prefersTouchReader } from '../src/utils/touchReader'

const WINDOWS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36'
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15'

function fakeWindow(opts: { coarse?: boolean, maxTouchPoints?: number, ua?: string, matchMedia?: boolean }): Window {
  const { coarse = false, maxTouchPoints = 0, ua = WINDOWS_UA, matchMedia = true } = opts
  return {
    matchMedia: matchMedia ? (q: string) => ({ matches: q === '(pointer: coarse)' && coarse }) : undefined,
    navigator: { maxTouchPoints, userAgent: ua },
  } as unknown as Window
}

describe('prefersTouchReader', () => {
  it('is true where the primary pointer is a finger (phones, Android tablets, iPad in mobile mode)', () => {
    expect(prefersTouchReader(fakeWindow({ coarse: true, maxTouchPoints: 5 }))).toBe(true)
  })

  it('is true for iPadOS asking for the desktop site: a Mac UA with a touch screen', () => {
    // iPadOS reports itself as a Mac, and with a trackpad attached its primary
    // pointer can read as fine. Its PDF iframe still shows only page 1.
    expect(prefersTouchReader(fakeWindow({ coarse: false, maxTouchPoints: 5, ua: MAC_UA }))).toBe(true)
  })

  it('is false on a Mac, which has no touch screen', () => {
    expect(prefersTouchReader(fakeWindow({ coarse: false, maxTouchPoints: 0, ua: MAC_UA }))).toBe(false)
  })

  it('is false on a touch-screen Windows laptop, whose browser shows the PDF inline', () => {
    expect(prefersTouchReader(fakeWindow({ coarse: false, maxTouchPoints: 10 }))).toBe(false)
  })

  it('is false where matchMedia does not exist', () => {
    expect(prefersTouchReader(fakeWindow({ matchMedia: false }))).toBe(false)
  })
})
