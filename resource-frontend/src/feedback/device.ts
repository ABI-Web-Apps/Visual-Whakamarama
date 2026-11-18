import type { DeviceClass } from '@/feedback/types'

/**
 * The kind of screen a note came from, by the app's own layout tiers
 * (tokens: `md` 768px, `xl` 1280px), so "phone" means the stacked layout the
 * reader actually saw. A width, never a user agent: nothing that identifies
 * a browser goes with feedback.
 */
export function deviceClass(width: number): DeviceClass {
  if (width < 768) return 'phone'
  if (width < 1280) return 'tablet'
  return 'desktop'
}
