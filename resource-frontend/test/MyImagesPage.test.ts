import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
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
const route: PageRoute = { path: '/my-images', name: 'my-images', params: {} }

describe('MyImagesPage', () => {
  beforeEach(() => { setActivePinia(createPinia()); stubBackend(noFindings) })
  const mountPage = () => track(mount(MyImagesPage, {
    props: { route },
    global: { stubs: { DefaultLayout: DefaultLayoutStub, MyMriViewer: MyMriViewerStub, AppLink: AppLinkStub } },
  }))
  const columns = (wrapper: ReturnType<typeof mountPage>) => wrapper.get('.stage-slot').findAll('section')
  const columnNamed = (wrapper: ReturnType<typeof mountPage>, label: string) =>
    columns(wrapper).find(c => c.get('h2').text().startsWith(label))!

  it('renders the heading with the cohort from the config', () => {
    const heading = mountPage().get('.heading-slot')
    expect(heading.text()).toContain('MY IMAGES')
    expect(heading.get('h1').text()).toBe('Your images')
    expect(heading.text()).toContain('Patient sub-1')
  })

  it('shows anatomy, mammogram and MRI in three columns, in that order', () => {
    const labels = columns(mountPage()).map(c => c.get('h2').text())
    expect(labels.map(l => l.split(/\s/)[0])).toEqual(['Anatomy', 'Mammogram', 'MRI'])
  })

  it('holds the anatomy and mammogram places, each with an example to look at instead', () => {
    const wrapper = mountPage()
    const anatomy = columnNamed(wrapper, 'Anatomy')
    expect(anatomy.text()).toContain('Your anatomy model is not available yet.')
    expect(anatomy.get('a').attributes('href')).toBe('/the-breast/anatomy')
    const mammogram = columnNamed(wrapper, 'Mammogram')
    expect(mammogram.text()).toContain('Your mammogram is not available yet.')
    expect(mammogram.get('a').attributes('href')).toBe('/the-breast/mammogram')
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

  it('keeps the placeholders when the session fails, and offers Try again in the MRI column', async () => {
    stubBackend(noFindings, sessionError)
    const wrapper = mountPage()
    await flushPromises()
    const mri = columnNamed(wrapper, 'MRI')
    expect(mri.find('[data-state="error"]').text()).toContain('Dataset missing')
    expect(mri.findAll('button').some(b => b.text() === 'Try again')).toBe(true)
    expect(columnNamed(wrapper, 'Anatomy').text()).toContain('not available yet')
    expect(columnNamed(wrapper, 'Mammogram').text()).toContain('not available yet')
  })

  it('explains the three columns in the side panel', () => {
    const text = mountPage().get('.content-slot').text()
    expect(text).toContain("WHAT YOU'RE SEEING")
    expect(text).toContain('not available yet')
  })

  it('names the tab after the page and the app', () => {
    mountPage()
    expect(document.title).toBe('Your images — Visual Whakamārama')
  })
})
