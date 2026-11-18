import { devices, expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * The feedback button and dialog in a real browser: the parts happy-dom
 * cannot judge -- where things land on screen, and whether they cover
 * something the reader needs.
 *
 * The backend is mocked for the post, so this needs only `yarn dev`.
 */

/** Skip the first-visit tour invitation: it is not what these tests are about. */
async function skipTourInvite(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('teuma.tour.seen', '1') } catch {} })
}

function intersects(a: { x: number, y: number, width: number, height: number }, b: { x: number, y: number, width: number, height: number }) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

// The iPhone's size, touch and user agent, in this project's Chromium (a
// describe block cannot switch browser type).
const { defaultBrowserType: _browser, ...iPhone } = devices['iPhone 13']

test.describe('feedback on a phone', () => {
  test.use({ ...iPhone, viewport: { width: 390, height: 844 } })

  test('opens as a bottom sheet whose Send button is on screen', async ({ page }) => {
    await skipTourInvite(page)
    await page.goto('/the-breast')
    await page.getByRole('button', { name: 'Feedback' }).click()
    await page.getByRole('tab', { name: 'Feedback' }).click() // it opens on Stay in touch
    const dialog = page.getByRole('dialog', { name: 'Quick feedback' })
    await expect(dialog).toBeVisible()
    await page.waitForTimeout(500) // the slide-up
    const sheet = (await dialog.boundingBox())!
    expect(Math.round(sheet.y + sheet.height)).toBe(844)
    expect(Math.round(sheet.width)).toBe(390)
    const send = (await dialog.getByRole('button', { name: 'Send' }).boundingBox())!
    expect(send.y + send.height).toBeLessThanOrEqual(844)
  })
})

test.describe('feedback button on a phone, while reading', () => {
  test.use({ ...iPhone, viewport: { width: 390, height: 844 } })

  test('fades and slides away while the reader scrolls down', async ({ page }) => {
    await skipTourInvite(page)
    await page.goto('/the-breast')
    const launcher = page.locator('[data-feedback-launcher]')
    await expect(launcher).toBeVisible()
    await page.waitForTimeout(1300) // its entrance has played
    // Scroll down the way a finger does: a run of small steps.
    await page.locator('#main-content').evaluate(async (el) => {
      for (let i = 0; i < 6; i++) {
        el.scrollTop += 50
        await new Promise(r => setTimeout(r, 40))
      }
    })
    await page.waitForTimeout(350) // the fade (300ms), well inside the 700ms before it returns
    expect(await launcher.evaluate(el => Number(getComputedStyle(el).opacity))).toBeLessThan(0.05)
    // And back once the reader stops.
    await expect.poll(() => launcher.evaluate(el => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0.95)
    // Slid, not jumped: the move is part of the transition.
    expect(await launcher.evaluate(el => getComputedStyle(el).transitionProperty)).toContain('translate')
  })
})

test.describe('feedback on a desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('the button never covers a stage control, even with the text column collapsed', async ({ page }) => {
    await skipTourInvite(page)
    await page.goto('/the-breast')
    const launcher = page.locator('[data-feedback-launcher]')
    await expect(launcher).toBeVisible()
    for (const collapsed of [false, true]) {
      if (collapsed) {
        await page.getByRole('button', { name: 'Toggle content panel' }).click()
        await page.waitForTimeout(500) // the column's width transition and the button's move
      }
      const box = (await launcher.boundingBox())!
      const controls = page.locator('[data-stage-panel] button:visible, [data-stage-panel] a:visible')
      for (const control of await controls.all()) {
        const c = await control.boundingBox()
        if (c) expect(intersects(box, c), `covers a stage control (collapsed: ${collapsed})`).toBe(false)
      }
    }
  })

  test('stays clear of the tour invitation, even with the text column collapsed', async ({ page }) => {
    // A first visit: the invitation card is showing.
    await page.goto('/the-breast')
    const invite = page.locator('[data-tour-launcher]')
    await expect(invite).toBeVisible()
    await page.getByRole('button', { name: 'Toggle content panel' }).click()
    await page.waitForTimeout(600)
    const button = (await page.locator('[data-feedback-launcher]').boundingBox())!
    const card = (await invite.boundingBox())!
    expect(intersects(button, card)).toBe(false)
  })

  test('lifts under the pointer once it has arrived', async ({ page }) => {
    await skipTourInvite(page)
    await page.goto('/the-breast')
    const launcher = page.locator('[data-feedback-launcher]')
    await page.waitForTimeout(1300) // its entrance has played
    await launcher.hover()
    await page.waitForTimeout(400) // the lift's own transition
    expect(await launcher.evaluate(el => getComputedStyle(el).transform)).toBe('matrix(1, 0, 0, 1, 0, -2)')
  })

  test('sends a note and thanks the reader', async ({ page }) => {
    await skipTourInvite(page)
    let posted: unknown = null
    await page.route('**/api/feedback', async (route) => {
      posted = route.request().postDataJSON()
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'u-1', created_at: '2026-11-18T00:00:00.000Z' }) })
    })
    await page.goto('/density-a')
    await page.getByRole('button', { name: 'Feedback' }).click()
    await page.getByRole('tab', { name: 'Feedback' }).click() // it opens on Stay in touch
    const dialog = page.getByRole('dialog', { name: 'Quick feedback' })
    await dialog.getByRole('radio', { name: 'Easy', exact: true }).click()
    await dialog.getByRole('textbox').fill('Clear, thank you')
    await dialog.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByText('Thank you — ngā mihi!')).toBeVisible()
    expect(posted).toMatchObject({ rating: 4, comment: 'Clear, thank you', page: '/density-a', device: 'desktop' })
    // It closes itself, a few seconds later.
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 8000 })
  })
})
