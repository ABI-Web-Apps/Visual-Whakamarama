import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EmailButton from '../src/components/contact/EmailButton.vue'
import { TOAST_KEY } from '../src/composables/useToast'
import { gmailComposeHref, outlookComposeHref } from '../src/content/contact'
import { copyText } from '../src/utils/clipboard'

vi.mock('../src/utils/clipboard', () => ({ copyText: vi.fn(async () => true) }))

const EMAIL = 'a.trevarton@auckland.ac.nz'
const SUBJECT = encodeURIComponent('About Visual Whakamārama')
const show = vi.fn()

function mountButton() {
  return mount(EmailButton, {
    props: { email: EMAIL, name: 'Dr Alex Trevarton' },
    global: { provide: { [TOAST_KEY as symbol]: { message: { value: null }, show } } },
    attachTo: document.body,
  })
}

/** Click the address; then either a mail app takes the focus, or nothing happens. */
async function clickAddress(w: ReturnType<typeof mountButton>, mailAppOpens: boolean) {
  await w.get('a[href^="mailto:"]').trigger('click')
  await flushPromises()
  if (mailAppOpens) window.dispatchEvent(new Event('blur'))
  vi.advanceTimersByTime(1600)
  await flushPromises()
}

describe('EmailButton', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(copyText).mockResolvedValue(true)
  })
  afterEach(() => {
    vi.useRealTimers()
    show.mockReset()
    document.body.innerHTML = ''
  })

  it('is a real mailto link with the subject filled in, so the system mail app opens', () => {
    const link = mountButton().get('a')
    expect(link.attributes('href')).toBe(`mailto:${EMAIL}?subject=${SUBJECT}`)
    expect(link.text()).toContain(EMAIL)
    expect(link.attributes('aria-label')).toBe(`Email Dr Alex Trevarton at ${EMAIL}`)
  })

  it('copies the address too, and says so once a mail app has taken over', async () => {
    const w = mountButton()
    await clickAddress(w, true)
    expect(copyText).toHaveBeenCalledWith(EMAIL)
    expect(show).toHaveBeenCalledWith('Opening your email app — the address is copied too.')
    expect(w.find('[data-email-fallback]').exists()).toBe(false)
  })

  it('names the address when a mail app opened but copying was not possible', async () => {
    vi.mocked(copyText).mockResolvedValue(false)
    const w = mountButton()
    await clickAddress(w, true)
    expect(show).toHaveBeenCalledWith(`Opening your email app. The address is ${EMAIL}.`)
  })

  it('offers Outlook and Gmail on the web when no mail app opened', async () => {
    const w = mountButton()
    await clickAddress(w, false)
    expect(show).not.toHaveBeenCalledWith('Opening your email app — the address is copied too.')
    const panel = w.get('[data-email-fallback]')
    expect(panel.attributes('role')).toBe('status')
    expect(panel.text()).toContain('No email app opened.')
    expect(panel.text()).toContain('The address is copied')
    const outlook = panel.get('a[data-webmail="outlook"]')
    const gmail = panel.get('a[data-webmail="gmail"]')
    expect(outlook.attributes('href')).toBe(outlookComposeHref(EMAIL))
    expect(gmail.attributes('href')).toBe(gmailComposeHref(EMAIL))
    for (const a of [outlook, gmail]) {
      expect(a.attributes('target')).toBe('_blank')
      expect(a.attributes('rel')).toContain('noopener')
    }
    await panel.get('button[aria-label="Close"]').trigger('click')
    expect(w.find('[data-email-fallback]').exists()).toBe(false)
  })

  it('gives the address in the panel when it could not be copied either', async () => {
    vi.mocked(copyText).mockResolvedValue(false)
    const w = mountButton()
    await clickAddress(w, false)
    expect(w.get('[data-email-fallback]').text()).toContain(EMAIL)
  })

  it('stops watching once it has unmounted', async () => {
    const w = mountButton()
    await w.get('a[href^="mailto:"]').trigger('click')
    w.unmount()
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow()
    expect(show).not.toHaveBeenCalled()
  })

  it('has a separate Copy button that copies without opening anything', async () => {
    const w = mountButton()
    const copy = w.get('button[aria-label^="Copy"]')
    expect(copy.attributes('aria-label')).toBe(`Copy ${EMAIL}`)
    await copy.trigger('click')
    await flushPromises()
    expect(copyText).toHaveBeenCalledWith(EMAIL)
    expect(show).toHaveBeenCalledWith('Email address copied.')
  })

  it('tells the reader the address when the Copy button cannot copy', async () => {
    vi.mocked(copyText).mockResolvedValue(false)
    const w = mountButton()
    await w.get('button[aria-label^="Copy"]').trigger('click')
    await flushPromises()
    expect(show).toHaveBeenCalledWith(`Copying isn't available here. The address is ${EMAIL}.`)
  })
})

describe('webmail compose links', () => {
  it('open a new message to the address with the subject filled in', () => {
    expect(outlookComposeHref('x@y.nz')).toBe(`https://outlook.office.com/mail/deeplink/compose?to=x%40y.nz&subject=${SUBJECT}`)
    expect(gmailComposeHref('x@y.nz')).toBe(`https://mail.google.com/mail/?view=cm&fs=1&to=x%40y.nz&su=${SUBJECT}`)
  })
})
