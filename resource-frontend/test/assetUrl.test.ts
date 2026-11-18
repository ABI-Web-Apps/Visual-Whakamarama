import { describe, expect, it } from 'vitest'
import { absoluteUrl, assetUrl } from '../src/composables/assetUrl'

describe('assetUrl', () => {
  it('joins a same-origin base with a relative path', () => {
    expect(assetUrl('density-1/middle/m3d.nrrd', '/modelView/'))
      .toBe('/modelView/density-1/middle/m3d.nrrd')
  })

  it('tolerates a base without a trailing slash', () => {
    expect(assetUrl('density-1/left/density25.glb', '/modelView'))
      .toBe('/modelView/density-1/left/density25.glb')
  })

  it('tolerates a path with a leading slash', () => {
    expect(assetUrl('/density-1/middle/m_view.json', '/modelView/'))
      .toBe('/modelView/density-1/middle/m_view.json')
  })

  it('supports an absolute CDN base', () => {
    expect(assetUrl('cancer-dcis/right/mri.nrrd', 'https://cdn.example.org/te-uma/'))
      .toBe('https://cdn.example.org/te-uma/cancer-dcis/right/mri.nrrd')
  })

  it('does not collapse a double slash inside the path itself', () => {
    expect(assetUrl('a//b.nrrd', '/modelView/')).toBe('/modelView/a//b.nrrd')
  })

  it('throws on an empty path rather than returning the bare base', () => {
    expect(() => assetUrl('', '/modelView/')).toThrow(/empty/i)
  })
})

/**
 * copper3d 4.1's `loadNrrd` fetches inside a Web Worker started from a
 * `blob:` URL. A worker resolves `fetch` against its own URL, and nothing
 * relative can be parsed against `blob:` -- so the standalone and plugin
 * builds' root-relative `/api/...` URLs failed before any request went out,
 * while `yarn dev`'s absolute `http://localhost:8082/api/...` worked.
 */
describe('absoluteUrl', () => {
  const page = 'https://portal.example.org/plugin/vw/my-report'

  it('resolves a root-relative URL against the page origin', () => {
    expect(absoluteUrl('/api/modelView/density-1/right/mri.nrrd', page))
      .toBe('https://portal.example.org/api/modelView/density-1/right/mri.nrrd')
  })

  it('keeps a plugin route prefix', () => {
    expect(absoluteUrl('/plugin/vw/api/patients/a-1/sub-1/mri', page))
      .toBe('https://portal.example.org/plugin/vw/api/patients/a-1/sub-1/mri')
  })

  it('resolves a path-relative URL against the page\'s folder', () => {
    expect(absoluteUrl('modelView/a.nrrd', 'https://host.example.org/te-uma/density-a/mri'))
      .toBe('https://host.example.org/te-uma/density-a/modelView/a.nrrd')
  })

  it('returns an absolute URL unchanged', () => {
    expect(absoluteUrl('http://localhost:8082/api/modelView/a.nrrd', page))
      .toBe('http://localhost:8082/api/modelView/a.nrrd')
  })

  it('produces a URL a blob: base cannot break', () => {
    const resolved = absoluteUrl('/api/x.nrrd', page)
    expect(new URL(resolved, 'blob:https://portal.example.org/0b1c').href).toBe(resolved)
  })
})
