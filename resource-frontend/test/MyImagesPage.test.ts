import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MyImagesPage from '../src/pages/MyImagesPage.vue'
import type { PageRoute } from '../src/navigation/routes'
import {
  DefaultLayoutStub,
  MyMriViewerStub,
  jsonRes,
  noFindings,
  sessionError,
  stubBackend,
  track,
} from './support/patientBackend'

const AppLinkStub = { props: ['to'], template: '<a :href="to"><slot /></a>' }
/** The example stages' own loading is CopperStage's (CopperStage.test.ts); here they only report. */
const CopperStageStub = {
  name: 'CopperStage',
  props: ['slug', 'group', 'panelId', 'panelLabel', 'lesionSliceIndex', 'modality', 'compact', 'loadEnabled', 'tour'],
  template: '<div data-slot="copper-stage" />',
}
const route: PageRoute = { path: '/my-images', name: 'my-images', params: {} }

describe('MyImagesPage', () => {
  beforeEach(() => { setActivePinia(createPinia()); stubBackend(noFindings) })
  const mountPage = () => track(mount(MyImagesPage, {
    props: { route },
    global: {
      stubs: { DefaultLayout: DefaultLayoutStub, MyMriViewer: MyMriViewerStub, AppLink: AppLinkStub, CopperStage: CopperStageStub },
    },
  }))
  const stageIn = (wrapper: ReturnType<typeof mountPage>, label: string) =>
    columnNamed(wrapper, label).getComponent({ name: 'CopperStage' })
  const columns = (wrapper: ReturnType<typeof mountPage>) => wrapper.get('.stage-slot').findAll('section')
  const columnNamed = (wrapper: ReturnType<typeof mountPage>, label: string) =>
    columns(wrapper).find(c => c.get('h2').text().startsWith(label))!

  it('is My Images, under the My results group, with no patient line', () => {
    const heading = mountPage().get('.heading-slot')
    expect(heading.text()).toContain('MY RESULTS')
    expect(heading.get('h1').text()).toBe('My Images')
    expect(heading.text()).not.toContain('Patient')
    expect(heading.text()).not.toContain('contrast phase')
  })

  it('shows anatomy, mammogram and MRI in three columns, in that order', () => {
    const labels = columns(mountPage()).map(c => c.get('h2').text())
    expect(labels.map(l => l.split(/\s/)[0])).toEqual(['Anatomy', 'Mammogram', 'MRI'])
  })

  it('shows the Density C anatomy and mammogram in their columns, marked as example data', () => {
    const wrapper = mountPage()
    for (const [label, panel, missing] of [
      ['Anatomy', 'anatomy', 'Your anatomy model is not available yet.'],
      ['Mammogram', 'mammogram', 'Your mammogram is not available yet.'],
    ] as const) {
      const column = columnNamed(wrapper, label)
      // In the heading, so the region's name says so too.
      expect(column.get('h2 [data-badge]').text()).toBe('Example')
      const note = column.get('[data-example-note]')
      expect(note.text()).toContain('Example data from Density C.')
      expect(note.text()).toContain(missing)
      expect(note.get('a').attributes('href')).toBe(`/density-c/${panel}`)
      const stage = stageIn(wrapper, label)
      expect(stage.props('slug')).toBe('density-c')
      expect(stage.props('panelId')).toBe(panel)
      expect(stage.props('modality').id).toBe(panel)
      expect(stage.props('modality').asset).toContain('density-3/')
      // Not the case page's stage: the guided tour must never find it.
      expect(stage.props('tour')).toBe(false)
      expect(stage.props('compact')).toBe(true)
    }
  })

  it('holds the examples back until the patient MRI has loaded', async () => {
    stubBackend(() => jsonRes(200, { findings: [] }))
    const wrapper = mountPage()
    await flushPromises()
    expect(stageIn(wrapper, 'Anatomy').props('loadEnabled')).toBe(false)
    expect(stageIn(wrapper, 'Mammogram').props('loadEnabled')).toBe(false)
    wrapper.getComponent({ name: 'MyMriViewer' }).vm.$emit('settled')
    await flushPromises()
    expect(stageIn(wrapper, 'Anatomy').props('loadEnabled')).toBe(true)
    expect(stageIn(wrapper, 'Mammogram').props('loadEnabled')).toBe(true)
  })

  describe('with fake timers', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('releases the examples after a while even if the MRI never settles', async () => {
      const wrapper = mountPage()
      expect(stageIn(wrapper, 'Anatomy').props('loadEnabled')).toBe(false)
      await vi.advanceTimersByTimeAsync(15_000)
      expect(stageIn(wrapper, 'Anatomy').props('loadEnabled')).toBe(true)
    })
  })

  it('puts a gutter to drag between each two columns, the widths equal to start', () => {
    const wrapper = mountPage()
    const gutters = wrapper.findAll('[role="separator"]')
    expect(gutters.map(g => g.attributes('aria-label'))).toEqual([
      'Resize Anatomy and Mammogram',
      'Resize Mammogram and MRI',
    ])
    expect(gutters.map(g => g.attributes('aria-valuenow'))).toEqual(['50', '50'])
    for (const column of columns(wrapper)) expect(column.attributes('style')).toContain('--vw-pane-grow: 1')
  })

  it('opens the MRI in more detail from its column header', () => {
    const link = columnNamed(mountPage(), 'MRI').get('h2 a')
    expect(link.attributes('href')).toBe('/my-images/mri')
    expect(link.text()).toContain('Open')
  })

  it('shows the patient MRI in 3D once the session is ready', async () => {
    stubBackend(() => jsonRes(200, { findings: [{ label: 'Finding 1', lesion: { channel: 1, color: '#ff7043' } }] }))
    const wrapper = mountPage()
    await flushPromises()
    const viewer = wrapper.getComponent({ name: 'MyMriViewer' })
    expect(viewer.props('mri')).toMatch(/\/api\/patients\/a-1\/sub-1\/mri$/)
    expect(viewer.props('initialView')).toBe('3d')
    expect(viewer.props('findings')).toEqual([{ label: 'Finding 1', channel: 1, color: '#ff7043' }])
  })

  it('keeps the examples when the session fails, loading them at once, and offers Try again in the MRI column', async () => {
    stubBackend(noFindings, sessionError)
    const wrapper = mountPage()
    await flushPromises()
    const mri = columnNamed(wrapper, 'MRI')
    expect(mri.find('[data-state="error"]').text()).toContain('Dataset missing')
    expect(mri.findAll('button').some(b => b.text() === 'Try again')).toBe(true)
    expect(columnNamed(wrapper, 'Anatomy').text()).toContain('not available yet')
    expect(columnNamed(wrapper, 'Mammogram').text()).toContain('not available yet')
    expect(stageIn(wrapper, 'Anatomy').props('loadEnabled')).toBe(true)
  })

  it('explains the three columns in the side panel', () => {
    const text = mountPage().get('.content-slot').text()
    expect(text).toContain("WHAT YOU'RE SEEING")
    expect(text).toContain('not available yet')
  })

  it('names the tab after the page and the app', () => {
    mountPage()
    expect(document.title).toBe('My Images — Visual Whakamārama')
  })
})
