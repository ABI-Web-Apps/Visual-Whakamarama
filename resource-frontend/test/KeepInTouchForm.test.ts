import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import KeepInTouchForm from '../src/components/feedback/KeepInTouchForm.vue'
import { postSubscriber } from '../src/feedback/api'
import { classifyContact } from '../src/feedback/contactKind'

vi.mock('../src/feedback/api', () => ({ postSubscriber: vi.fn(async () => {}) }))

describe('classifyContact (the backend\'s own rule)', () => {
  it('knows an email address', () => {
    expect(classifyContact(' Kia@Ora.NZ ')).toBe('email')
  })
  it('knows a mobile number written the usual ways', () => {
    expect(classifyContact('021 123 4567')).toBe('phone')
    expect(classifyContact('+64 (21) 123-4567')).toBe('phone')
    expect(classifyContact('021.123.4567')).toBe('phone')
  })
  it('refuses anything else', () => {
    expect(classifyContact('hello')).toBeNull()
    expect(classifyContact('123')).toBeNull()
    expect(classifyContact('name@')).toBeNull()
    expect(classifyContact('')).toBeNull()
  })
})

describe('KeepInTouchForm', () => {
  beforeEach(() => { vi.mocked(postSubscriber).mockReset().mockResolvedValue() })
  afterEach(() => { document.body.innerHTML = '' })

  it('has the client\'s wording', () => {
    const text = mount(KeepInTouchForm).text()
    expect(text).toContain('Stay in touch')
    expect(text).toContain('We\'ll let you know how the project is going.')
    expect(text).toContain('Optional: your first name')
    expect(text).toContain('So we know what to call you.')
    expect(text).toContain('Your email or mobile number')
    expect(text).toContain('We\'ll only use this to contact you about this project. It is kept separate from your feedback and never shared. You can ask to be removed at any time.')
  })

  it('labels both fields and helps the browser fill them', () => {
    const w = mount(KeepInTouchForm)
    const name = w.get('input[autocomplete="given-name"]')
    expect(name.attributes('placeholder')).toBe('First name')
    expect(name.attributes('maxlength')).toBe('60')
    const contact = w.get('input[autocomplete="email"]')
    expect(contact.attributes('placeholder')).toBe('e.g. name@email.com or 021 123 4567')
    expect(contact.attributes('inputmode')).toBe('email')
    for (const input of [name, contact]) {
      expect(w.find(`label[for="${input.attributes('id')}"]`).exists()).toBe(true)
    }
  })

  it('asks for a usable email or number before sending anything', async () => {
    const w = mount(KeepInTouchForm, { attachTo: document.body })
    await w.get('input[autocomplete="email"]').setValue('hello')
    await w.get('form').trigger('submit')
    expect(postSubscriber).not.toHaveBeenCalled()
    const contact = w.get('input[autocomplete="email"]')
    expect(contact.attributes('aria-invalid')).toBe('true')
    const message = w.get(`#${contact.attributes('aria-describedby')!.split(' ')[0]}`)
    expect(message.text()).toBe('Enter an email address or a mobile number.')
  })

  it('sends the first name (if any) and the contact, trimmed, then says so', async () => {
    const w = mount(KeepInTouchForm)
    await w.get('input[autocomplete="given-name"]').setValue('  Aroha ')
    await w.get('input[autocomplete="email"]').setValue(' aroha@example.nz ')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(postSubscriber).toHaveBeenCalledWith({ first_name: 'Aroha', contact: 'aroha@example.nz' })
    expect(w.text()).toContain('You\'re on the list')
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('moves focus to the confirmation once signed up', async () => {
    const w = mount(KeepInTouchForm, { attachTo: document.body })
    await w.get('input[autocomplete="email"]').setValue('aroha@example.nz')
    await w.get('form').trigger('submit')
    await flushPromises()
    const done = w.get('[data-keep-in-touch-done]')
    expect(done.attributes('tabindex')).toBe('-1')
    expect(document.activeElement).toBe(done.element)
  })

  it('comes back blank three seconds later, ready for the next person', async () => {
    vi.useFakeTimers()
    const w = mount(KeepInTouchForm, { attachTo: document.body })
    await w.get('input[autocomplete="given-name"]').setValue('Aroha')
    await w.get('input[autocomplete="email"]').setValue('aroha@example.nz')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.find('[data-keep-in-touch-done]').exists()).toBe(true)
    vi.advanceTimersByTime(2900)
    await flushPromises()
    expect(w.find('[data-keep-in-touch-done]').exists()).toBe(true)
    vi.advanceTimersByTime(200)
    await flushPromises()
    expect(w.find('[data-keep-in-touch-done]').exists()).toBe(false)
    expect((w.get('input[autocomplete="given-name"]').element as HTMLInputElement).value).toBe('')
    expect((w.get('input[autocomplete="email"]').element as HTMLInputElement).value).toBe('')
    // Focus stays in the form rather than falling to the page.
    expect(document.activeElement).toBe(w.get('input[autocomplete="given-name"]').element)
    vi.useRealTimers()
  })

  it('works without a name', async () => {
    const w = mount(KeepInTouchForm)
    await w.get('input[autocomplete="email"]').setValue('021 123 4567')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(postSubscriber).toHaveBeenCalledWith({ first_name: '', contact: '021 123 4567' })
  })

  it('shows the backend\'s reason and keeps what was typed', async () => {
    vi.mocked(postSubscriber).mockRejectedValueOnce({ status: 429, summary: 'Too many messages — please try again later.' })
    const w = mount(KeepInTouchForm)
    await w.get('input[autocomplete="email"]').setValue('aroha@example.nz')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toBe('Too many messages — please try again later.')
    expect((w.get('input[autocomplete="email"]').element as HTMLInputElement).value).toBe('aroha@example.nz')
  })

  it('never shows an empty error box', async () => {
    vi.mocked(postSubscriber).mockRejectedValueOnce({})
    const w = mount(KeepInTouchForm)
    await w.get('input[autocomplete="email"]').setValue('aroha@example.nz')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toBe('Your details could not be saved. Please try again.')
  })

  it('splits into copy and form side by side on a wide page', () => {
    const w = mount(KeepInTouchForm, { props: { layout: 'split' } })
    expect(w.get('[data-keep-in-touch]').classes()).toContain('md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]')
  })
})
