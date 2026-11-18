import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createTapCounter, isAdminShortcut, useAdminShortcut } from '../src/utils/adminShortcut'

function key(init: KeyboardEventInit, target: EventTarget = document.body): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  Object.defineProperty(e, 'target', { value: target })
  return e
}

describe('isAdminShortcut', () => {
  it('is Ctrl + Shift + F', () => {
    expect(isAdminShortcut(key({ ctrlKey: true, shiftKey: true, code: 'KeyF', key: 'F' }))).toBe(true)
  })

  it('goes by the physical key, so a Mac layout that types Ï still counts', () => {
    expect(isAdminShortcut(key({ ctrlKey: true, shiftKey: true, code: 'KeyF', key: 'Ï' }))).toBe(true)
  })

  it('is not Cmd, Alt or a plain F', () => {
    expect(isAdminShortcut(key({ ctrlKey: true, shiftKey: true, metaKey: true, code: 'KeyF' }))).toBe(false)
    expect(isAdminShortcut(key({ ctrlKey: true, shiftKey: true, altKey: true, code: 'KeyF' }))).toBe(false)
    expect(isAdminShortcut(key({ shiftKey: true, code: 'KeyF' }))).toBe(false)
    expect(isAdminShortcut(key({ ctrlKey: true, code: 'KeyF' }))).toBe(false)
  })

  it('never fires while someone is typing', () => {
    const textarea = document.createElement('textarea')
    const input = document.createElement('input')
    const editable = document.createElement('div')
    editable.contentEditable = 'true'
    for (const target of [textarea, input, editable]) {
      expect(isAdminShortcut(key({ ctrlKey: true, shiftKey: true, code: 'KeyF' }, target))).toBe(false)
    }
  })
})

describe('createTapCounter', () => {
  it('fires once on five taps inside two seconds', () => {
    let t = 0
    const onTrigger = vi.fn()
    const counter = createTapCounter({ taps: 5, windowMs: 2000, onTrigger, now: () => t })
    for (let i = 0; i < 5; i++) { counter.tap(); t += 300 }
    expect(onTrigger).toHaveBeenCalledTimes(1)
    // And starts counting again from nothing.
    for (let i = 0; i < 4; i++) { counter.tap(); t += 300 }
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it('does not fire on five taps spread over more than two seconds', () => {
    let t = 0
    const onTrigger = vi.fn()
    const counter = createTapCounter({ taps: 5, windowMs: 2000, onTrigger, now: () => t })
    for (let i = 0; i < 5; i++) { counter.tap(); t += 600 }
    expect(onTrigger).not.toHaveBeenCalled()
  })
})

describe('useAdminShortcut', () => {
  it('listens while mounted, and stops when unmounted', () => {
    const onTrigger = vi.fn()
    const w = mount(defineComponent({ setup() { useAdminShortcut(onTrigger); return () => null } }))
    const press = () => document.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, shiftKey: true, code: 'KeyF', bubbles: true, cancelable: true }))
    press()
    expect(onTrigger).toHaveBeenCalledTimes(1)
    w.unmount()
    press()
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })
})
