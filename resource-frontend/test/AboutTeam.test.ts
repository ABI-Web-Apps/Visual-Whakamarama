import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { organisations, PAST_CONTRIBUTORS } from '../src/content/team'
import AboutPage from '../src/pages/AboutPage.vue'

const AppLinkStub = { props: ['to'], template: '<a :href="to"><slot /></a>' }
const TEAM_DIR = resolve(__dirname, '../public/team')
const REMOVED = ['Suzanne Bull', 'Natalie James', 'Kika Faagatu']

function mountAbout() {
  return mount(AboutPage, { global: { stubs: { AppLink: AppLinkStub } } })
}

describe('the team (client request, 2026-11-18)', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('no longer lists Suzanne Bull, Natalie James or Kika Faagatu, anywhere', () => {
    const everyone = organisations.flatMap(o => o.members.map(m => m.name))
    for (const name of REMOVED) expect(everyone).not.toContain(name)
    for (const name of REMOVED) expect(PAST_CONTRIBUTORS).not.toContain(name)
    const text = mountAbout().text()
    for (const name of REMOVED) expect(text).not.toContain(name)
  })

  it('ships none of their portraits: public/ goes to the portal\'s public bucket', () => {
    for (const file of ['suzanne-bull.webp', 'natalie-james.webp', 'kika-faagatu.webp']) {
      expect(existsSync(resolve(TEAM_DIR, file)), file).toBe(false)
    }
  })

  it('keeps every portrait it still shows', () => {
    for (const m of organisations.flatMap(o => o.members)) {
      expect(existsSync(resolve(TEAM_DIR, m.photo)), m.photo).toBe(true)
    }
  })

  it('keeps the foundation as a partner (its logo is only hidden), with no people', () => {
    const bcf = organisations.find(o => o.name === 'Breast Cancer Foundation NZ')!
    expect(bcf.logoHidden).toBe(true)
    expect(bcf.members).toEqual([])
    expect(organisations.find(o => o.name === 'Iwi United Engaged')!.members.map(m => m.name)).toEqual(['Misty Edmonds'])
  })

  it('shows one row per organisation that has people, and none for one that has not', () => {
    const rows = mountAbout().findAll('[data-team-row]')
    expect(rows.map(r => r.get('h3').text())).toEqual([
      'Iwi United Engaged',
      'Auckland Bioengineering Institute — Breast Biomechanics Research Group',
      'Past contributors',
    ])
    expect(rows[0]!.findAll('img')).toHaveLength(1)
    expect(rows[1]!.findAll('img')).toHaveLength(12)
  })

  it('thanks past contributors by name only, as the client asked', () => {
    expect(PAST_CONTRIBUTORS).toEqual(['Talia', 'Iosefa'])
    const row = mountAbout().get('[data-team-row="past"]')
    expect(row.findAll('img')).toHaveLength(0)
    expect(row.findAll('li').map(li => li.text())).toEqual(['Talia', 'Iosefa'])
  })
})
