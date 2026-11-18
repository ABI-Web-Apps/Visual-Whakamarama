import { ratingLabel } from '@/feedback/types'
import type { FeedbackEntry, Subscriber } from '@/feedback/types'

/**
 * The review page's exports, as CSV a spreadsheet opens cleanly:
 *
 * - RFC 4180: cells with a comma, a quote or a line break are quoted, quotes
 *   doubled; rows end in CRLF;
 * - a byte-order mark first, or Excel reads "ngā" as "ngÄ";
 * - a cell that starts with = + - or @ gets a leading apostrophe, so a
 *   reader's comment can never run as a formula in whoever opens the file.
 */
function cell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function csv(header: string[], rows: unknown[][]): string {
  return `﻿${[header, ...rows].map(r => r.map(cell).join(',')).join('\r\n')}`
}

export function feedbackCsv(items: FeedbackEntry[]): string {
  return csv(
    ['id', 'created_at', 'rating', 'rating_label', 'comment', 'page', 'device', 'app_version', 'mode'],
    items.map(e => [e.id, e.created_at, e.rating, ratingLabel(e.rating), e.comment, e.page, e.device, e.app_version, e.mode]),
  )
}

export function subscribersCsv(items: Subscriber[]): string {
  return csv(
    ['id', 'created_at', 'first_name', 'contact', 'contact_type'],
    items.map(s => [s.id, s.created_at, s.first_name, s.contact, s.contact_type]),
  )
}

/** `visual-whakamarama-<list>-YYYY-MM-DD.csv`, dated in the reader's own day. */
export function csvFileName(list: 'feedback' | 'stay-in-touch', day: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `visual-whakamarama-${list}-${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}.csv`
}
