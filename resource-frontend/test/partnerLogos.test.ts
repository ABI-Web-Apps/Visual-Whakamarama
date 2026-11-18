import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import CaseSidebar from '../src/components/nav/CaseSidebar.vue'
import { organisations, shownLogos } from '../src/content/team'
import AboutPage from '../src/pages/AboutPage.vue'

const AppLinkStub = { props: ['to'], template: '<a :href="to"><slot /></a>' }

/**
 * The Breast Cancer Foundation NZ logo is hidden for now (client request,
 * 2026-11-18). Its people and its name in the text stay; only the mark goes.
 * Showing it again is `logoHidden: false` in content/team.ts.
 */
describe('partner logos', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('leaves the Breast Cancer Foundation NZ logo out, and keeps the others', () => {
    expect(shownLogos().map(o => o.name)).toEqual([
      'Iwi United Engaged',
      'Auckland Bioengineering Institute — Breast Biomechanics Research Group',
    ])
    // Still a partner, with its logo file kept for when it comes back.
    const bcf = organisations.find(o => o.name === 'Breast Cancer Foundation NZ')!
    expect(bcf.logo).toBe('breast-cancer-foundation-nz.webp')
    expect(bcf.logoHidden).toBe(true)
  })

  it('shows neither on About nor at the foot of the sidebar', () => {
    const about = mount(AboutPage, { global: { stubs: { AppLink: AppLinkStub } } })
    const sidebar = mount(CaseSidebar, { global: { stubs: { AppLink: AppLinkStub } } })
    for (const w of [about, sidebar]) {
      const srcs = w.findAll('img').map(i => i.attributes('src') ?? '')
      expect(srcs.some(s => s.includes('breast-cancer-foundation-nz'))).toBe(false)
      expect(srcs.some(s => s.includes('iwi-united-engaged'))).toBe(true)
    }
  })

  it('keeps the foundation\'s people on About', () => {
    const about = mount(AboutPage, { global: { stubs: { AppLink: AppLinkStub } } })
    expect(about.text()).toContain('Suzanne Bull')
    expect(about.text()).toContain('Natalie James')
  })
})
