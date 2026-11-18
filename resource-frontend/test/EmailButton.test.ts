import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EmailButton from '../src/components/contact/EmailButton.vue'
import { TOAST_KEY } from '../src/composables/useToast'
import { copyText } from '../src/utils/clipboard'

vi.mock('../src/utils/clipboard', () => ({ copyText: vi.fn(async () => true) }))

const EMAIL = 'a.trevarton@auckland.ac.nz'
const show = vi.fn()

function mountButton() {
  return mount(EmailButton, {
    props: { email: EMAIL, name: 'Dr Alex Trevarton' },
    global: { provide: { [TOAST_KEY as symbol]: { message: { value: null }, show } } },
  })
}

describe('EmailButton', () => {
  beforeEach(() => { vi.mocked(copyText).mockResolvedValue(true) })
  afterEach(() => { show.mockReset() })

  it('is a real mailto link with the subject filled in, so the system mail app opens', () => {
    const link = mountButton().get('a')
    expect(link.attributes('href')).toBe(`mailto:${EMAIL}?subject=${encodeURIComponent('About Visual Whakamārama')}`)
    expect(link.text()).toContain(EMAIL)
    expect(link.attributes('aria-label')).toBe(`Email Dr Alex Trevarton at ${EMAIL}`)
  })

  it('also copies the address when clicked, and says both happened', async () => {
    const w = mountButton()
    await w.get('a').trigger('click')
    await flushPromises()
    expect(copyText).toHaveBeenCalledWith(EMAIL)
    expect(show).toHaveBeenCalledWith('Opening your email app — the address is copied too.')
  })

  it('names the address in the message when copying is not possible', async () => {
    vi.mocked(copyText).mockResolvedValue(false)
    const w = mountButton()
    await w.get('a').trigger('click')
    await flushPromises()
    expect(show).toHaveBeenCalledWith(`Opening your email app. The address is ${EMAIL}.`)
  })

  it('has a separate Copy button that copies without opening anything', async () => {
    const w = mountButton()
    const copy = w.get('button')
    expect(copy.attributes('aria-label')).toBe(`Copy ${EMAIL}`)
    await copy.trigger('click')
    await flushPromises()
    expect(copyText).toHaveBeenCalledWith(EMAIL)
    expect(show).toHaveBeenCalledWith('Email address copied.')
  })

  it('tells the reader the address when the Copy button cannot copy', async () => {
    vi.mocked(copyText).mockResolvedValue(false)
    const w = mountButton()
    await w.get('button').trigger('click')
    await flushPromises()
    expect(show).toHaveBeenCalledWith(`Copying isn't available here. The address is ${EMAIL}.`)
  })
})
