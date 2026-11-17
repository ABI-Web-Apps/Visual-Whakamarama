<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref } from 'vue'
import { STAGE_BUTTON_CLASS, STAGE_TIP_CLASS, STAGE_TIP_END_CLASS } from '@/components/stage/stageControlClasses'
/**
 * Design doc §10.1's control bar: `⟲ Reset  ⛶ Fullscreen  ⌖ Locate lesion
 * ... 62/104`. Rendered by `CopperStage` itself, directly under its own
 * canvas -- one bar per stage, since three-up puts up to three stages on
 * screen at once and each needs its own.
 *
 * Deliberately presentational: everything it knows arrives as props and
 * everything it does (except fullscreen, which is pure DOM) leaves as an
 * event. That keeps the 3D wiring in one place and lets this file be tested
 * without a renderer.
 */
const props = withDefaults(defineProps<{
  /** Live slice number. 0/0 when the modality has no slices (Anatomy, and
   * the 2D ultrasound). */
  sliceIndex: number
  sliceMax: number
  /** The value to announce -- only changes once a scrub settles. */
  settledSliceIndex: number
  /** The case's lesion slice, or 0 when it has none. §7.2 shows the locate
   * control only for the five cases that actually have a lesion. */
  lesionSliceIndex: number
  /** False until the stage's renderer exists; the buttons do nothing until
   * then, so they say so rather than silently no-opping. */
  ready: boolean
  /** Three-up: icon-only buttons, since three bars share the width one had.
   * Every button keeps its `aria-label`, so nothing is lost for a screen
   * reader -- only the visible text goes. */
  compact?: boolean
  /** Marks the bar and its locate button as the guided tour's targets. Off
   * for a bar on a page the tour never visits (the patient's own results),
   * so the tour can never find one there. */
  tour?: boolean
  /** How to move through the slices, shown over the slice readout on hover,
   * for a stage whose slice gesture is not the case stages' drag. */
  sliceHint?: string
}>(), { tour: true })

const emit = defineEmits<{
  reset: []
  locate: []
}>()

const hasSlices = computed(() => props.sliceMax > 0)
const hasLesion = computed(() => props.lesionSliceIndex > 0 && hasSlices.value)

/**
 * The element fullscreen targets: this panel (canvas host + this bar),
 * marked `data-stage-panel` by `CopperStage`. Fullscreening the canvas alone
 * would take this bar off screen with it, leaving Esc as the only way back
 * out.
 */
const root = ref<HTMLElement>()
const isFullscreen = ref(false)

function syncFullscreen() {
  isFullscreen.value = Boolean(typeof document !== 'undefined' && document.fullscreenElement)
}

async function onFullscreen() {
  if (typeof document === 'undefined') return
  if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => {})
    return
  }
  // Prefers this panel; falls back to the whole stage column for any caller
  // that is not inside a panel. In three-up, fullscreening the column would
  // blow up all three panels when the reader asked for one.
  const target = root.value?.closest<HTMLElement>('[data-stage-panel]')
    ?? root.value?.closest<HTMLElement>('[data-stage-column]')
    ?? root.value?.parentElement
  // Safari and any browser with the Fullscreen API blocked by permissions
  // policy reject this; there is nothing to recover, and an unhandled
  // rejection here would surface as a dev-overlay error on a decorative
  // control.
  await target?.requestFullscreen?.().catch(() => {})
}

onMounted(() => {
  syncFullscreen()
  document.addEventListener('fullscreenchange', syncFullscreen)
})
onScopeDispose(() => {
  // Guarded for a non-browser environment, where there is no document.
  if (typeof document !== 'undefined') {
    document.removeEventListener('fullscreenchange', syncFullscreen)
  }
})

/** Shared with every other control that sits in a panel's bar
 * (stageControlClasses.ts), so all of them look and behave alike. */
const buttonClass = STAGE_BUTTON_CLASS
const tipClass = STAGE_TIP_CLASS
const tipEndClass = STAGE_TIP_END_CLASS
</script>

<template>
  <div
    ref="root"
    :data-tour="props.tour ? 'stage-controls' : undefined"
    class="tw:flex tw:shrink-0 tw:flex-wrap tw:items-center tw:gap-2 tw:border-t tw:border-border
           tw:bg-surface tw:py-2 tw:text-text"
    :class="props.compact ? 'tw:px-3' : 'tw:px-4'"
  >
    <button
      type="button"
      :class="buttonClass"
      :disabled="!props.ready"
      aria-label="Reset view"
      @click="emit('reset')"
    >
      <svg viewBox="0 0 24 24" class="tw:size-4" aria-hidden="true">
        <path fill="currentColor" d="M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7" />
      </svg>
      <span v-if="!props.compact">Reset view</span>
      <span v-else :class="tipClass" aria-hidden="true">Reset view</span>
    </button>

    <button
      type="button"
      :class="buttonClass"
      :aria-pressed="isFullscreen"
      :aria-label="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
      @click="onFullscreen"
    >
      <svg viewBox="0 0 24 24" class="tw:size-4" aria-hidden="true">
        <!--
          Two glyphs, not one.

          The label used to carry the state ("Fullscreen" / "Exit
          fullscreen"), but compact mode hides labels, so in three-up the
          button looked identical in both states and gave the reader nothing
          to go on. Corners pointing OUT means "expand"; corners pointing IN
          means "collapse" -- the same convention video players use, and
          legible at 16px without a label beside it.
        -->
        <path
          v-if="isFullscreen"
          fill="currentColor"
          d="M3 8h5V3H6v3H3zm13-5v3h3v2h-5V3zM3 16h5v5H6v-3H3zm13 5v-3h3v-2h-5v5z"
        />
        <path
          v-else
          fill="currentColor"
          d="M5 5h5V3H3v7h2zm14 0v5h2V3h-7v2zM5 19v-5H3v7h7v-2zm14 0h-5v2h7v-7h-2z"
        />
      </svg>
      <span v-if="!props.compact">{{ isFullscreen ? 'Exit fullscreen' : 'Fullscreen' }}</span>
      <span v-else :class="tipClass" aria-hidden="true">
        {{ isFullscreen ? 'Exit fullscreen' : 'Fullscreen' }}
      </span>
    </button>

    <button
      v-if="hasLesion"
      type="button"
      :data-tour="props.tour ? 'locate-lesion' : undefined"
      :class="`${buttonClass} tw:font-bold tw:text-brand-hover tw:hover:bg-brand/10`"
      :disabled="!props.ready"
      aria-label="Locate lesion"
      @click="emit('locate')"
    >
      <svg viewBox="0 0 24 24" class="tw:size-4" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          d="M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8m0-6v3m0 14v3M2 12h3m14 0h3"
        />
      </svg>
      <span v-if="!props.compact">Locate lesion</span>
      <span v-else :class="tipClass" aria-hidden="true">Locate lesion</span>
    </button>

    <!-- A stage's own controls beyond these three (the MRI viewer's views,
         the report's download), in the same bar and the same button style. -->
    <slot />

    <!--
      Two nodes for one number, on purpose (controller correction C11). The
      visible one updates on every frame of an eased scrub, which is right
      for the eye and catastrophic for a screen reader: an `aria-live` region
      bound to it queues one utterance per frame. The live region instead
      carries `settledSliceIndex`, which changes only when the scrub stops.
      `tabular-nums` is design doc §7.5's own requirement -- without it the
      readout's width jitters as the digits change.

      Compact (three-up, icon-only buttons) drops the "Slice " prefix so
      three narrow bars can each still fit their own readout.
    -->
    <p
      v-if="hasSlices"
      class="tw:group tw:relative tw:ml-auto tw:text-body-sm tw:tabular-nums"
      aria-hidden="true"
    >
      <span class="tw:opacity-80">
        <template v-if="props.compact">{{ props.sliceIndex }} / {{ props.sliceMax }}</template>
        <template v-else>Slice {{ props.sliceIndex }} / {{ props.sliceMax }}</template>
      </span>
      <span v-if="props.sliceHint" data-slice-hint :class="tipEndClass">{{ props.sliceHint }}</span>
    </p>
    <span v-if="hasSlices" class="tw:sr-only" role="status" aria-live="polite">
      Slice {{ props.settledSliceIndex }} of {{ props.sliceMax }}
    </span>
  </div>
</template>
