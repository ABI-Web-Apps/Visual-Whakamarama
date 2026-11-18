import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MyMriReport from '../src/components/myMri/MyMriReport.vue'
import ReportPages from '../src/components/myMri/ReportPages.vue'
import StageControls from '../src/components/stage/StageControls.vue'
import { prefersTouchReader } from '../src/utils/touchReader'

vi.mock('../src/utils/touchReader', () => ({ prefersTouchReader: vi.fn(() => false) }))

const jsonRes = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
const pdfRes = () => new Response(new Blob(['%PDF-1.7 test'], { type: 'application/pdf' }), { status: 200 })
const PAGES = { version: 'abc123def456', pages: [{ width: 595, height: 842, text: 'Your breast MRI: what we found' }] }
const urls = {
  report: '/api/patients/a/sub-1/report.pdf',
  reportPages: '/api/patients/a/sub-1/report/pages',
  reportPage: (i: number) => `/api/patients/a/sub-1/report/pages/${i}.png`,
}
/** The backend: the PDF, and the page list the touch reader asks for. */
const backend = () => vi.fn(async (url: string) => (String(url).endsWith('/report/pages') ? jsonRes(200, PAGES) : pdfRes()))
const withReload = <T>(fn: () => Promise<T>) => fn()

let create: ReturnType<typeof vi.spyOn>
let revoke: ReturnType<typeof vi.spyOn>
const mounted: { unmount: () => void }[] = []

function mountReport(props: Record<string, unknown> = {}) {
  const w = mount(MyMriReport, { props: { urls, cohort: 'sub-1', withReload, ...props } })
  mounted.push(w)
  return w
}
function setViewer(value: boolean | undefined) {
  Object.defineProperty(navigator, 'pdfViewerEnabled', { value, configurable: true })
}

describe('MyMriReport', () => {
  beforeEach(() => {
    create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report-1')
    revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.stubGlobal('fetch', backend())
    vi.mocked(prefersTouchReader).mockReturnValue(false)
    setViewer(true)
  })
  afterEach(async () => {
    mounted.splice(0).forEach(w => w.unmount())
    await flushPromises()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    setViewer(undefined)
  })

  it('shows the PDF in an iframe from an object URL', async () => {
    const w = mountReport()
    await flushPromises()
    const frame = w.get('iframe')
    expect(frame.attributes('src')).toBe('blob:report-1')
    expect(frame.attributes('title')).toBe('Your MRI summary')
    const dl = w.get('a[download]')
    expect(dl.attributes('href')).toBe('blob:report-1')
    expect(dl.attributes('download')).toBe('sub-1-mri-report.pdf')
  })

  it('has the panel control bar under the PDF: Reset view, Fullscreen and Download', async () => {
    const w = mountReport()
    const bar = w.getComponent(StageControls)
    expect(bar.props('compact')).toBe(true)
    expect(bar.attributes('data-tour')).toBeUndefined()
    // Reset view waits for the PDF; Download appears with it.
    expect(bar.get('button[aria-label="Reset view"]').attributes('disabled')).toBeDefined()
    expect(bar.find('a[download]').exists()).toBe(false)
    await flushPromises()
    expect(bar.get('button[aria-label="Reset view"]').attributes('disabled')).toBeUndefined()
    expect(bar.get('button[aria-label="Fullscreen"]').exists()).toBe(true)
    expect(bar.get('a[download]').attributes('aria-label')).toBe('Download')
    // Fullscreen fills the screen with the report and its bar together.
    expect(w.element.hasAttribute('data-stage-panel')).toBe(true)
  })

  it('Reset view opens the PDF again as it first opened, without fetching it again', async () => {
    const w = mountReport()
    await flushPromises()
    const before = w.get('iframe').element
    await w.get('button[aria-label="Reset view"]').trigger('click')
    const after = w.get('iframe')
    expect(after.element).not.toBe(before)
    expect(after.attributes('src')).toBe('blob:report-1')
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  })

  it('asks for the report alone on a desktop: no time zone, no page images', async () => {
    mountReport()
    await flushPromises()
    expect(vi.mocked(fetch).mock.calls.map(c => c[0])).toEqual([urls.report])
  })

  it('shows the page images on a touch device, whose iframe would show page 1 only', async () => {
    vi.mocked(prefersTouchReader).mockReturnValue(true)
    const w = mountReport()
    await flushPromises()
    expect(w.find('iframe').exists()).toBe(false)
    const pages = w.getComponent(ReportPages)
    expect(pages.props('pages')).toEqual(PAGES.pages)
    expect(pages.props('pageUrl')).toBe(urls.reportPage)
    expect(vi.mocked(fetch).mock.calls.map(c => c[0]).sort()).toEqual([urls.report, urls.reportPages].sort())
  })

  it('offers Open (the system viewer: every page, pinch zoom) and Download on a touch device', async () => {
    vi.mocked(prefersTouchReader).mockReturnValue(true)
    const w = mountReport()
    await flushPromises()
    const bar = w.getComponent(StageControls)
    const open = bar.get('a[target="_blank"]')
    expect(open.attributes('href')).toBe('blob:report-1')
    expect(open.attributes('rel')).toBe('noopener')
    expect(open.attributes('aria-label')).toBe('Open')
    expect(bar.get('a[download]').attributes('href')).toBe('blob:report-1')
    expect(bar.get('button[aria-label="Reset view"]').attributes('disabled')).toBeUndefined()
  })

  it('Reset view on a touch device scrolls back to the first page', async () => {
    vi.mocked(prefersTouchReader).mockReturnValue(true)
    const w = mountReport()
    await flushPromises()
    const scroller = w.get('[data-report-pages]').element as HTMLElement
    const scrollTo = vi.fn()
    scroller.scrollTo = scrollTo as unknown as typeof scroller.scrollTo
    await w.get('button[aria-label="Reset view"]').trigger('click')
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 })
  })

  it('uses the page images on a desktop whose browser will not show a PDF inline', async () => {
    setViewer(false)
    const w = mountReport()
    await flushPromises()
    expect(w.find('iframe').exists()).toBe(false)
    expect(w.findComponent(ReportPages).exists()).toBe(true)
  })

  it('shows the error when the page list fails, and Try again asks for both again', async () => {
    vi.mocked(prefersTouchReader).mockReturnValue(true)
    let pagesCalls = 0
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (!String(url).endsWith('/report/pages')) return pdfRes()
      pagesCalls++
      return pagesCalls === 1 ? jsonRes(503, { detail: { code: 'x', summary: 'The pages could not be read.' } }) : jsonRes(200, PAGES)
    }))
    const w = mountReport()
    await flushPromises()
    expect(w.text()).toContain('The pages could not be read.')
    expect(w.findComponent(ReportPages).exists()).toBe(false)
    await w.get('[data-state="error"] button').trigger('click')
    await flushPromises()
    expect(w.findComponent(ReportPages).exists()).toBe(true)
  })

  it('shows the backend summary on 503', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonRes(503, {
      detail: { code: 'input_unreadable', summary: 'An imaging input could not be read; try again.' },
    })))
    const w = mountReport()
    await flushPromises()
    expect(w.text()).toContain('An imaging input could not be read; try again.')
    expect(w.find('iframe').exists()).toBe(false)
    expect(w.find('a[download]').exists()).toBe(false)
  })

  it('says there is no report for a scan that has none', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonRes(404, { detail: { code: 'no_report', summary: 'x' } })))
    const w = mountReport()
    await flushPromises()
    expect(w.text()).toContain('No report is available for this scan.')
  })

  it('shows the backend summary for other errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonRes(503, { detail: { code: 'input_unreadable', summary: 'Your files could not be read.' } })))
    const w = mountReport()
    await flushPromises()
    expect(w.text()).toContain('Your files could not be read.')
  })

  it('refetches only the report on Try again, without touching the session', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(jsonRes(503, { detail: { code: 'report_unavailable', summary: 'Nope.' } }))
      .mockResolvedValueOnce(pdfRes())
    vi.stubGlobal('fetch', f)
    const reload = vi.fn(<T,>(fn: () => Promise<T>) => fn())
    const w = mountReport({ withReload: reload })
    await flushPromises()
    expect(reload).toHaveBeenCalledTimes(1)
    await w.get('button').trigger('click')
    await flushPromises()
    // Each attempt is one report request through withReload; nothing else was fetched.
    expect(f).toHaveBeenCalledTimes(2)
    expect(f.mock.calls.every(c => String(c[0]).includes('report.pdf'))).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
    expect(w.get('iframe').attributes('src')).toBe('blob:report-1')
    expect(revoke).not.toHaveBeenCalled()
  })

  it('makes its loading and error states the live region', async () => {
    let finish!: (r: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => { finish = r })))
    const w = mountReport()
    expect(w.get('[data-state="loading"]').attributes('role')).toBe('status')
    finish(jsonRes(503, { detail: { code: 'report_unavailable', summary: 'Nope.' } }))
    await flushPromises()
    expect(w.get('[data-state="error"]').attributes('role')).toBe('alert')
    expect(w.findAll('[role="alert"],[role="status"]')).toHaveLength(1)
  })

  it('ignores a slow first response after a retry', async () => {
    const resolvers: ((r: Response) => void)[] = []
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => { resolvers.push(r) })))
    const w = mountReport()
    const refetch = (w.vm as unknown as { refetch: () => Promise<void> }).refetch
    void refetch()
    resolvers[1]!(pdfRes())
    await flushPromises()
    create.mockReturnValue('blob:newer')
    resolvers[0]!(pdfRes())
    await flushPromises()
    expect(create).toHaveBeenCalledTimes(1)
    expect(w.get('iframe').attributes('src')).toBe('blob:report-1')
  })

  it('creates no object URL when a response arrives after unmount', async () => {
    let finish!: (r: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => { finish = r })))
    const w = mountReport()
    w.unmount()
    finish(pdfRes())
    await flushPromises()
    expect(create).not.toHaveBeenCalled()
  })

  it('revokes the previous object URL when refetching', async () => {
    const w = mountReport()
    await flushPromises()
    create.mockReturnValue('blob:report-2')
    ;(w.vm as unknown as { refetch: () => void }).refetch()
    await flushPromises()
    expect(revoke).toHaveBeenCalledWith('blob:report-1')
    expect(w.get('iframe').attributes('src')).toBe('blob:report-2')
  })

  it('revokes the object URL on unmount', async () => {
    const w = mountReport()
    await flushPromises()
    w.unmount()
    expect(revoke).toHaveBeenCalledWith('blob:report-1')
  })

  it('aborts the request on unmount without showing an error', async () => {
    let signal: AbortSignal | undefined
    vi.stubGlobal('fetch', vi.fn((_u: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined
      return new Promise((_r, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    }))
    const w = mountReport()
    w.unmount()
    await flushPromises()
    expect(signal?.aborted).toBe(true)
    expect(create).not.toHaveBeenCalled()
  })

  it('re-posts through withReload on a 409', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(jsonRes(409, { detail: { code: 'assay_not_loaded', summary: 's' } }))
      .mockResolvedValueOnce(pdfRes())
    vi.stubGlobal('fetch', f)
    const reload = vi.fn(async <T,>(fn: () => Promise<T>) => {
      try { return await fn() } catch { return fn() }
    })
    const w = mountReport({ withReload: reload })
    await flushPromises()
    expect(reload).toHaveBeenCalled()
    expect(w.find('iframe').exists()).toBe(true)
  })
})
