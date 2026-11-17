import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { centreDrawnFraction } from './helpers'

/**
 * My Report end to end: the sidebar entry, the 3D view with its colour key, and
 * the report column.
 *
 * Needs MinIO with the patient dataset uploaded to `measurements/workdir`, so
 * it runs only when MY_MRI_E2E=1. The base URL defaults to the Docker stack
 * (http://localhost:3159); point MY_MRI_BASE_URL at the dev server and set
 * MY_MRI_BACKEND=local to run against a local uvicorn, which cannot render
 * the report PDF (WeasyPrint needs the Docker image's system libraries).
 */
test.skip(process.env.MY_MRI_E2E !== '1', 'needs MinIO with the dataset; set MY_MRI_E2E=1')

const localBackend = process.env.MY_MRI_BACKEND === 'local'

test.use({
  baseURL: process.env.MY_MRI_BASE_URL ?? 'http://localhost:3159',
  viewport: { width: 1440, height: 900 },
})

/** The MRI column, a region named by its heading, so the report column's bar is never matched. */
const mriColumn = (page: Page) => page.getByRole('region', { name: 'MRI', exact: true })

test.describe('My Report', () => {
  test('opens from the sidebar with the scan and the report', async ({ page }) => {
    const report = page.waitForResponse(res => /\/api\/patients\/[^/]+\/[^/]+\/report\.pdf/.test(res.url()), { timeout: 120_000 })

    await page.goto('/')
    await page.getByRole('link', { name: /My Report/ }).first().click()

    await expect(page.getByRole('heading', { level: 1, name: 'My Report' })).toBeVisible()
    await expect(page.getByText(/contrast phase 1/)).toHaveCount(0)

    const viewer = page.getByRole('img', { name: 'Your MRI scan' })
    await expect(viewer.locator('canvas')).toHaveCount(1, { timeout: 120_000 })
    await expect(mriColumn(page).getByRole('button', { name: 'Reset view' })).toBeEnabled({ timeout: 120_000 })
    await expect.poll(() => centreDrawnFraction(viewer, { background: 'left-edge' }), {
      message: 'the scan is ready but drew nothing',
      timeout: 30_000,
    }).toBeGreaterThan(0.05)

    const key = page.getByRole('list', { name: 'Colour key' })
    await expect(key.getByText('Finding 1')).toBeVisible()
    await expect(key.getByText('Finding 2')).toBeVisible()

    const res = await report
    if (localBackend) {
      expect(res.status()).toBe(503)
      await expect(page.getByText('Report rendering needs the Docker backend.')).toBeVisible()
    } else {
      expect(res.status()).toBe(200)
      // Headless Chromium has no PDF viewer, so the report shows as links
      // rather than an iframe.
      await expect(page.getByRole('link', { name: 'Open report' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Download' })).toBeVisible()
    }
  })

  // The trackball's own wheel listener is on the canvas: only a real browser
  // shows whether a scroll moves the slice or the camera.
  test('the wheel zooms in every view; Ctrl+scroll moves through the slices', async ({ page }) => {
    await page.goto('/my-report')
    const viewer = page.getByRole('img', { name: 'Your MRI scan' })
    const reset = mriColumn(page).getByRole('button', { name: 'Reset view' })
    await expect(reset).toBeEnabled({ timeout: 120_000 })
    const views = page.getByRole('group', { name: 'View' })
    // The bar's readout, which follows every step (the live region waits for the wheel to stop).
    const readout = mriColumn(page).locator('p[aria-hidden="true"]')
    // My Report opens on the axial slice through the marked area.
    await expect(views.getByRole('button', { name: 'Axial' })).toHaveAttribute('aria-pressed', 'true')
    await expect(readout).toContainText(/\d+ \/ \d+/)
    const sliceOf = async () => Number(/(\d+) \/ \d+/.exec(await readout.innerText())![1])
    const start = await sliceOf()
    const box = (await viewer.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

    // The plain wheel zooms: the slice stays put, so any change on the stage is the camera moving.
    const before = await viewer.screenshot()
    for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -100)
    await expect.poll(async () => !(await viewer.screenshot()).equals(before), { message: 'scroll did not zoom' })
      .toBe(true)
    await page.waitForTimeout(500)
    expect(await sliceOf()).toBe(start)

    await page.keyboard.down('Control')
    for (let i = 0; i < 5; i++) await page.mouse.wheel(0, 100)
    await page.keyboard.up('Control')
    await expect.poll(sliceOf).toBe(start + 5)
    expect(await centreDrawnFraction(viewer, { background: 'left-edge' }), 'the single view drew nothing')
      .toBeGreaterThan(0.05)

    await views.getByRole('button', { name: '3D' }).click()
    await expect(readout).toHaveCount(0)
    // Reset goes back to how the page opened: the axial view, on its opening slice.
    await reset.click()
    await expect(views.getByRole('button', { name: 'Axial' })).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(sliceOf).toBe(start)
  })

  // a11y.spec.ts runs without the dataset, so My Report's own controls are scanned
  // here, with a single view open: the pressed view button and the slice readout.
  test('has no serious or critical axe violations with a single view open', async ({ page }) => {
    await page.goto('/my-report')
    await expect(mriColumn(page).getByRole('button', { name: 'Reset view' })).toBeEnabled({ timeout: 120_000 })
    await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Coronal' }).click()
    await expect(page.locator('[aria-live="polite"]')).toHaveText(/Slice \d+ of \d+$/)

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze()
    const blocking = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')
    expect(blocking.map(v => `${v.impact}/${v.id} on ${v.nodes.map(n => n.target.join(' ')).join(', ')}`)).toEqual([])
  })

  test('going to a case and back does not stack a second canvas', async ({ page }) => {
    await page.goto('/my-report')
    const viewer = page.getByRole('img', { name: 'Your MRI scan' })
    await expect(viewer.locator('canvas')).toHaveCount(1, { timeout: 120_000 })

    await page.getByRole('link', { name: 'Density A' }).first().click()
    await expect(page.getByRole('heading', { level: 1, name: 'My Report' })).toBeHidden()

    await page.getByRole('link', { name: /My Report/ }).first().click()
    await expect(page.getByRole('heading', { level: 1, name: 'My Report' })).toBeVisible()
    await expect(viewer.locator('canvas')).toHaveCount(1)
    await expect(page.locator('canvas')).toHaveCount(1)
  })
})
