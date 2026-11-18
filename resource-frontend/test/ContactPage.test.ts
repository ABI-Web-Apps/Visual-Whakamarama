import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { CONTACT_ADDRESS, CONTACT_PEOPLE, initials, mailtoHref } from '../src/content/contact'
import ContactPage from '../src/pages/ContactPage.vue'

const AppLinkStub = { props: ['to'], template: '<a :href="to"><slot /></a>' }

function mountPage() {
  return mount(ContactPage, { global: { stubs: { AppLink: AppLinkStub } } })
}

describe('contact content', () => {
  it('lists the two Co-Principal Investigators as the client gave them', () => {
    expect(CONTACT_PEOPLE).toEqual([
      { name: 'Dr Alex Trevarton', iwi: 'Ngāpuhi', role: 'Co-Principal Investigator', email: 'a.trevarton@auckland.ac.nz' },
      { name: 'Dr Jiali Xu', role: 'Co-Principal Investigator', email: 'jiali.xu@auckland.ac.nz' },
    ])
  })

  it('initials skip the title', () => {
    expect(initials('Dr Alex Trevarton')).toBe('AT')
    expect(initials('Dr Jiali Xu')).toBe('JX')
    expect(initials('Prof. Martyn Nash')).toBe('MN')
    expect(initials('Madonna')).toBe('M')
  })

  it('mailtoHref fills the subject, encoded', () => {
    expect(mailtoHref('x@y.nz')).toBe('mailto:x@y.nz?subject=About%20Visual%20Whakam%C4%81rama')
  })
})

describe('ContactPage', () => {
  it('opens with the heading and the invitation', () => {
    const w = mountPage()
    expect(w.get('h1').text()).toBe('Contact us')
    expect(w.text()).toContain('Want to know more about Visual Whakamārama? We\'d love to hear from you.')
  })

  it('gives each person their name, iwi, role, initials and email', () => {
    const w = mountPage()
    const people = w.findAll('[data-contact-person]')
    expect(people).toHaveLength(2)
    expect(people[0]!.get('h2').text()).toBe('Dr Alex Trevarton')
    expect(people[0]!.get('[data-iwi]').text()).toBe('Ngāpuhi')
    expect(people[0]!.text()).toContain('Co-Principal Investigator')
    expect(people[0]!.get('[data-initials]').text()).toBe('AT')
    expect(people[0]!.get('a[href^="mailto:"]').text()).toContain('a.trevarton@auckland.ac.nz')
    expect(people[1]!.get('h2').text()).toBe('Dr Jiali Xu')
    expect(people[1]!.find('[data-iwi]').exists()).toBe(false)
    expect(people[1]!.get('[data-initials]').text()).toBe('JX')
    expect(people[1]!.get('a[href^="mailto:"]').text()).toContain('jiali.xu@auckland.ac.nz')
  })

  it('gives the address, with a map link that opens outside the app', () => {
    const w = mountPage()
    const address = w.get('address')
    expect(address.text()).toContain(CONTACT_ADDRESS.org)
    for (const line of CONTACT_ADDRESS.lines) expect(address.text()).toContain(line)
    const map = w.get(`a[href="${CONTACT_ADDRESS.mapsUrl}"]`)
    expect(map.attributes('target')).toBe('_blank')
    expect(map.attributes('rel')).toContain('noopener')
  })

  it('links back to the resource', () => {
    expect(mountPage().get('a[href="/"]').text()).toContain('Back to the resource')
  })
})

describe('ContactPage and feedback', () => {
  it('offers the feedback dialog to someone with a quick note', async () => {
    const { FEEDBACK_DIALOG_KEY } = await import('../src/feedback/useFeedbackDialog')
    const open = (await import('vitest')).vi.fn()
    const w = mount(ContactPage, {
      global: {
        stubs: { AppLink: AppLinkStub },
        provide: { [FEEDBACK_DIALOG_KEY as symbol]: { isOpen: { value: false }, open, close: () => {} } },
      },
    })
    await w.get('[data-feedback-open]').trigger('click')
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('leaves the feedback line out where there is no dialog to open', () => {
    expect(mountPage().find('[data-feedback-open]').exists()).toBe(false)
  })
})
