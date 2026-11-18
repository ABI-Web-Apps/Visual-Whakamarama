import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ReportPages from '../src/components/myMri/ReportPages.vue'

const pageUrl = (i: number) => `/api/patients/a/sub-1/report/pages/${i}.png`
const pages = [
  { width: 595, height: 842, text: 'Your breast MRI: what we found' },
  { width: 595, height: 842, text: 'Questions you may want to ask' },
]

function mountPages() {
  return mount(ReportPages, { props: { pages, pageUrl } })
}

describe('ReportPages', () => {
  it('shows every page as an image at the column width', () => {
    const imgs = mountPages().findAll('img')
    expect(imgs.map(i => i.attributes('src'))).toEqual([pageUrl(0), pageUrl(1)])
    // Its own aspect ratio from the start, so the column does not jump as each page lands.
    expect(imgs[0]!.attributes('width')).toBe('1600')
    expect(imgs[0]!.attributes('height')).toBe(String(Math.round(1600 * 842 / 595)))
  })

  it('loads the first page at once and the rest as they scroll near', () => {
    const imgs = mountPages().findAll('img')
    expect(imgs[0]!.attributes('loading')).toBe('eager')
    expect(imgs[1]!.attributes('loading')).toBe('lazy')
  })

  it('gives a screen reader each page as text, not a picture of it', () => {
    const w = mountPages()
    for (const img of w.findAll('img')) {
      expect(img.attributes('alt')).toBe('')
      expect(img.attributes('aria-hidden')).toBe('true')
    }
    const text = w.findAll('.tw\\:sr-only').map(n => n.text())
    expect(text[0]).toContain('Page 1 of 2')
    expect(text[0]).toContain('Your breast MRI: what we found')
    expect(text[1]).toContain('Page 2 of 2')
  })

  it('says which page could not be shown when its image fails', async () => {
    const w = mountPages()
    await w.findAll('img')[1]!.trigger('error')
    expect(w.text()).toContain('Page 2 could not be shown.')
    expect(w.findAll('img')).toHaveLength(1)
  })
})
