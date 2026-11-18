import { devices, expect, test } from '@playwright/test'
import type { Page, Route } from '@playwright/test'
import { PNG } from 'pngjs'

/**
 * My Report's page reader on a phone, against a mocked backend: the layout
 * questions happy-dom cannot answer -- whether Reset view really brings page 1
 * back when the page around it is what scrolled, and whether the pages scroll
 * in fullscreen, where nothing around them can. Needs only `yarn dev`.
 */

const { defaultBrowserType: _browser, ...iPhone } = devices['iPhone 13']
test.use({ ...iPhone, viewport: { width: 390, height: 844 } })

/** A white A4-shaped page with a few grey "lines", 1600px wide like the backend's. */
function pagePng(): Buffer {
  const png = new PNG({ width: 1600, height: 2263 })
  png.data.fill(255)
  for (let y = 200; y < 2100; y += 90) {
    for (let x = 150; x < 1450; x++) {
      for (let dy = 0; dy < 24; dy++) {
        const i = ((y + dy) * 1600 + x) * 4
        png.data[i] = png.data[i + 1] = png.data[i + 2] = 200
      }
    }
  }
  return PNG.sync.write(png)
}

async function mockBackend(page: Page) {
  const png = pagePng()
  await page.route('**/api/**', async (route: Route) => {
    const url = route.request().url()
    if (url.endsWith('/tool-config')) {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'event: complete\ndata: {"assay":"a-1","cases":["sub-1"]}\n\n',
      })
    }
    if (url.endsWith('/findings')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ findings: [] }) })
    }
    if (url.endsWith('/report/pages')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        // Two pages, as the dataset's PDF may have: taller than any phone screen.
        body: JSON.stringify({ version: 'abc', pages: [
          { width: 595, height: 842, text: 'Your breast MRI: what we found' },
          { width: 595, height: 842, text: 'Questions you may want to ask' },
        ] }),
      })
    }
    if (/\/report\/pages\/[01]\.png$/.test(url)) return route.fulfill({ status: 200, contentType: 'image/png', body: png })
    if (url.endsWith('/report.pdf')) return route.fulfill({ status: 200, contentType: 'application/pdf', body: Buffer.from('%PDF-1.7\n%%EOF') })
    // The scan itself is not what this is about: its column shows its own error.
    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: { code: 'no_mri', summary: 'x' } }) })
  })
}

async function openReport(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('teuma.tour.seen', '1') } catch {} })
  await mockBackend(page)
  await page.goto('/my-report')
  const image = page.locator('[data-report-pages] img').first()
  await expect.poll(() => image.evaluate(i => (i as HTMLImageElement).naturalWidth), { timeout: 30_000 }).toBe(1600)
  return page.getByRole('region', { name: 'Report', exact: true })
}

test('Reset view brings page 1 back after the page has scrolled past it', async ({ page }) => {
  const report = await openReport(page)
  const pages = page.locator('[data-report-pages]')
  // Read down: scroll whatever scrolls until the report's top is well above the screen.
  await pages.evaluate((el) => {
    el.scrollIntoView({ block: 'end' })
    let p: HTMLElement | null = el.parentElement
    while (p) { p.scrollTop += 600; p = p.parentElement }
  })
  expect(await pages.evaluate(el => el.getBoundingClientRect().top)).toBeLessThan(0)

  await report.getByRole('button', { name: 'Reset view' }).click()
  await expect.poll(() => pages.evaluate(el => Math.round(el.getBoundingClientRect().top))).toBeGreaterThanOrEqual(0)
  expect(await pages.evaluate(el => el.getBoundingClientRect().top)).toBeLessThan(200)
})

test('in fullscreen the pages scroll by themselves', async ({ page }) => {
  const report = await openReport(page)
  await report.getByRole('button', { name: 'Fullscreen' }).click()
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true)
  const pages = page.locator('[data-report-pages]')
  const box = await pages.evaluate(el => ({
    overflow: getComputedStyle(el).overflowY,
    scrollable: el.scrollHeight > el.clientHeight,
  }))
  expect(box).toEqual({ overflow: 'auto', scrollable: true })
  await pages.evaluate((el) => { el.scrollTop = 400 })
  expect(await pages.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
})
