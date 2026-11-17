import { computed, ref } from 'vue'

/**
 * Side-by-side panels whose widths the reader can drag.
 *
 * Every row of panels (a case's three, My Images' three, the MRI page's three,
 * My Report's two) shares the width by weight: each panel is a flex item with
 * basis 0 and its weight as its grow factor, so the widths stay in proportion
 * however wide the row is. Dragging the gutter between two panels moves width
 * from one to the other and leaves the rest alone; the others still adapt to
 * the row, because they are proportions, not pixels.
 *
 * A panel can be collapsed to a rail at the end of the row (the MRI page's
 * Previous MRI, which has no scan to show): the panels left share the row,
 * and expanding it puts it back where it was, at the width it had.
 *
 * The page renders the panels itself and binds `paneStyle`/`paneAttrs`, and
 * renders a `PaneGutter` for each of `gutters`; the layout below the row
 * breakpoint (stacked, or one-up) stays the page's own.
 *
 * State lives with the page instance, which is kept alive: a reader's widths
 * survive moving to another page and back, and start fresh with the app.
 */

export interface PaneSpec {
  id: string
  /** The panel's share of the row by default; Reset (double-click a gutter) returns to it. */
  weight: number
}

/** A dragged panel never gets narrower than this, unless the pair itself is. */
export const MIN_PANE_PX = 180

/**
 * An open panel's sizing in the row: basis 0 and its weight as its grow
 * factor (`paneStyle` sets the variable). Above the 1000px container width
 * only -- below it the page lays the panels out its own way.
 */
export const PANE_CLASS = 'tw:min-w-0 tw:@[1000px]:basis-0 tw:@[1000px]:grow-(--vw-pane-grow)'

/**
 * On the row while a gutter is dragged: the resize cursor everywhere, no text
 * selection, and no pointer input to the panels -- a canvas or the report's
 * PDF frame would otherwise take the pointer as it crossed them.
 */
/** The gutter's accessible name: the two panels it sits between. */
export function resizeLabel(before: string, after: string): string {
  return `Resize ${before} and ${after}`
}

export const ROW_DRAGGING_CLASS = 'tw:cursor-col-resize tw:select-none tw:[&>[data-split-pane]]:pointer-events-none'

export function usePaneSplit(specs: readonly PaneSpec[]) {
  const ids = specs.map(s => s.id)
  const defaults = Object.fromEntries(specs.map(s => [s.id, s.weight])) as Record<string, number>
  const weights = ref<Record<string, number>>({ ...defaults })
  const collapsed = ref<Record<string, boolean>>({})
  /** True while a gutter is being dragged: the row then keeps pointer input from the panels. */
  const dragging = ref(false)

  const visible = computed(() => ids.filter(id => !collapsed.value[id]))
  const hidden = computed(() => ids.filter(id => collapsed.value[id]))

  /** The gutter between each pair of neighbouring open panels. */
  const gutters = computed(() => visible.value.slice(1).map((after, i) => ({ before: visible.value[i]!, after })))

  /**
   * Open panels and their gutters keep their order; collapsed rails go after
   * them all, at the end of the row (`order`, so the DOM order -- and the
   * reading order -- is the page's own).
   */
  function orderOf(id: string): number {
    const at = visible.value.indexOf(id)
    return at >= 0 ? at * 2 : visible.value.length * 2 + hidden.value.indexOf(id)
  }

  function gutterOrder(after: string): number {
    return orderOf(after) - 1
  }

  function paneStyle(id: string): Record<string, string> {
    return { '--vw-pane-grow': String(weights.value[id] ?? 1), 'order': String(orderOf(id)) }
  }

  /** Marks the element as the panel `id`, so a gutter can measure it. */
  function paneAttrs(id: string): Record<string, string> {
    return { 'data-split-pane': id }
  }

  /**
   * Gives `before` and `after` the widths `beforePx` and `afterPx` (their sum
   * unchanged), clamped so neither drops below `MIN_PANE_PX`. Their combined
   * weight is kept, so no other panel moves.
   */
  function resizePair(before: string, after: string, beforePx: number, afterPx: number): void {
    const total = beforePx + afterPx
    if (!(total > 0)) return
    const min = Math.min(MIN_PANE_PX, total / 2)
    const left = Math.min(total - min, Math.max(min, beforePx))
    const share = (weights.value[before] ?? 1) + (weights.value[after] ?? 1)
    weights.value = {
      ...weights.value,
      [before]: (share * left) / total,
      [after]: (share * (total - left)) / total,
    }
  }

  /** `before`'s share of the pair, as a percentage: the gutter's value. */
  function pairPercent(before: string, after: string): number {
    const a = weights.value[before] ?? 1
    const b = weights.value[after] ?? 1
    return Math.round((a / (a + b)) * 100)
  }

  function reset(): void {
    weights.value = { ...defaults }
  }

  function collapse(id: string): void {
    collapsed.value = { ...collapsed.value, [id]: true }
  }

  function expand(id: string): void {
    collapsed.value = { ...collapsed.value, [id]: false }
  }

  return {
    weights,
    collapsed,
    dragging,
    visible,
    gutters,
    paneStyle,
    paneAttrs,
    gutterOrder,
    resizePair,
    pairPercent,
    reset,
    collapse,
    expand,
  }
}

export type PaneSplit = ReturnType<typeof usePaneSplit>
