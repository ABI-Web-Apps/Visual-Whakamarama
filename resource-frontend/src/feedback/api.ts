import { deviceClass } from '@/feedback/device'
import type { FeedbackDraft, FeedbackEntry, FeedbackError, Subscriber } from '@/feedback/types'
import { getApiBaseUrl } from '@/runtime/env'

const UNREACHABLE = 'The server could not be reached. Check your connection and try again.'
/** The backend's own limit on the page path. */
const PAGE_MAX = 200

/**
 * The backend's `{detail: {summary}}`, else `failed` and the status (FastAPI's
 * own 422 has a list there, and a proxy sends its own page).
 */
async function errorFrom(res: Response, failed: string): Promise<FeedbackError> {
  let summary = `${failed} (HTTP ${res.status}).`
  try {
    const body = await res.json()
    if (typeof body?.detail?.summary === 'string') summary = body.detail.summary
  }
  catch { /* not JSON: a proxy's page */ }
  return { status: res.status, summary }
}

const SEND_FAILED = 'The message could not be sent'
const LOAD_FAILED = 'The inbox could not be loaded'
const DELETE_FAILED = 'The entry could not be deleted'

async function send(url: string, init: RequestInit, failed = SEND_FAILED): Promise<Response> {
  let res: Response
  try { res = await fetch(url, init) }
  catch { throw { status: 0, summary: UNREACHABLE } satisfies FeedbackError }
  if (!res.ok) throw await errorFrom(res, failed)
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
  }, LOAD_FAILED)
  return res.json()
}

// ── Stay in touch, and the review page's deletes ──────────────────────────

/**
 * Signs someone up. The backend answers the same (201) whether or not the
 * contact was already on the list, so nobody can use this form to find out who
 * is; there is nothing in the answer to read.
 */
export async function postSubscriber(entry: { first_name: string, contact: string }): Promise<void> {
  await send(`${getApiBaseUrl()}/subscribers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ first_name: entry.first_name, contact: entry.contact }),
  })
}

export async function fetchSubscribers(password: string): Promise<{ total: number, items: Subscriber[] }> {
  const res = await send(`${getApiBaseUrl()}/subscribers`, {
    headers: { 'X-Feedback-Password': password },
    cache: 'no-store',
  }, LOAD_FAILED)
  return res.json()
}

function remove(kind: 'feedback' | 'subscribers', password: string, id: string): Promise<Response> {
  return send(`${getApiBaseUrl()}/${kind}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'X-Feedback-Password': password },
  }, DELETE_FAILED)
}

export async function deleteFeedback(password: string, id: string): Promise<void> {
  await remove('feedback', password, id)
}

export async function deleteSubscriber(password: string, id: string): Promise<void> {
  await remove('subscribers', password, id)
}
