import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import MyImagesMriPage from '../src/pages/MyImagesMriPage.vue'
import type { PageRoute } from '../src/navigation/routes'
import {
  DefaultLayoutStub,
  MyMriViewerStub,
  noFindings,
  sessionError,
  stubBackend,
  track,
} from './support/patientBackend'

const AppLinkStub = { props: ['to'], template: '<a :href="to"><slot /></a>' }
const route: PageRoute = { path: '/my-images/mri', name: 'my-images-mri', params: {} }

describe('MyImagesMriPage', () => {
  beforeEach(() => { setActivePinia(createPinia()); stubBackend(noFindings) })
  const mountPage = () => track(mount(MyImagesMriPage, {
    props: { route },
    global: { stubs: { DefaultLayout: DefaultLayoutStub, MyMriViewer: MyMriViewerStub, AppLink: AppLinkStub } },
  }))
  const columns = (wrapper: ReturnType<typeof mountPage>) => wrapper.get('.stage-slot').findAll('section')
  const viewers = (wrapper: ReturnType<typeof mountPage>) => wrapper.findAllComponents({ name: 'MyMriViewer' })

  it('leads back to My Images, under the My Images heading', () => {
    const heading = mountPage().get('.heading-slot')
    const back = heading.get('a')
    expect(back.attributes('href')).toBe('/my-images')
    expect(back.text()).toContain('My Images')
    expect(heading.text()).toContain('MY IMAGES')
    expect(heading.get('h1').text()).toBe('Your MRI')
  })

  it('shows the current MRI, the previous MRI and the 3D view, in that order', () => {
    expect(columns(mountPage()).map(c => c.get('h2').text())).toEqual(['Current MRI', 'Previous MRI', '3D'])
  })

  it('holds the previous MRI\'s place, with no example to stand in for it', () => {
    const previous = columns(mountPage())[1]!
    expect(previous.text()).toContain('No earlier MRI on file.')
    expect(previous.find('a').exists()).toBe(false)
  })

  it('opens the current MRI on its axial slice and the 3D column on 3D', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(viewers(wrapper).map(v => v.props('initialView'))).toEqual(['axial', '3d'])
    expect(viewers(wrapper).every(v => /\/api\/patients\/a-1\/sub-1\/mri$/.test(v.props('mri')))).toBe(true)
  })

  it('rebuilds only the viewer whose Try again was pressed', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const [current, threeD] = viewers(wrapper)
    const keyOf = (i: number) => (viewers(wrapper)[i]!.vm.$.vnode.key as string)
    const before = [keyOf(0), keyOf(1)]
    current!.vm.$emit('retry')
    await flushPromises()
    expect(keyOf(0)).not.toBe(before[0])
    expect(keyOf(1)).toBe(before[1])
    expect(threeD!.exists()).toBe(true)
  })

  it('shows a session failure in both MRI columns and keeps the previous MRI\'s place', async () => {
    stubBackend(noFindings, sessionError)
    const wrapper = mountPage()
    await flushPromises()
    const [current, previous, threeD] = columns(wrapper)
    expect(current!.find('[data-state="error"]').text()).toContain('Dataset missing')
    expect(threeD!.find('[data-state="error"]').text()).toContain('Dataset missing')
    expect(previous!.text()).toContain('No earlier MRI on file.')
    // One live region announces it, not two.
    expect(wrapper.findAll('[role="alert"]')).toHaveLength(1)
  })

  it('explains the three columns and the controls in the side panel', () => {
    const text = mountPage().get('.content-slot').text()
    expect(text).toContain("WHAT YOU'RE SEEING")
    expect(text).toContain('Reset')
  })

  it('names the tab after the page and the app', () => {
    mountPage()
    expect(document.title).toBe('Your MRI — Visual Whakamārama')
  })
})
