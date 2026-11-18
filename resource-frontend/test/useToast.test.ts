import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import AppToast from '../src/components/common/AppToast.vue'
import { provideToast, useToast } from '../src/composables/useToast'
import type { ToastApi } from '../src/composables/useToast'

let api!: ToastApi

/** A provider with the toast itself and one consumer, as App.vue mounts them. */
function mountWithToast() {
  const Consumer = defineComponent({ setup() { api = useToast(); return () => null } })
  return mount(defineComponent({
    setup() { provideToast(); return () => h('div', [h(Consumer), h(AppToast)]) },
  }))
}

describe('useToast', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('shows a message in a polite live region, then hides it after 4 s', async () => {
    const w = mountWithToast()
    const region = w.get('[role="status"]')
    expect(region.attributes('aria-live')).toBe('polite')
    api.show('Email address copied.')
    await w.vm.$nextTick()
    expect(region.text()).toBe('Email address copied.')
    vi.advanceTimersByTime(4000)
    await w.vm.$nextTick()
    expect(region.text()).toBe('')
  })

  it('replaces the message on screen, and the new one gets its own full time', async () => {
    const w = mountWithToast()
    api.show('first', 1000)
    vi.advanceTimersByTime(800)
    api.show('second', 1000)
    vi.advanceTimersByTime(800)
    await w.vm.$nextTick()
    expect(w.get('[role="status"]').text()).toBe('second')
  })

  it('is a harmless no-op where nothing provides it', () => {
    const Lone = defineComponent({ setup() { api = useToast(); return () => null } })
    mount(Lone)
    expect(() => api.show('nobody hears this')).not.toThrow()
  })
})
