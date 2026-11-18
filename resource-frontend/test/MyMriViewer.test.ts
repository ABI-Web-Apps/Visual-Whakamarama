import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MyMriViewer from '../src/components/myMri/MyMriViewer.vue'
import StageControls from '../src/components/stage/StageControls.vue'
import { MY_MRI_COPY } from '../src/content/myMri'
import type { FindingSummary } from '../src/myMri/useMyMriSession'

/** The scene itself is covered by useMyMriScene.test.ts; this is the chrome around it. */
const scene = {
  status: ref<'loading' | 'ready' | 'error'>('ready'),
  error: ref<string | null>(null),
  noMask: ref(false),
  view: ref<'3d' | 'axial' | 'coronal' | 'sagittal'>('3d'),
  slice: ref<{ current: number, total: number } | null>(null),
  setView: vi.fn(),
  resetView: vi.fn(),
}
const useMyMriScene = vi.fn((_host: unknown, _sources: unknown) => scene)
vi.mock('../src/myMri/useMyMriScene', async importOriginal => ({
  ...(await importOriginal<typeof import('../src/myMri/useMyMriScene')>()),
  useMyMriScene: (host: unknown, sources: unknown) => useMyMriScene(host, sources),
}))

const FINDINGS: FindingSummary[] = [
  { label: 'Finding 1', channel: 1, color: '#ff7043' },
  { label: 'Finding 2', channel: 2, color: '#42a5f5' },
]
const mountViewer = (findings = FINDINGS) => mount(MyMriViewer, {
  props: { mri: '/api/patients/a/sub-1/mri', mask: '/api/patients/a/sub-1/mask.glb', findings },
})

describe('MyMriViewer', () => {
  beforeEach(() => {
    scene.status.value = 'ready'
    scene.error.value = null
    scene.noMask.value = false
    scene.view.value = '3d'
    scene.slice.value = null
    scene.setView.mockClear()
    scene.resetView.mockClear()
    useMyMriScene.mockClear()
  })

  it('hands the scene its MRI, mask and findings', () => {
    mountViewer()
    expect(useMyMriScene).toHaveBeenCalledWith(expect.anything(), {
      mri: '/api/patients/a/sub-1/mri', mask: '/api/patients/a/sub-1/mask.glb', findings: FINDINGS,
    })
  })

  it('hands the scene the view to open on', () => {
    mount(MyMriViewer, {
      props: { mri: '/m', mask: '/k', findings: FINDINGS, initialView: 'axial' },
    })
    expect(useMyMriScene).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ initialView: 'axial' }))
  })

  it('names the scan for assistive technology, by the label it is given or the default', () => {
    expect(mountViewer().get('[role="img"]').attributes('aria-label')).toBe(MY_MRI_COPY.viewerLabel)
    const labelled = mount(MyMriViewer, {
      props: { mri: '/m', mask: '/k', findings: FINDINGS, label: 'Your MRI in 3D' },
    })
    expect(labelled.get('[role="img"]').attributes('aria-label')).toBe('Your MRI in 3D')
  })

  it('shows a legend entry per finding, with its colour', () => {
    const legend = mountViewer().get(`ul[aria-label="${MY_MRI_COPY.viewerLegendLabel}"]`)
    const items = legend.findAll('li')
    expect(items.map(i => i.text())).toEqual(['Finding 1', 'Finding 2'])
    expect(items[0]!.get('span').attributes('style')).toContain('background-color: #ff7043')
    expect(items[1]!.get('span').attributes('style')).toContain('background-color: #42a5f5')
  })

  it('hides the legend without findings', () => {
    expect(mountViewer([]).find('ul').exists()).toBe(false)
  })

  it('describes the gestures for each view to a screen reader', async () => {
    const wrapper = mountViewer()
    const help = () => wrapper.get(`#${wrapper.get('[role="img"]').attributes('aria-describedby')}`)
    expect(help().text()).toBe(MY_MRI_COPY.viewerHint)
    expect(help().classes()).toContain('sr-only')
    scene.view.value = 'axial'
    await nextTick()
    expect(help().text()).toBe(MY_MRI_COPY.viewerSliceHint)
  })

  it('tells a touch device its own gestures: it has no Ctrl, no wheel and no right button', async () => {
    const coarse = vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
      matches: query === '(pointer: coarse)', media: query,
    }) as MediaQueryList)
    try {
      const wrapper = mountViewer()
      const help = () => wrapper.get(`#${wrapper.get('[role="img"]').attributes('aria-describedby')}`)
      expect(help().text()).toBe(MY_MRI_COPY.viewerHintTouch)
      expect(MY_MRI_COPY.viewerHintTouch).not.toMatch(/right-drag|scroll/)
      scene.view.value = 'axial'
      scene.slice.value = { current: 46, total: 104 }
      await nextTick()
      expect(help().text()).toBe(MY_MRI_COPY.viewerSliceHintTouch)
      expect(wrapper.get('[data-slice-hint]').text()).toBe(MY_MRI_COPY.viewerSliceHintTouch)
      expect(MY_MRI_COPY.viewerSliceHintTouch).not.toContain('Ctrl')
    }
    finally {
      coarse.mockRestore()
    }
  })

  it('has no hints or controls over the scan: the bar under it holds them all', () => {
    const wrapper = mountViewer()
    expect(wrapper.text()).not.toContain('drag · right-drag · scroll')
    const bar = wrapper.getComponent(StageControls)
    expect(bar.find(`[role="group"][aria-label="${MY_MRI_COPY.viewerViewsLabel}"]`).exists()).toBe(true)
    expect(bar.find('button[aria-label="Reset view"]').exists()).toBe(true)
    expect(bar.find('button[aria-label="Fullscreen"]').exists()).toBe(true)
    // The case stages' bar, icon-only, and not one the guided tour can find.
    expect(bar.props('compact')).toBe(true)
    expect(bar.attributes('data-tour')).toBeUndefined()
    // Fullscreen fills the screen with the scan and its bar together.
    expect(wrapper.element.hasAttribute('data-stage-panel')).toBe(true)
  })

  it('offers the 3D view and the three single views, the current one pressed', async () => {
    scene.status.value = 'loading'
    const wrapper = mountViewer()
    const group = wrapper.get(`[role="group"][aria-label="${MY_MRI_COPY.viewerViewsLabel}"]`)
    const buttons = group.findAll('button')
    expect(buttons.map(b => b.get('span').text())).toEqual(['3D', 'Axial', 'Coronal', 'Sagittal'])
    expect(buttons.map(b => b.attributes('aria-pressed'))).toEqual(['true', 'false', 'false', 'false'])
    // Like Reset view, they wait for the scene.
    expect(buttons.every(b => b.attributes('disabled') !== undefined)).toBe(true)

    scene.status.value = 'ready'
    await nextTick()
    await buttons[1]!.trigger('click')
    expect(scene.setView).toHaveBeenCalledWith('axial')

    scene.view.value = 'axial'
    await nextTick()
    expect(buttons.map(b => b.attributes('aria-pressed'))).toEqual(['false', 'true', 'false', 'false'])
  })

  it('names each view in full, or short where the bar is narrow, the name always holding the word shown', () => {
    const group = mountViewer().get(`[role="group"][aria-label="${MY_MRI_COPY.viewerViewsLabel}"]`)
    const axial = group.findAll('button')[1]!
    // Named by its text, never an aria-label, so the name is what is on screen.
    expect(axial.attributes('aria-label')).toBeUndefined()
    const [full, short, spoken, tip] = axial.findAll('span')
    expect(full!.text()).toBe('Axial')
    expect(full!.classes()).toEqual(expect.arrayContaining(['hidden', '@[13rem]:inline']))
    expect(short!.text()).toBe('Ax')
    expect(short!.classes()).toContain('@[13rem]:hidden')
    // Short, the full word still reaches a screen reader: "Ax Axial".
    expect(spoken!.text()).toBe('Axial')
    expect(spoken!.classes()).toEqual(expect.arrayContaining(['sr-only', '@[13rem]:hidden']))
    expect(tip!.text()).toBe('One slice at a time, across your body')
    expect(tip!.attributes('aria-hidden')).toBe('true')
    // 3D is the same either way, so it has no spoken partner.
    expect(group.findAll('button')[0]!.findAll('span').map(s => s.text())).toEqual(['3D', '3D', 'All three slices together'])
  })

  it('shows the slice number in the bar in a single view, and announces it once the wheel stops', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = mountViewer()
      expect(wrapper.find('p[aria-hidden="true"]').exists()).toBe(false)

      scene.view.value = 'axial'
      scene.slice.value = { current: 46, total: 104 }
      await nextTick()
      const readout = wrapper.getComponent(StageControls).get('p[aria-hidden="true"]')
      expect(readout.text()).toContain('46 / 104')
      expect(readout.get('[data-slice-hint]').text()).toBe(MY_MRI_COPY.viewerSliceHint)

      vi.advanceTimersByTime(300)
      await nextTick()
      expect(wrapper.get('[aria-live="polite"]').text()).toBe('Slice 46 of 104')
      scene.slice.value = { current: 47, total: 104 }
      await nextTick()
      expect(wrapper.get('[aria-live="polite"]').text()).toBe('Slice 46 of 104')
      vi.advanceTimersByTime(300)
      await nextTick()
      expect(wrapper.get('[aria-live="polite"]').text()).toBe('Slice 47 of 104')
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('resets the view from Reset view in the bar, which waits for the scene', async () => {
    scene.status.value = 'loading'
    const wrapper = mountViewer()
    const reset = wrapper.get('button[aria-label="Reset view"]')
    expect(reset.attributes('disabled')).toBeDefined()
    expect(wrapper.find('[role="status"]').text()).toContain(MY_MRI_COPY.loading)

    scene.status.value = 'ready'
    await nextTick()
    expect(reset.attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    await reset.trigger('click')
    expect(scene.resetView).toHaveBeenCalledTimes(1)
  })

  it('reports once that it has settled, ready or failed', async () => {
    scene.status.value = 'loading'
    const wrapper = mountViewer()
    expect(wrapper.emitted('settled')).toBeUndefined()
    scene.status.value = 'ready'
    await nextTick()
    scene.status.value = 'error'
    await nextTick()
    expect(wrapper.emitted('settled')).toHaveLength(1)
  })

  it('shows a load failure over the canvas with a Try again of its own', async () => {
    scene.status.value = 'loading'
    const wrapper = mountViewer()
    scene.error.value = 'Your scan could not be loaded.'
    scene.status.value = 'error'
    await nextTick()
    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toContain('Your scan could not be loaded.')
    expect(wrapper.get('button[aria-label="Reset view"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('ul').exists()).toBe(false)
    await alert.get('button').trigger('click')
    expect(alert.get('button').text()).toBe(MY_MRI_COPY.tryAgain)
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('shows a calm note instead of the legend when the scan has no marked areas', () => {
    scene.noMask.value = true
    const wrapper = mountViewer()
    expect(wrapper.find('ul').exists()).toBe(false)
    expect(wrapper.text()).toContain('No marked areas for this scan.')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('button[aria-label="Reset view"]').attributes('disabled')).toBeUndefined()
  })
})
