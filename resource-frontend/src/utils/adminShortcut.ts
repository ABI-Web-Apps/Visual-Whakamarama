import { onBeforeUnmount, onMounted } from 'vue'

/**
 * The two hidden ways to the feedback review page (which still asks for a
 * password: finding the way in is not getting in).
 *
 * - Keyboard: Ctrl + Shift + F, on every platform -- Ctrl, not Cmd, on a Mac,
 *   where Cmd + Shift + F belongs to the browser. Matched by the physical key
 *   (`code`), so a layout where Shift + Option turns F into another letter
 *   still works, and never while someone is typing in a field.
 * - Touch (no keyboard): five taps on About's version line inside two seconds.
 */
export function isAdminShortcut(event: KeyboardEvent): boolean {
  if (!event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey) return false
  if (event.code !== 'KeyF') return false
  const target = event.target as HTMLElement | null
  if (!target || typeof target.closest !== 'function') return true
  return !(target.closest('input, textarea, select') || target.isContentEditable || target.closest('[contenteditable="true"]'))
}

/** Calls `onTrigger` from the moment it is mounted to the moment it is not. */
export function useAdminShortcut(onTrigger: () => void): void {
  function onKeydown(event: KeyboardEvent) {
    if (!isAdminShortcut(event)) return
    event.preventDefault()
    onTrigger()
  }
  onMounted(() => document.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
}

/** Fires `onTrigger` once `taps` taps land within `windowMs`, then starts counting again. */
export function createTapCounter(opts: { taps: number, windowMs: number, onTrigger: () => void, now?: () => number }) {
  const now = opts.now ?? (() => Date.now())
  let times: number[] = []
  return {
    tap() {
      const t = now()
      times = [...times.filter(s => t - s < opts.windowMs), t]
      if (times.length >= opts.taps) {
        times = []
        opts.onTrigger()
      }
    },
  }
}
