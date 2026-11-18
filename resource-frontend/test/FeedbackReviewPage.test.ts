import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, KeepAlive, ref } from 'vue'
import { deleteFeedback, deleteSubscriber, fetchFeedback, fetchSubscribers } from '../src/feedback/api'
import type { FeedbackEntry, Subscriber } from '../src/feedback/types'
import FeedbackReviewPage from '../src/pages/FeedbackReviewPage.vue'
import { copyText } from '../src/utils/clipboard'

vi.mock('../src/utils/clipboard', () => ({ copyText: vi.fn(async () => true) }))
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
  { id: 's-2', created_at: '2026-11-18', first_name: 'Aroha', contact: 'aroha@example.nz', contact_type: 'email' },
  { id: 's-1', created_at: '2026-11-17', first_name: '', contact: '0211234567', contact_type: 'phone' },
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
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

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
    await second().get('button[data-delete]').trigger('click')
    await second().get('button[data-cancel-delete]').trigger('click')
    expect(deleteFeedback).not.toHaveBeenCalled()
    await second().get('button[data-delete]').trigger('click')
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
    await row().get('button[data-delete]').trigger('click')
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
    await entry().get('button[data-delete]').trigger('click')
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

  it('keeps the lists through a failed refresh, and says what failed', async () => {
    const w = mountPage()
    await unlock(w)
    vi.mocked(fetchFeedback).mockRejectedValue({ status: 502, summary: 'The inbox could not be loaded (HTTP 502).' })
    await w.findAll('button').find(b => b.text() === 'Refresh')!.trigger('click')
    await flushPromises()
    expect(w.find('[data-review]').exists()).toBe(true)
    expect(w.findAll('[data-feedback-entry]')).toHaveLength(3)
    expect(w.get('[data-review] [role="alert"]').text()).toBe('The inbox could not be loaded (HTTP 502).')
  })

  it('ignores a refresh that lands after Lock', async () => {
    const w = mountPage()
    await unlock(w)
    let finish!: (v: { total: number, items: FeedbackEntry[] }) => void
    vi.mocked(fetchFeedback).mockReturnValueOnce(new Promise((r) => { finish = r }))
    await w.findAll('button').find(b => b.text() === 'Refresh')!.trigger('click')
    await w.findAll('button').find(b => b.text() === 'Lock')!.trigger('click')
    finish({ total: 3, items: FEEDBACK.map(e => ({ ...e })) })
    await flushPromises()
    expect(w.find('[data-review]').exists()).toBe(false)
    expect(w.find('[data-feedback-entry]').exists()).toBe(false)
  })

  it('ignores an unlock that lands after the page was left', async () => {
    let finish!: (v: { total: number, items: FeedbackEntry[] }) => void
    vi.mocked(fetchFeedback).mockReturnValueOnce(new Promise((r) => { finish = r }))
    const show = ref(true)
    const w = mount(defineComponent({
      setup: () => () => h(KeepAlive, null, [show.value ? h(FeedbackReviewPage) : h('div')]),
    }), { global: { stubs: { AppLink: AppLinkStub } } })
    await w.get('input[type="password"]').setValue('qwerty')
    await w.get('form[data-review-gate]').trigger('submit')
    show.value = false
    await flushPromises()
    finish({ total: 3, items: FEEDBACK.map(e => ({ ...e })) })
    await flushPromises()
    show.value = true
    await flushPromises()
    expect(w.find('[data-review]').exists()).toBe(false)
  })

  it('has real tabs: ids, panels, and the arrow keys', async () => {
    const w = mountPage()
    await unlock(w)
    const feedbackTab = tab(w, /^Feedback/)
    expect(feedbackTab.attributes('aria-controls')).toBe(w.get('[role="tabpanel"]').attributes('id'))
    expect(w.get('[role="tabpanel"]').attributes('aria-labelledby')).toBe(feedbackTab.attributes('id'))
    await feedbackTab.trigger('keydown', { key: 'ArrowRight' })
    expect(tab(w, /^Stay in touch/).attributes('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(tab(w, /^Stay in touch/).element)
  })

  it('names what each Delete deletes, and Cancel puts focus back on it', async () => {
    const w = mountPage()
    await unlock(w)
    const del = w.get('[data-feedback-entry][data-id="f-2"] button[data-delete]')
    expect(del.attributes('aria-label')).toMatch(/^Delete the feedback from /)
    await del.trigger('click')
    await flushPromises()
    await w.get('[data-feedback-entry][data-id="f-2"] button[data-cancel-delete]').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(w.get('[data-feedback-entry][data-id="f-2"] button[data-delete]').element)
    await tab(w, /^Stay in touch/).trigger('click')
    expect(w.get('[data-subscriber][data-id="s-2"] button[data-delete]').attributes('aria-label')).toBe('Remove Aroha')
    expect(w.get('[data-subscriber][data-id="s-1"] button[data-delete]').attributes('aria-label')).toBe('Remove 0211234567')
  })

  it('shows each note\'s face, and copies its id', async () => {
    const w = mountPage()
    await unlock(w)
    const entry = w.get('[data-feedback-entry][data-id="f-3"]')
    expect(entry.find('[data-face] svg').exists()).toBe(true)
    await entry.get('button[data-copy-id]').trigger('click')
    await flushPromises()
    expect(copyText).toHaveBeenCalledWith('f-3')
  })

  it('shows a sign-up\'s day, not a time it does not have', async () => {
    const w = mountPage()
    await unlock(w)
    await tab(w, /^Stay in touch/).trigger('click')
    const row = w.get('[data-subscriber][data-id="s-2"]').text()
    expect(row).toContain('18 Nov 2026')
    expect(row).not.toMatch(/\d{1,2}:\d{2}/)
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

  it('exports every entry, whatever the filters, and gives Safari time to save it', async () => {
    let blob: Blob | undefined
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => { blob = b as Blob; return 'blob:csv' })
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const w = mountPage()
    await unlock(w)
    vi.useFakeTimers()
    await w.get('[data-filter-rating="2"]').trigger('click')
    await w.findAll('button').find(b => b.text() === 'Export CSV')!.trigger('click')
    const text = await blob!.text()
    expect(text.split('\r\n')).toHaveLength(4) // the header and all three entries
    vi.advanceTimersByTime(1000)
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60_000)
    expect(revoke).toHaveBeenCalledWith('blob:csv')
    vi.useRealTimers()
    vi.restoreAllMocks()
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
