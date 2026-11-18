/** How easy the page was to understand, 1 (very hard) to 5 (very easy). */
export type Rating = 1 | 2 | 3 | 4 | 5

export type DeviceClass = 'phone' | 'tablet' | 'desktop'

/**
 * The five answers, in order, with what each face is drawn in: an ink for
 * the stroke and the label, a fill for the chip behind it once chosen. From
 * the app's own palette -- burgundy at the hard end, teal and green at the
 * easy end -- and every ink clears 4.5:1 on its fill.
 */
export const RATINGS: { value: Rating, label: string, ink: string, fill: string }[] = [
  { value: 1, label: 'Very hard', ink: '#8E3650', fill: '#FCE8ED' },
  { value: 2, label: 'Hard', ink: '#A1461F', fill: '#FBEDE4' },
  { value: 3, label: 'Okay', ink: '#586273', fill: '#EEF0F4' },
  { value: 4, label: 'Easy', ink: '#26706D', fill: '#E3F1F0' },
  { value: 5, label: 'Very easy', ink: '#2B6E45', fill: '#E3F2E8' },
]

export function ratingLabel(rating: Rating | null | undefined): string {
  return RATINGS.find(r => r.value === rating)?.label ?? ''
}

/** What the reader fills in. A rating, some text, or both. */
export interface FeedbackDraft {
  rating: Rating | null
  comment: string
}

/** One stored entry, as the review page lists it. */
export interface FeedbackEntry extends FeedbackDraft {
  id: string
  created_at: string
  page: string
  device: DeviceClass
  app_version: string
  mode: 'plugin' | 'standalone'
}

/** One Stay in touch sign-up. Kept apart from feedback, in its own file. */
export interface Subscriber {
  id: string
  created_at: string
  first_name: string
  contact: string
  contact_type: 'email' | 'phone'
}

/** A failure the form or the review page can show as it is. `status` 0: the server was not reached. */
export interface FeedbackError {
  status: number
  summary: string
}
