import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import CollapsedPane from '../src/components/layout/CollapsedPane.vue'
import PaneGutter from '../src/components/layout/PaneGutter.vue'
import { MIN_PANE_PX, resizeLabel, usePaneSplit } from '../src/composables/usePaneSplit'

/**
 * Side-by-side panels with draggable widths. The composable keeps the
 * weights; the gutter measures the two panels it sits between and moves
 * width from one to the other. happy-dom lays nothing out, so each panel's
 * width is given by stubbing its bounding box.
 */
const three = () => usePaneSplit([{ id: 'a', weight: 1 }, { id: 'b', weight: 1 }, { id: 'c', weight: 1 }])

describe('usePaneSplit', () => {
  it('styles each panel with its weight and its place in the row', () => {
    const split = usePaneSplit([{ id: 'mri', weight: 1 }, { id: 'report', weight: 2 }])
    expect(split.paneStyle('mri')).toEqual({ '--vw-pane-grow': '1', 'order': '0' })
    expect(split.paneStyle('report')).toEqual({ '--vw-pane-grow': '2', 'order': '2' })
    expect(split.paneAttrs('report')).toEqual({ 'data-split-pane': 'report' })
    expect(split.gutters.value).toEqual([{ before: 'mri', after: 'report' }])
    expect(split.gutterOrder('report')).toBe(1)
    expect(split.pairPercent('mri', 'report')).toBe(33)
  })

  it('moves width between the two panels of a pair and leaves the others alone', () => {
    const split = three()
    split.resizePair('a', 'b', 600, 200)
    expect(split.weights.value.a).toBeCloseTo(1.5, 9)
    expect(split.weights.value.b).toBeCloseTo(0.5, 9)
    expect(split.weights.value.c).toBe(1)
    expect(split.pairPercent('a', 'b')).toBe(75)
  })

  it('never lets a dragged panel go below the minimum width', () => {
    const split = three()
    split.resizePair('a', 'b', 10, 790)
    const share = split.weights.value.a! / (split.weights.value.a! + split.weights.value.b!)
    expect(share * 800).toBeCloseTo(MIN_PANE_PX, 6)
    split.resizePair('a', 'b', 900, -100)
    const shareB = split.weights.value.b! / (split.weights.value.a! + split.weights.value.b!)
    expect(shareB * 800).toBeCloseTo(MIN_PANE_PX, 6)
  })

  it('puts every panel back to its default width on reset', () => {
    const split = three()
    split.resizePair('a', 'b', 600, 200)
    split.reset()
    expect(split.weights.value).toEqual({ a: 1, b: 1, c: 1 })
  })

  it('collapses a panel to the end of the row and expands it back where it was, at its width', () => {
    const split = three()
    split.resizePair('b', 'c', 300, 500)
    const width = split.weights.value.b
    split.collapse('b')
    expect(split.visible.value).toEqual(['a', 'c'])
    expect(split.gutters.value).toEqual([{ before: 'a', after: 'c' }])
    expect(Number(split.paneStyle('b').order)).toBeGreaterThan(Number(split.paneStyle('c').order))
    split.expand('b')
    expect(split.visible.value).toEqual(['a', 'b', 'c'])
    expect(split.paneStyle('b').order).toBe('2')
    expect(split.weights.value.b).toBe(width)
  })

  it('names a gutter by the two panels it sits between', () => {
    expect(resizeLabel('Current MRI', '3D')).toBe('Resize Current MRI and 3D')
  })
})

describe('PaneGutter', () => {
  afterEach(() => { document.body.innerHTML = '' })

  /** A row of two panels `widths` wide, and the gutter between them. */
  function mountRow(widths: [number, number] = [400, 400]) {
    const split = usePaneSplit([{ id: 'a', weight: 1 }, { id: 'b', weight: 1 }])
    const Row = defineComponent({
      setup: () => () => h('div', [
        h('div', { 'data-split-pane': 'a' }),
        h(PaneGutter, { split, before: 'a', after: 'b', label: 'Resize A and B' }),
        h('div', { 'data-split-pane': 'b' }),
      ]),
    })
    const wrapper = mount(Row, { attachTo: document.body })
    const [a, b] = wrapper.findAll('[data-split-pane]').map(p => p.element as HTMLElement)
    a!.getBoundingClientRect = () => ({ width: widths[0] }) as DOMRect
    b!.getBoundingClientRect = () => ({ width: widths[1] }) as DOMRect
    return { split, wrapper, gutter: wrapper.get('[role="separator"]') }
  }

  const pointer = (type: string, clientX: number, init: PointerEventInit = {}) =>
    new PointerEvent(type, { bubbles: true, cancelable: true, clientX, button: 0, pointerId: 1, ...init })

  it('is a focusable vertical separator, named, with the first panel\'s share as its value', () => {
    const { gutter } = mountRow()
    expect(gutter.attributes()).toMatchObject({
      'aria-orientation': 'vertical',
      'aria-label': 'Resize A and B',
      'aria-valuenow': '50',
      'tabindex': '0',
    })
    // Only where the panels sit side by side.
    expect(gutter.classes()).toEqual(expect.arrayContaining(['hidden', '@[1000px]:flex']))
  })

  it('drags width from one panel to the other, and marks the row as dragging while it lasts', async () => {
    const { split, gutter } = mountRow()
    gutter.element.dispatchEvent(pointer('pointerdown', 500))
    expect(split.dragging.value).toBe(true)
    gutter.element.dispatchEvent(pointer('pointermove', 600))
    expect(split.pairPercent('a', 'b')).toBe(63)
    gutter.element.dispatchEvent(pointer('pointerup', 600))
    expect(split.dragging.value).toBe(false)
    // A move after the drag ended changes nothing.
    gutter.element.dispatchEvent(pointer('pointermove', 100))
    expect(split.pairPercent('a', 'b')).toBe(63)
  })

  it('ignores a press with any button but the main one', () => {
    const { split, gutter } = mountRow()
    gutter.element.dispatchEvent(pointer('pointerdown', 500, { button: 2 }))
    expect(split.dragging.value).toBe(false)
  })

  it('steps with the arrow keys, further with Shift, and Enter or a double-click resets', async () => {
    const { split, gutter } = mountRow()
    await gutter.trigger('keydown', { key: 'ArrowRight' })
    expect(split.pairPercent('a', 'b')).toBe(53) // 424 of 800
    await gutter.trigger('keydown', { key: 'ArrowLeft', shiftKey: true })
    expect(split.pairPercent('a', 'b')).toBe(38) // 304 of 800
    await gutter.trigger('keydown', { key: 'Enter' })
    expect(split.pairPercent('a', 'b')).toBe(50)
    split.resizePair('a', 'b', 600, 200)
    await gutter.trigger('dblclick')
    expect(split.pairPercent('a', 'b')).toBe(50)
  })

  it('does not leave the row dragging when it goes mid-drag', () => {
    const { split, gutter, wrapper } = mountRow()
    gutter.element.dispatchEvent(pointer('pointerdown', 500))
    wrapper.unmount()
    expect(split.dragging.value).toBe(false)
  })
})

describe('CollapsedPane', () => {
  it('is one button that names the panel and puts it back', async () => {
    const wrapper = mount(CollapsedPane, { props: { label: 'Previous MRI', expandLabel: 'Show Previous MRI' } })
    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe('Show Previous MRI')
    expect(button.text()).toBe('Previous MRI')
    await button.trigger('click')
    expect(wrapper.emitted('expand')).toHaveLength(1)
  })
})
