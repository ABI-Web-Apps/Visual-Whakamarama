import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ResultColumn from '../src/components/myImages/ResultColumn.vue'

const AppLinkStub = { props: ['to'], template: '<a :href="to"><slot /></a>' }

/**
 * My Images' MRI page has two viewers with the same controls. Each column is
 * a region named by its own heading, so a screen reader can tell them apart.
 */
describe('ResultColumn', () => {
  it('is a region named by its heading', () => {
    const wrapper = mount(ResultColumn, { props: { label: 'Current MRI' } })
    const section = wrapper.get('section')
    const id = section.attributes('aria-labelledby')
    expect(id).toBeTruthy()
    expect(wrapper.get('h2').attributes('id')).toBe(id)
  })

  it('names two columns differently', () => {
    const a = mount(ResultColumn, { props: { label: 'Current MRI' } })
    const b = mount(ResultColumn, { props: { label: '3D' } })
    expect(a.get('section').attributes('aria-labelledby')).not.toBe(b.get('section').attributes('aria-labelledby'))
  })

  it('keeps the heading as the region name when it is a link', () => {
    const wrapper = mount(ResultColumn, {
      props: { label: 'MRI', to: '/my-images/mri' },
      global: { stubs: { AppLink: AppLinkStub } },
    })
    expect(wrapper.get('h2').attributes('id')).toBe(wrapper.get('section').attributes('aria-labelledby'))
  })
})
