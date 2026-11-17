import { ref } from 'vue'
import type { ComputedRef } from 'vue'
import { fetchJson } from '@/myMri/api'

interface RetrySession {
  urls: ComputedRef<{ findings: string } | null>
  withReload: <T>(fn: () => Promise<T>) => Promise<T>
}

/**
 * A viewer's own Try again. Bumping `attempt` rebuilds that viewer alone (the
 * page keys it on the attempt): a scan that failed to display needs no new
 * session, and nothing else on the page changes.
 *
 * The scan and the mask are fetched by copper3d, outside `withReload`, so a
 * backend that restarted (and so forgot the assay) would answer every rebuilt
 * viewer with 409. One findings request through `withReload` first re-posts
 * the config if needed. Its answer is not used: `no_findings` already proves
 * the assay is loaded, and any other failure is the rebuilt viewer's to show.
 *
 * One per viewer: a page with two viewers retries each on its own.
 */
export function useViewerRetry(session: RetrySession) {
  const attempt = ref(0)

  async function retry(): Promise<void> {
    const findingsUrl = session.urls.value?.findings
    if (findingsUrl) {
      try {
        await session.withReload(() => fetchJson(findingsUrl))
      }
      catch { /* see above */ }
    }
    attempt.value++
  }

  return { attempt, retry }
}
