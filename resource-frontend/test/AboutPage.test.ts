import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AboutPage from '../src/pages/AboutPage.vue'
import { FEEDBACK_DIALOG_KEY } from '../src/feedback/useFeedbackDialog'

const AppLinkStub = { props: ['to'], template: '<a :href="to"><slot /></a>' }
const open = vi.fn()

function mountAbout() {
  return mount(AboutPage, {
    global: {
      stubs: { AppLink: AppLinkStub },
      provide: { [FEEDBACK_DIALOG_KEY as symbol]: { isOpen: { value: false }, open, close: vi.fn() } },
    },
  })
}

describe('AboutPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    open.mockReset()
  })

  it('opens the in-app feedback instead of linking to the old Google Form', async () => {
    const w = mountAbout()
    expect(w.find('a[href*="docs.google.com"]').exists()).toBe(false)
    const button = w.get('[data-feedback-open]')
    expect(button.text()).toBe('Send feedback')
    await button.trigger('click')
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('points to Contact us near the top', () => {
    expect(mountAbout().find('a[href="/contact"]').exists()).toBe(true)
  })
})
