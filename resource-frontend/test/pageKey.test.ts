import { describe, expect, it } from 'vitest'
import { casePageKey, pageKeyFor } from '../src/utils/pageKey'
import type { PageRoute } from '../src/navigation/routes'
import { enabledCases } from '../src/content/cases'

describe('casePageKey', () => {
  it('gives every case the same key, so the stages survive case navigation', () => {
    const keys = new Set(enabledCases().map(c => casePageKey(c.slug)))
    expect(keys.size).toBe(1)
    expect([...keys][0]).toBeTypeOf('string')
  })

  it('returns undefined for a slug that is not a case, so the route path is used', () => {
    expect(casePageKey('nope')).toBeUndefined()
  })

  it('returns undefined when there is no slug param at all', () => {
    expect(casePageKey(undefined)).toBeUndefined()
  })
})

describe('pageKeyFor', () => {
  const page = (path: string, name: PageRoute['name'], slug?: string): PageRoute =>
    ({ path, name, params: slug ? { slug } : {} })

  it('gives every case the shared case key', () => {
    expect(pageKeyFor(page('/density-a/mri', 'case', 'density-a'))).toBe(casePageKey('density-a'))
  })

  // Paths match case-insensitively, so /My-Images and /my-images are the same
  // page. Keyed on the path they were two kept-alive instances, each with its
  // own copy of the patient's MRI.
  it('keys every other page on its name, not on how its path was typed', () => {
    expect(pageKeyFor(page('/My-Images', 'my-images'))).toBe(pageKeyFor(page('/my-images', 'my-images')))
    expect(pageKeyFor(page('/ABOUT', 'about'))).toBe(pageKeyFor(page('/about', 'about')))
    expect(pageKeyFor(page('/my-images', 'my-images'))).not.toBe(pageKeyFor(page('/my-images/mri', 'my-images-mri')))
  })
})
