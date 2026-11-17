<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import type { PaneSplit } from '@/composables/usePaneSplit'

/**
 * The handle between two side-by-side panels: drag it to give one more width
 * and the other less (usePaneSplit). The arrow keys do the same a step at a
 * time, Shift for a bigger step, and a double-click or Enter puts every panel
 * in the row back to its default width.
 *
 * A focusable `separator`, the WAI-ARIA window-splitter pattern: its value is
 * the first panel's share of the pair. Shown only where the panels sit side
 * by side (above the 1000px container width); stacked, there is nothing to
 * resize.
 *
 * The pointer is captured on press, so a drag that crosses a canvas or the
 * report's PDF frame keeps coming here; the row also stops the panels taking
 * the pointer while it lasts (`ROW_DRAGGING_CLASS`).
 */
const props = defineProps<{
  split: PaneSplit
  before: string
  after: string
  /** Names the two panels, e.g. "Resize Current MRI and Previous MRI". */
  label: string
}>()

const KEY_STEP_PX = 24
const el = ref<HTMLElement | null>(null)
let drag: { x: number, before: number, after: number, pointer: number } | null = null

/** The two panels this gutter sits between, by their `data-split-pane` marks. */
function widths(): [number, number] | null {
  const row = el.value?.parentElement
  const find = (id: string) => row?.querySelector<HTMLElement>(`:scope > [data-split-pane="${id}"]`)
  const before = find(props.before)
  const after = find(props.after)
  if (!before || !after) return null
  return [before.getBoundingClientRect().width, after.getBoundingClientRect().width]
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  const measured = widths()
  if (!measured) return
  event.preventDefault()
  drag = { x: event.clientX, before: measured[0], after: measured[1], pointer: event.pointerId }
  try { el.value?.setPointerCapture(event.pointerId) }
  catch { /* a synthetic pointer has nothing to capture; the drag still works */ }
  props.split.dragging.value = true
}

function onPointerMove(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointer) return
  const dx = event.clientX - drag.x
  props.split.resizePair(props.before, props.after, drag.before + dx, drag.after - dx)
}

function endDrag() {
  if (!drag) return
  drag = null
  props.split.dragging.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    props.split.reset()
    event.preventDefault()
    return
  }
  const direction = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
  if (!direction) return
  const measured = widths()
  if (!measured) return
  const step = direction * KEY_STEP_PX * (event.shiftKey ? 4 : 1)
  props.split.resizePair(props.before, props.after, measured[0] + step, measured[1] - step)
  event.preventDefault()
}

// A gutter removed mid-drag (its panel collapsed) must not leave the row inert.
onBeforeUnmount(endDrag)
</script>

<template>
  <div
    ref="el"
    role="separator"
    aria-orientation="vertical"
    :aria-label="props.label"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="props.split.pairPercent(props.before, props.after)"
    tabindex="0"
    data-pane-gutter
    class="tw:group tw:hidden tw:w-3 tw:shrink-0 tw:cursor-col-resize tw:touch-none tw:items-center tw:justify-center
           tw:rounded-full tw:@[1000px]:flex"
    :style="{ order: String(props.split.gutterOrder(props.after)) }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="endDrag"
    @pointercancel="endDrag"
    @lostpointercapture="endDrag"
    @dblclick="props.split.reset()"
    @keydown="onKeydown"
  >
    <!-- The grip: quiet at rest, brand on hover, focus and while dragged. -->
    <span
      aria-hidden="true"
      class="tw:h-10 tw:w-1 tw:rounded-full tw:transition-colors tw:duration-150"
      :class="props.split.dragging.value
        ? 'tw:bg-brand'
        : 'tw:bg-border-strong tw:group-hover:bg-brand/70 tw:group-focus-visible:bg-brand'"
    />
  </div>
</template>
