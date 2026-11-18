import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { organisations, thanksSentence, WITH_THANKS } from '../src/content/team'
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
    for (const name of REMOVED) expect(WITH_THANKS).not.toContain(name)
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
      'With thanks',
    ])
    expect(rows[0]!.findAll('img')).toHaveLength(1)
    expect(rows[1]!.findAll('img')).toHaveLength(12)
  })

  it('thanks Talia and Iosefa by name, in a sentence that reads as thanks', () => {
    expect(WITH_THANKS).toEqual(['Talia', 'Iosefa'])
    const row = mountAbout().get('[data-team-row="thanks"]')
    expect(row.findAll('img')).toHaveLength(0)
    expect(row.get('p').text()).toBe('Thank you to Talia and Iosefa for helping bring this resource to life.')
    expect(row.findAll('strong').map(n => n.text())).toEqual(['Talia', 'Iosefa'])
  })

  it('never calls anyone a "past" contributor', () => {
    expect(mountAbout().text().toLowerCase()).not.toContain('past contributor')
  })

  it('writes the names as a sentence would, however many there are', () => {
    const parts = (names: string[]) => thanksSentence(names).map(p => p.text).join('')
    expect(parts(['Talia'])).toBe('Thank you to Talia for helping bring this resource to life.')
    expect(parts(['Talia', 'Iosefa'])).toBe('Thank you to Talia and Iosefa for helping bring this resource to life.')
    expect(parts(['A', 'B', 'C'])).toBe('Thank you to A, B and C for helping bring this resource to life.')
    expect(thanksSentence(['Talia', 'Iosefa']).filter(p => p.name).map(p => p.text)).toEqual(['Talia', 'Iosefa'])
  })
})
