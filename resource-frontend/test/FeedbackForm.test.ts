import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive } from 'vue'
import FeedbackForm from '../src/components/feedback/FeedbackForm.vue'
import { postFeedback } from '../src/feedback/api'
import type { FeedbackDraft } from '../src/feedback/types'

vi.mock('../src/feedback/api', () => ({ postFeedback: vi.fn(async () => ({ id: 'u-1', created_at: 't' })) }))

const AppLinkStub = { props: ['to'], template: '<a :href="to"><slot /></a>' }

/** The form as the widget holds it: the draft lives outside, so it survives a close. */
function mountForm(draft: FeedbackDraft = reactive({ rating: null, comment: '' })) {
  const sent = vi.fn()
  const w = mount(defineComponent({
    setup: () => () => h(FeedbackForm, {
      'rating': draft.rating,
      'onUpdate:rating': (v: FeedbackDraft['rating']) => { draft.rating = v },
      'comment': draft.comment,
      'onUpdate:comment': (v: string) => { draft.comment = v },
      'page': '/density-a',
      'onSent': sent,
    }),
  }), { global: { stubs: { AppLink: AppLinkStub } }, attachTo: document.body })
  return { w, draft, sent }
}

describe('FeedbackForm', () => {
  beforeEach(() => { vi.mocked(postFeedback).mockReset().mockResolvedValue({ id: 'u-1', created_at: 't' }) })
  afterEach(() => { document.body.innerHTML = '' })

  it('asks the client\'s two questions, with the privacy note', () => {
    const { w } = mountForm()
    const text = w.text()
    expect(text).toContain('Quick feedback')
    expect(text).toContain('No names. Skip anything you like.')
    expect(text).toContain('How easy was this interface to understand?')
    expect(text).toContain('What\'s one thing you\'d change?')
    expect(text).toContain('Please don\'t include personal or health details.')
    expect(w.get('textarea').attributes('placeholder')).toBe('Type here, in English or te reo Māori…')
    expect(w.get('textarea').attributes('maxlength')).toBe('1000')
  })

  it('offers five faces as one radio group, labelled from Very hard to Very easy', () => {
    const { w } = mountForm()
    const group = w.get('[role="radiogroup"]')
    expect(group.attributes('aria-label')).toBe('How easy was this interface to understand?')
    const radios = group.findAll('[role="radio"]')
    expect(radios.map(r => r.attributes('aria-label'))).toEqual(['Very hard', 'Hard', 'Okay', 'Easy', 'Very easy'])
    expect(radios.every(r => r.attributes('aria-checked') === 'false')).toBe(true)
  })

  it('selects a face on click, and the arrow keys move the choice', async () => {
    const { w, draft } = mountForm()
    const radios = () => w.findAll('[role="radio"]')
    await radios()[3]!.trigger('click')
    expect(draft.rating).toBe(4)
    expect(radios()[3]!.attributes('aria-checked')).toBe('true')
    expect(radios()[3]!.attributes('tabindex')).toBe('0')
    expect(radios()[0]!.attributes('tabindex')).toBe('-1')
    await radios()[3]!.trigger('keydown', { key: 'ArrowRight' })
    expect(draft.rating).toBe(5)
    await radios()[4]!.trigger('keydown', { key: 'ArrowLeft' })
    expect(draft.rating).toBe(4)
  })

  it('keeps Send disabled until there is a face or some text', async () => {
    const { w } = mountForm()
    const send = () => w.get('button[type="submit"]')
    expect(send().attributes('disabled')).toBeDefined()
    await w.get('textarea').setValue('   ')
    expect(send().attributes('disabled')).toBeDefined()
    await w.get('textarea').setValue('Bigger text please')
    expect(send().attributes('disabled')).toBeUndefined()
  })

  it('shows how many characters are left only near the limit', async () => {
    const { w } = mountForm()
    await w.get('textarea').setValue('a'.repeat(899))
    expect(w.find('[data-count]').exists()).toBe(false)
    await w.get('textarea').setValue('a'.repeat(950))
    expect(w.get('[data-count]').text()).toBe('50 characters left')
  })

  it('sends the face, the text and the page, then thanks the reader', async () => {
    const { w, sent } = mountForm()
    await w.findAll('[role="radio"]')[1]!.trigger('click')
    await w.get('textarea').setValue('The MRI words were hard')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(postFeedback).toHaveBeenCalledWith({ rating: 2, comment: 'The MRI words were hard' }, '/density-a')
    expect(w.text()).toContain('Thank you — ngā mihi!')
    expect(sent).toHaveBeenCalledTimes(1)
  })

  it('moves focus to the thank-you, so a screen reader hears it and keys stay in the dialog', async () => {
    const { w } = mountForm()
    await w.get('textarea').setValue('Clear')
    ;(w.get('button[type="submit"]').element as HTMLElement).focus()
    await w.get('form').trigger('submit')
    await flushPromises()
    const heading = w.get('[data-feedback-sent] h2')
    expect(heading.attributes('tabindex')).toBe('-1')
    expect(document.activeElement).toBe(heading.element)
  })

  it('keeps focus on Send while it sends (a disabled button would drop it)', async () => {
    let finish!: () => void
    vi.mocked(postFeedback).mockReturnValueOnce(new Promise((r) => { finish = () => r({ id: 'u', created_at: 't' }) }))
    const { w } = mountForm()
    await w.get('textarea').setValue('Clear')
    const send = w.get('button[type="submit"]')
    ;(send.element as HTMLElement).focus()
    await w.get('form').trigger('submit')
    expect(send.attributes('disabled')).toBeUndefined()
    expect(send.attributes('aria-disabled')).toBe('true')
    expect(document.activeElement).toBe(send.element)
    finish()
    await flushPromises()
  })

  it('keeps what was typed and says why when sending fails, and Send tries again', async () => {
    vi.mocked(postFeedback).mockRejectedValueOnce({ status: 0, summary: 'The server could not be reached. Check your connection and try again.' })
    const { w, draft, sent } = mountForm()
    await w.get('textarea').setValue('Keep this')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toContain('The server could not be reached.')
    expect(draft.comment).toBe('Keep this')
    expect(w.get('button[type="submit"]').attributes('disabled')).toBeUndefined()
    expect(sent).not.toHaveBeenCalled()
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(postFeedback).toHaveBeenCalledTimes(2)
    expect(sent).toHaveBeenCalledTimes(1)
  })

  it('offers the Contact us page to someone who would rather talk', () => {
    const { w } = mountForm()
    const link = w.get('a[href="/contact"]')
    expect(link.text()).toContain('Contact the team')
  })
})
