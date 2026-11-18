import { deviceClass } from '@/feedback/device'
import type { FeedbackDraft, FeedbackEntry, FeedbackError } from '@/feedback/types'
import { getApiBaseUrl } from '@/runtime/env'

const UNREACHABLE = 'The server could not be reached. Check your connection and try again.'
/** The backend's own limit on the page path. */
const PAGE_MAX = 200

/** The backend's `{detail: {summary}}`, else a sentence naming the status (FastAPI's own 422 has a list there). */
async function errorFrom(res: Response): Promise<FeedbackError> {
  let summary = `The message could not be sent (HTTP ${res.status}).`
  try {
    const body = await res.json()
    if (typeof body?.detail?.summary === 'string') summary = body.detail.summary
  }
  catch { /* not JSON: a proxy's page */ }
  return { status: res.status, summary }
}

async function send(url: string, init: RequestInit): Promise<Response> {
  let res: Response
  try { res = await fetch(url, init) }
  catch { throw { status: 0, summary: UNREACHABLE } satisfies FeedbackError }
  if (!res.ok) throw await errorFrom(res)
  return res
}

/**
 * Posts one note. Besides what the reader wrote it sends only the page path,
 * the screen's layout tier, the app version and how the app is running --
 * never a name, an address or the browser's details.
 */
export async function postFeedback(draft: FeedbackDraft, page: string): Promise<{ id: string, created_at: string }> {
  const res = await send(`${getApiBaseUrl()}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rating: draft.rating,
      comment: draft.comment.trim(),
      page: page.slice(0, PAGE_MAX),
      device: deviceClass(window.innerWidth),
      app_version: __APP_VERSION__.slice(0, 32),
      mode: __IS_PLUGIN__ ? 'plugin' : 'standalone',
    }),
  })
  return res.json()
}

/** Every note, newest first. The password travels in a header, so it is never in a URL or a log line. */
export async function fetchFeedback(password: string): Promise<{ total: number, items: FeedbackEntry[] }> {
  const res = await send(`${getApiBaseUrl()}/feedback`, {
    headers: { 'X-Feedback-Password': password },
    cache: 'no-store',
  })
  return res.json()
}
