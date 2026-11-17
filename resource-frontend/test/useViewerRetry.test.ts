import { computed } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useViewerRetry } from '../src/myMri/useViewerRetry'

/**
 * A viewer's own Try again: one findings request through `withReload` (so a
 * backend that restarted gets the config posted again), then a new attempt
 * number, which the page keys the viewer on to rebuild it alone.
 */
function fakeSession(withReload: (fn: () => Promise<unknown>) => Promise<unknown>) {
  return {
    urls: computed(() => ({ mri: '/m', mask: '/k', findings: '/f', report: () => '/r' })),
    withReload: vi.fn(withReload) as unknown as <T>(fn: () => Promise<T>) => Promise<T>,
  }
}

describe('useViewerRetry', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('asks for the findings through withReload, then counts a new attempt', async () => {
    const fetchMock = vi.fn(async () => new Response('{"findings":[]}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const session = fakeSession(fn => fn())
    const { attempt, retry } = useViewerRetry(session)
    expect(attempt.value).toBe(0)
    await retry()
    expect(session.withReload).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/f', expect.anything())
    expect(attempt.value).toBe(1)
  })

  it('still counts a new attempt when the findings request fails', async () => {
    const session = fakeSession(() => Promise.reject(new Error('down')))
    const { attempt, retry } = useViewerRetry(session)
    await retry()
    expect(attempt.value).toBe(1)
  })
})
