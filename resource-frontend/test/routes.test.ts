import { describe, expect, it } from 'vitest'
import { enabledCases } from '../src/content/cases'
import { HOME_PATH, normalisePath, resolveFinal, resolvePath } from '../src/navigation/routes'

/**
 * The page table that replaced Nuxt's `pages/` directory. Each rule here is
 * one the old app had: index.vue's redirect, the `[slug]/[[modality]]`
 * page with its `validate` guard, about.vue, and the router's own matching.
 */
/** Every build has the backend, so the patient pages are always in the table. */
describe('/my-report', () => {
  it('serves /my-report, case-insensitively', () => {
    expect(resolvePath('/my-report')).toEqual({ route: { path: '/my-report', name: 'my-report', params: {} } })
    expect(resolvePath('/My-Report')).toMatchObject({ route: { name: 'my-report' } })
  })

  it('sends the old /my-mri to /my-report', () => {
    expect(resolvePath('/my-mri')).toEqual({ redirect: '/my-report' })
    expect(resolvePath('/MY-MRI')).toEqual({ redirect: '/my-report' })
    expect(resolveFinal('/my-mri')).toMatchObject({ route: { name: 'my-report' }, redirected: true })
  })
})

describe('/contact', () => {
  it('serves the Contact us page, case-insensitively', () => {
    expect(resolvePath('/contact')).toEqual({ route: { path: '/contact', name: 'contact', params: {} } })
    expect(resolvePath('/Contact')).toMatchObject({ route: { name: 'contact' } })
  })
})

describe('/my-images', () => {
  it('serves /my-images, case-insensitively', () => {
    expect(resolvePath('/my-images')).toEqual({ route: { path: '/my-images', name: 'my-images', params: {} } })
    expect(resolvePath('/My-Images')).toMatchObject({ route: { name: 'my-images' } })
  })

  it('serves the MRI page at /my-images/mri, case-insensitively', () => {
    expect(resolvePath('/my-images/mri')).toEqual({ route: { path: '/my-images/mri', name: 'my-images-mri', params: {} } })
    expect(resolvePath('/My-Images/MRI')).toMatchObject({ route: { name: 'my-images-mri' } })
  })

  it('404s any other page under /my-images', () => {
    expect(resolvePath('/my-images/other')).toMatchObject({ route: { name: 'not-found' } })
    expect(resolvePath('/my-images/mri/x')).toMatchObject({ route: { name: 'not-found' } })
  })
})

describe('route table', () => {
  it('sends the site root to the home case, as pages/index.vue did', () => {
    expect(resolvePath('/')).toEqual({ redirect: HOME_PATH })
    expect(resolveFinal('/')).toEqual({
      route: { path: '/the-breast', name: 'case', params: { slug: 'the-breast', modality: undefined } },
      redirected: true,
    })
  })

  it('serves every enabled case, with and without a modality', () => {
    for (const c of enabledCases()) {
      expect(resolvePath(`/${c.slug}`)).toMatchObject({ route: { name: 'case', params: { slug: c.slug } } })
      for (const m of c.modalities) {
        expect(resolvePath(`/${c.slug}/${m.id}`)).toMatchObject({
          route: { name: 'case', params: { slug: c.slug, modality: m.id } },
        })
      }
    }
  })

  /**
   * `[[modality]]` was an optional param with no guard of its own: an
   * unknown modality reached the page, which fell back to a real one. So it
   * must not 404 here either.
   */
  it('leaves an unknown modality to the page\'s own fallback', () => {
    expect(resolvePath('/density-c/xray')).toMatchObject({
      route: { name: 'case', params: { slug: 'density-c', modality: 'xray' } },
    })
  })

  it('404s an unknown slug, a disabled case and any deeper path', () => {
    expect(resolvePath('/nope')).toMatchObject({ route: { name: 'not-found' } })
    expect(resolvePath('/benign-calcifications')).toMatchObject({ route: { name: 'not-found' } })
    expect(resolvePath('/density-c/mri/extra')).toMatchObject({ route: { name: 'not-found' } })
  })

  it('serves About, matching static segments case-insensitively as vue-router did', () => {
    expect(resolvePath('/about')).toMatchObject({ route: { name: 'about' } })
    expect(resolvePath('/About')).toMatchObject({ route: { name: 'about' } })
  })

  it('ignores a trailing slash, a query and a hash', () => {
    expect(normalisePath('/density-c/mri/')).toBe('/density-c/mri')
    expect(normalisePath('/about?x=1#team')).toBe('/about')
    expect(normalisePath('')).toBe('/')
    expect(resolvePath('/density-c/')).toMatchObject({ route: { path: '/density-c', name: 'case' } })
  })

  it('decodes an escaped path before matching it', () => {
    expect(normalisePath('/density%2Dc')).toBe('/density%2Dc'.replace('%2D', '-'))
    expect(resolvePath('/%61bout')).toMatchObject({ route: { name: 'about' } })
  })
})
