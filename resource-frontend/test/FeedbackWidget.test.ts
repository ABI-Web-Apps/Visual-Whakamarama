import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import FeedbackWidget from '../src/components/feedback/FeedbackWidget.vue'
import { postFeedback } from '../src/feedback/api'
import { provideFeedbackDialog, useFeedbackDialog } from '../src/feedback/useFeedbackDialog'
import type { FeedbackDialog } from '../src/feedback/useFeedbackDialog'
import { useTourStore } from '../src/stores/tour'
import { useViewerStore } from '../src/stores/viewer'

vi.mock('../src/feedback/api', () => ({
  postFeedback: vi.fn(async () => ({ id: 'u-1', created_at: 't' })),
  postSubscriber: vi.fn(async () => {}),
}))

const AppLinkStub = { props: ['to'], template: '<a :href="to"><slot /></a>' }
let dialog!: FeedbackDialog

/** As App.vue mounts it: a provider, the widget, and something else that opens it. */
function mountWidget() {
  const Opener = defineComponent({ setup() { dialog = useFeedbackDialog()!; return () => null } })
  return mount(defineComponent({
    setup() { provideFeedbackDialog(); return () => h('div', [h(FeedbackWidget), h(Opener)]) },
  }), { global: { stubs: { AppLink: AppLinkStub } }, attachTo: document.body })
}

const launcher = (w: ReturnType<typeof mountWidget>) => w.get('[data-feedback-launcher]')
const tabNamed = (w: ReturnType<typeof mountWidget>, name: string) => w.findAll('[role="tab"]').find(t => t.text() === name)!
/** The floating button opens on Stay in touch; these tests are about the feedback note. */
async function openFeedback(w: ReturnType<typeof mountWidget>) {
  await launcher(w).trigger('click')
  await tabNamed(w, 'Feedback').trigger('click')
}

describe('FeedbackWidget', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(postFeedback).mockResolvedValue({ id: 'u-1', created_at: 't' })
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('is a button named Feedback, on every page, that opens a modal dialog', async () => {
    const w = mountWidget()
    expect(launcher(w).element.tagName).toBe('BUTTON')
    expect(launcher(w).attributes('aria-label')).toBe('Feedback')
    expect(launcher(w).attributes('aria-haspopup')).toBe('dialog')
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    await launcher(w).trigger('click')
    const d = w.get('[role="dialog"]')
    expect(d.attributes('aria-modal')).toBe('true')
    expect(d.attributes('aria-labelledby')).toBeTruthy()
    expect(document.getElementById(d.attributes('aria-labelledby')!)!.textContent).toContain('Stay in touch')
    expect(launcher(w).attributes('aria-expanded')).toBe('true')
  })

  it('closes on Escape and on the scrim, and gives focus back to the button', async () => {
    const w = mountWidget()
    await launcher(w).trigger('click')
    await w.get('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(document.activeElement).toBe(launcher(w).element)

    await launcher(w).trigger('click')
    await w.get('[data-feedback-scrim]').trigger('click')
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })

  it('has a Close button inside the dialog', async () => {
    const w = mountWidget()
    await launcher(w).trigger('click')
    await w.get('[role="dialog"] button[aria-label="Close"]').trigger('click')
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })

  it('keeps Tab inside the dialog while it is open', async () => {
    const w = mountWidget()
    await launcher(w).trigger('click')
    const focusables = w.get('[role="dialog"]').findAll('button:not([disabled]), textarea, a[href], [tabindex="0"]')
    const last = focusables[focusables.length - 1]!.element as HTMLElement
    last.focus()
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    last.dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(true)
  })

  it('keeps an unsent draft when it is closed and opened again', async () => {
    const w = mountWidget()
    await openFeedback(w)
    await w.get('textarea').setValue('half a thought')
    await w.get('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    await openFeedback(w)
    expect((w.get('textarea').element as HTMLTextAreaElement).value).toBe('half a thought')
  })

  it('closes itself a few seconds after sending, and starts the next one blank', async () => {
    vi.useFakeTimers()
    const w = mountWidget()
    await openFeedback(w)
    await w.get('textarea').setValue('All good')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.text()).toContain('Thank you — ngā mihi!')
    vi.advanceTimersByTime(5100)
    await flushPromises()
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    await openFeedback(w)
    expect((w.get('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('stays open after sending while the reader is using it', async () => {
    vi.useFakeTimers()
    const w = mountWidget()
    await openFeedback(w)
    await w.get('textarea').setValue('All good')
    await w.get('form').trigger('submit')
    await flushPromises()
    await w.get('[role="dialog"]').trigger('pointerdown')
    vi.advanceTimersByTime(8000)
    await flushPromises()
    expect(w.find('[role="dialog"]').exists()).toBe(true)
  })

  it('signing up keeps the dialog open, resets the form, and leaves an unsent note where it was', async () => {
    vi.useFakeTimers()
    const w = mountWidget()
    await openFeedback(w)
    await w.get('textarea').setValue('half a thought')
    await tabNamed(w, 'Stay in touch').trigger('click')
    await w.get('input[autocomplete="email"]').setValue('aroha@example.nz')
    await w.get('form').trigger('submit')
    await flushPromises()
    vi.advanceTimersByTime(5100)
    await flushPromises()
    expect(w.find('[role="dialog"]').exists()).toBe(true)
    expect((w.get('input[autocomplete="email"]').element as HTMLInputElement).value).toBe('')
    await tabNamed(w, 'Feedback').trigger('click')
    expect((w.get('textarea').element as HTMLTextAreaElement).value).toBe('half a thought')
  })

  it('after sending, the Feedback tab starts blank, so a note cannot be sent twice', async () => {
    const w = mountWidget()
    await openFeedback(w)
    await w.get('textarea').setValue('Sent once')
    await w.get('form').trigger('submit')
    await flushPromises()
    await w.get('[data-feedback-sent] button').trigger('click')
    await tabNamed(w, 'Feedback').trigger('click')
    expect((w.get('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('puts Stay in touch first and opens on it, with Feedback beside it', async () => {
    const w = mountWidget()
    await launcher(w).trigger('click')
    await flushPromises()
    const tabs = w.findAll('[role="tab"]')
    expect(tabs.map(t => t.text())).toEqual(['Stay in touch', 'Feedback'])
    expect(tabs[0]!.attributes('aria-selected')).toBe('true')
    expect(w.get('[role="tabpanel"]').text()).toContain('Your email or mobile number')
    // Focus goes to the chosen tab, not a field: no phone keyboard pops up.
    expect(document.activeElement).toBe(tabs[0]!.element)

    await tabs[1]!.trigger('click')
    expect(w.get('[role="tab"][aria-selected="true"]').text()).toBe('Feedback')
    // The dialog is named by what it now shows.
    const d = w.get('[role="dialog"]')
    expect(document.getElementById(d.attributes('aria-labelledby')!)!.textContent).toContain('Quick feedback')
  })

  it('opens on Feedback, a face focused, when a Send feedback button asks for it', async () => {
    const w = mountWidget()
    dialog.open('feedback')
    await flushPromises()
    expect(w.get('[role="tab"][aria-selected="true"]').text()).toBe('Feedback')
    expect(document.activeElement?.getAttribute('role')).toBe('radio')
  })

  it('offers Stay in touch from the thank-you', async () => {
    const w = mountWidget()
    await openFeedback(w)
    await w.get('textarea').setValue('All good')
    await w.get('form').trigger('submit')
    await flushPromises()
    await w.get('[data-feedback-sent] button').trigger('click')
    expect(w.get('[role="tab"][aria-selected="true"]').text()).toBe('Stay in touch')
  })

  it('gives focus back to whatever opened it, not always the floating button', async () => {
    const Opener2 = defineComponent({
      setup() {
        const d = useFeedbackDialog()!
        return () => h('button', { 'data-page-opener': '', 'onClick': () => d.open() }, 'Send feedback')
      },
    })
    const w = mount(defineComponent({
      setup() { provideFeedbackDialog(); return () => h('div', [h(FeedbackWidget), h(Opener2)]) },
    }), { global: { stubs: { AppLink: AppLinkStub } }, attachTo: document.body })
    const opener = w.get('[data-page-opener]')
    ;(opener.element as HTMLElement).focus()
    await opener.trigger('click')
    await flushPromises()
    await w.get('[role="dialog"]').trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(document.activeElement).toBe(opener.element)
  })

  it('can be opened from elsewhere in the app (About, Contact us)', async () => {
    const w = mountWidget()
    dialog.open()
    await flushPromises()
    expect(w.find('[role="dialog"]').exists()).toBe(true)
  })

  it('stays out of the way of the guided tour, and above its invitation', async () => {
    const w = mountWidget()
    const tour = useTourStore()
    tour.active = true
    await flushPromises()
    expect(w.find('[data-feedback-launcher]').exists()).toBe(false)
    tour.active = false
    tour.launcherShown = true
    await flushPromises()
    expect(launcher(w).attributes('data-lifted')).toBe('true')
  })

  it('is not offered on the team\'s own inbox', async () => {
    const { useAppRouter } = await import('../src/navigation/router')
    let router!: ReturnType<typeof useAppRouter>
    const Nav = defineComponent({ setup() { router = useAppRouter(); return () => null } })
    const w = mount(defineComponent({
      setup() { provideFeedbackDialog(); return () => h('div', [h(FeedbackWidget), h(Nav)]) },
    }), { global: { stubs: { AppLink: AppLinkStub } }, attachTo: document.body })
    await router.navigateTo('/feedback-review')
    await flushPromises()
    expect(w.find('[data-feedback-launcher]').exists()).toBe(false)
  })

  it('moves above the stage controls when the content column is collapsed on a desktop', async () => {
    const w = mountWidget()
    const viewer = useViewerStore()
    viewer.contentOpen = false
    await flushPromises()
    expect(launcher(w).attributes('data-over-stage')).toBe('true')
  })

  it('hides behind the open menu drawer on a phone or tablet', async () => {
    const w = mountWidget()
    useViewerStore().sidebarOpen = true
    await flushPromises()
    expect(launcher(w).classes()).toContain('max-xl:hidden')
  })
})
