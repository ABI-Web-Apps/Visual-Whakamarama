import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, KeepAlive, ref } from 'vue'
import { deleteFeedback, deleteSubscriber, fetchFeedback, fetchSubscribers } from '../src/feedback/api'
import type { FeedbackEntry, Subscriber } from '../src/feedback/types'
import FeedbackReviewPage from '../src/pages/FeedbackReviewPage.vue'

vi.mock('../src/feedback/api', () => ({
  fetchFeedback: vi.fn(),
  fetchSubscribers: vi.fn(),
  deleteFeedback: vi.fn(async () => {}),
  deleteSubscriber: vi.fn(async () => {}),
}))

const AppLinkStub = { props: ['to'], template: '<a :href="to"><slot /></a>' }

const FEEDBACK: FeedbackEntry[] = [
  { id: 'f-3', created_at: '2026-11-18T03:00:00.000Z', rating: 5, comment: 'Loved the 3D view', page: '/the-breast', device: 'phone', app_version: '2.0.3', mode: 'standalone' },
  { id: 'f-2', created_at: '2026-11-18T02:00:00.000Z', rating: 2, comment: 'MRI words were hard', page: '/density-a', device: 'desktop', app_version: '2.0.3', mode: 'plugin' },
  { id: 'f-1', created_at: '2026-11-18T01:00:00.000Z', rating: 4, comment: '', page: '/about', device: 'tablet', app_version: '2.0.3', mode: 'standalone' },
]
const SUBSCRIBERS: Subscriber[] = [
  { id: 's-2', created_at: '2026-11-18T02:30:00.000Z', first_name: 'Aroha', contact: 'aroha@example.nz', contact_type: 'email' },
  { id: 's-1', created_at: '2026-11-18T01:30:00.000Z', first_name: '', contact: '0211234567', contact_type: 'phone' },
]

function mountPage() {
  return mount(FeedbackReviewPage, { global: { stubs: { AppLink: AppLinkStub } }, attachTo: document.body })
}

async function unlock(w: ReturnType<typeof mountPage>, password = 'qwerty') {
  await w.get('input[type="password"]').setValue(password)
  await w.get('form[data-review-gate]').trigger('submit')
  await flushPromises()
}

const tab = (w: ReturnType<typeof mountPage>, name: RegExp) => w.findAll('[role="tab"]').find(t => name.test(t.text()))!

describe('FeedbackReviewPage', () => {
  beforeEach(() => {
    vi.mocked(fetchFeedback).mockReset().mockResolvedValue({ total: 3, items: FEEDBACK.map(e => ({ ...e })) })
    vi.mocked(fetchSubscribers).mockReset().mockResolvedValue({ total: 2, items: SUBSCRIBERS.map(s => ({ ...s })) })
    vi.mocked(deleteFeedback).mockReset().mockResolvedValue()
    vi.mocked(deleteSubscriber).mockReset().mockResolvedValue()
  })
  afterEach(() => { document.body.innerHTML = '' })

  it('asks for the password first, and shows nothing else', () => {
    const w = mountPage()
    expect(w.get('input[type="password"]').attributes('autocomplete')).toBe('current-password')
    expect(w.find('[data-review]').exists()).toBe(false)
    expect(fetchFeedback).not.toHaveBeenCalled()
  })

  it('says so on a wrong password, and clears the field', async () => {
    vi.mocked(fetchFeedback).mockRejectedValue({ status: 401, summary: 'Wrong password.' })
    const w = mountPage()
    await unlock(w, 'nope')
    expect(fetchFeedback).toHaveBeenCalledWith('nope')
    expect(w.get('[role="alert"]').text()).toBe('Wrong password.')
    expect((w.get('input[type="password"]').element as HTMLInputElement).value).toBe('')
    expect(w.find('[data-review]').exists()).toBe(false)
  })

  it('opens both lists with the right password, feedback newest first', async () => {
    const w = mountPage()
    await unlock(w)
    expect(fetchSubscribers).toHaveBeenCalledWith('qwerty')
    expect(tab(w, /^Feedback/).text()).toBe('Feedback (3)')
    expect(tab(w, /^Stay in touch/).text()).toBe('Stay in touch (2)')
    const entries = w.findAll('[data-feedback-entry]')
    expect(entries).toHaveLength(3)
    expect(entries[0]!.text()).toContain('Very easy')
    expect(entries[0]!.text()).toContain('Loved the 3D view')
    expect(entries[0]!.text()).toContain('/the-breast')
    expect(entries[0]!.text()).toContain('phone')
    expect(entries[2]!.text()).toContain('No comment')
  })

  it('sums them up: how many, and the average face', async () => {
    const w = mountPage()
    await unlock(w)
    expect(w.get('[data-stat="total"]').text()).toContain('3')
    expect(w.get('[data-stat="average"]').text()).toContain('3.7')
  })

  it('filters by face, by having a comment, and by words', async () => {
    const w = mountPage()
    await unlock(w)
    await w.get('[data-filter-rating="2"]').trigger('click')
    expect(w.findAll('[data-feedback-entry]').map(e => e.attributes('data-id'))).toEqual(['f-2'])
    await w.get('[data-filter-rating="2"]').trigger('click')
    await w.get('input[type="checkbox"]').setValue(true)
    expect(w.findAll('[data-feedback-entry]').map(e => e.attributes('data-id'))).toEqual(['f-3', 'f-2'])
    await w.get('input[type="search"]').setValue('mri')
    expect(w.findAll('[data-feedback-entry]').map(e => e.attributes('data-id'))).toEqual(['f-2'])
  })

  it('lists the sign-ups on their own tab', async () => {
    const w = mountPage()
    await unlock(w)
    await tab(w, /^Stay in touch/).trigger('click')
    const rows = w.findAll('[data-subscriber]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Aroha')
    expect(rows[0]!.get('a[href="mailto:aroha@example.nz"]').exists()).toBe(true)
    expect(rows[1]!.get('a[href="tel:0211234567"]').exists()).toBe(true)
  })

  it('deletes a feedback entry only after it is confirmed', async () => {
    const w = mountPage()
    await unlock(w)
    const second = () => w.get('[data-feedback-entry][data-id="f-2"]')
    await second().get('button[aria-label="Delete"]').trigger('click')
    await second().get('button[data-cancel-delete]').trigger('click')
    expect(deleteFeedback).not.toHaveBeenCalled()
    await second().get('button[aria-label="Delete"]').trigger('click')
    await second().get('button[data-confirm-delete]').trigger('click')
    await flushPromises()
    expect(deleteFeedback).toHaveBeenCalledWith('qwerty', 'f-2')
    expect(w.find('[data-feedback-entry][data-id="f-2"]').exists()).toBe(false)
    expect(tab(w, /^Feedback/).text()).toBe('Feedback (2)')
  })

  it('deletes a sign-up the same way', async () => {
    const w = mountPage()
    await unlock(w)
    await tab(w, /^Stay in touch/).trigger('click')
    const row = () => w.get('[data-subscriber][data-id="s-1"]')
    await row().get('button[aria-label="Delete"]').trigger('click')
    await row().get('button[data-confirm-delete]').trigger('click')
    await flushPromises()
    expect(deleteSubscriber).toHaveBeenCalledWith('qwerty', 's-1')
    expect(w.findAll('[data-subscriber]')).toHaveLength(1)
  })

  it('drops an entry someone else already deleted', async () => {
    vi.mocked(deleteFeedback).mockRejectedValue({ status: 404, summary: 'That entry no longer exists.' })
    const w = mountPage()
    await unlock(w)
    const entry = () => w.get('[data-feedback-entry][data-id="f-3"]')
    await entry().get('button[aria-label="Delete"]').trigger('click')
    await entry().get('button[data-confirm-delete]').trigger('click')
    await flushPromises()
    expect(w.find('[data-feedback-entry][data-id="f-3"]').exists()).toBe(false)
  })

  it('goes back to the password when the backend stops accepting it (a restart, a changed password)', async () => {
    const w = mountPage()
    await unlock(w)
    vi.mocked(fetchFeedback).mockRejectedValue({ status: 401, summary: 'Wrong password.' })
    await w.findAll('button').find(b => b.text() === 'Refresh')!.trigger('click')
    await flushPromises()
    expect(w.find('[data-review]').exists()).toBe(false)
    expect(w.get('[role="alert"]').text()).toBe('Please enter the password again.')
  })

  it('Lock forgets the password and the lists', async () => {
    const w = mountPage()
    await unlock(w)
    await w.findAll('button').find(b => b.text() === 'Lock')!.trigger('click')
    expect(w.find('[data-review]').exists()).toBe(false)
    expect(w.find('[data-feedback-entry]').exists()).toBe(false)
  })

  it('forgets them too when the page is left (kept alive, but locked)', async () => {
    const show = ref(true)
    const w = mount(defineComponent({
      setup: () => () => h(KeepAlive, null, [show.value ? h(FeedbackReviewPage) : h('div')]),
    }), { global: { stubs: { AppLink: AppLinkStub } } })
    await unlock(w as unknown as ReturnType<typeof mountPage>)
    expect(w.find('[data-review]').exists()).toBe(true)
    show.value = false
    await flushPromises()
    show.value = true
    await flushPromises()
    expect(w.find('[data-review]').exists()).toBe(false)
    expect(w.find('input[type="password"]').exists()).toBe(true)
  })

  it('exports the list on screen as a CSV file', async () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:csv')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clicked: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clicked.push(this.download) })
    const w = mountPage()
    await unlock(w)
    await w.findAll('button').find(b => b.text() === 'Export CSV')!.trigger('click')
    expect(create).toHaveBeenCalledTimes(1)
    expect(clicked[0]).toMatch(/^visual-whakamarama-feedback-\d{4}-\d{2}-\d{2}\.csv$/)
    await tab(w, /^Stay in touch/).trigger('click')
    await w.findAll('button').find(b => b.text() === 'Export CSV')!.trigger('click')
    expect(clicked[1]).toMatch(/^visual-whakamarama-stay-in-touch-\d{4}-\d{2}-\d{2}\.csv$/)
    vi.restoreAllMocks()
  })
})
