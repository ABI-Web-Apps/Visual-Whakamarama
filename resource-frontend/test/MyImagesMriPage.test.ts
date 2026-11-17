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
    attachTo: document.body,
    global: { stubs: { DefaultLayout: DefaultLayoutStub, MyMriViewer: MyMriViewerStub, AppLink: AppLinkStub } },
  }))
  const columns = (wrapper: ReturnType<typeof mountPage>) => wrapper.get('.stage-slot').findAll('section')
  const viewers = (wrapper: ReturnType<typeof mountPage>) => wrapper.findAllComponents({ name: 'MyMriViewer' })

  it('is My MRI, under the My results group, leading back to My Images, with no patient line', () => {
    const heading = mountPage().get('.heading-slot')
    const back = heading.get('a')
    expect(back.attributes('href')).toBe('/my-images')
    expect(back.text()).toContain('My Images')
    expect(heading.text()).toContain('MY RESULTS')
    expect(heading.get('h1').text()).toBe('My MRI')
    expect(heading.text()).not.toContain('Patient')
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

  it('names its two viewers differently, so a screen reader can tell them apart', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const labels = viewers(wrapper).map(v => v.props('label'))
    expect(labels.every(Boolean)).toBe(true)
    expect(new Set(labels).size).toBe(2)
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
    expect(document.title).toBe('My MRI — Visual Whakamārama')
  })

  describe('minimising the previous MRI', () => {
    const gutterNames = (wrapper: ReturnType<typeof mountPage>) =>
      wrapper.findAll('[role="separator"]').map(g => g.attributes('aria-label'))

    it('offers a minimise button on the previous MRI only', () => {
      const wrapper = mountPage()
      const buttons = columns(wrapper).map(c => c.find('button[data-collapse]'))
      expect(buttons.map(b => b.exists())).toEqual([false, true, false])
      expect(buttons[1]!.attributes('aria-label')).toBe('Minimise Previous MRI')
      expect(gutterNames(wrapper)).toEqual(['Resize Current MRI and Previous MRI', 'Resize Previous MRI and 3D'])
    })

    it('folds it to a rail at the end of the row, the other two sharing the row, and puts it back', async () => {
      const wrapper = mountPage()
      await flushPromises()
      const viewerKeys = () => viewers(wrapper).map(v => v.vm.$.vnode.key)
      const keys = viewerKeys()

      await columns(wrapper)[1]!.get('button[data-collapse]').trigger('click')
      await flushPromises()
      expect(columns(wrapper).map(c => c.get('h2').text())).toEqual(['Current MRI', '3D'])
      expect(gutterNames(wrapper)).toEqual(['Resize Current MRI and 3D'])
      const rail = wrapper.get('[data-collapsed-pane]')
      expect(rail.attributes('aria-label')).toBe('Show Previous MRI')
      expect(rail.text()).toContain('Previous MRI')
      // Drawn after the open columns and their gutter.
      const orderOf = (el: { attributes: (n: string) => string | undefined }) =>
        Number(/order: (\d+)/.exec(el.attributes('style') ?? '')![1])
      expect(orderOf(rail)).toBeGreaterThan(Math.max(...columns(wrapper).map(orderOf)))
      // Focus moves to the rail, not off the page.
      expect(document.activeElement).toBe(rail.element)
      // The two viewers are the same ones: nothing reloads.
      expect(viewerKeys()).toEqual(keys)

      await rail.trigger('click')
      await flushPromises()
      expect(columns(wrapper).map(c => c.get('h2').text())).toEqual(['Current MRI', 'Previous MRI', '3D'])
      expect(wrapper.find('[data-collapsed-pane]').exists()).toBe(false)
      expect(document.activeElement).toBe(columns(wrapper)[1]!.get('button[data-collapse]').element)
      expect(viewerKeys()).toEqual(keys)
    })
  })
})
