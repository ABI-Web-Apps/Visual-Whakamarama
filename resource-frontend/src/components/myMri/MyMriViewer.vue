<script lang="ts">
/** Numbers each viewer's help text id; see ResultColumn on why not `useId()`. */
let viewerCount = 0
</script>

<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue'
import StageControls from '@/components/stage/StageControls.vue'
import { STAGE_TIP_CLASS } from '@/components/stage/stageControlClasses'
import { MY_MRI_COPY } from '@/content/myMri'
import { findingColour } from '@/myMri/findingColour'
import { useMyMriScene } from '@/myMri/useMyMriScene'
import type { MyMriView } from '@/myMri/useMyMriScene'
import type { FindingSummary } from '@/myMri/useMyMriSession'

/**
 * The patient's MRI: its three planes with the marked areas over them, and
 * the views -- 3D, or one plane face-on, Ctrl+scroll moving through its slices.
 *
 * Built like a case stage (CopperStage) so every panel reads the same: the
 * scan on the stage ground, and under it the same control bar (StageControls)
 * with Reset view and Fullscreen, the view switch in the bar beside them, and
 * the slice readout at its end. Only the colour key sits over the scan.
 *
 * A load failure shows over the canvas, never as a blank stage, with a Try
 * again of its own: it emits `retry`, and the page rebuilds this viewer alone.
 * A scan with no marked areas is not a failure: the planes show with a note.
 * `settled` fires once the scan is ready or has failed, so a page can hold
 * other downloads back until then.
 */
const props = defineProps<{
  mri: string
  mask: string
  findings: FindingSummary[]
  /** The view to open on, and the one Reset returns to. The scene defaults to 3D. */
  initialView?: MyMriView
  /** What a screen reader calls the scan; a page with two viewers names each. */
  label?: string
}>()
const emit = defineEmits<{ retry: [], settled: [] }>()

const helpId = `vw-my-mri-help-${++viewerCount}`
const host = ref<HTMLElement | null>(null)
// Read once: a different scan is a different viewer (the page keys it by URL).
const { status, error, noMask, view, slice, setView, resetView } = useMyMriScene(host, {
  mri: props.mri,
  mask: props.mask,
  findings: props.findings,
  initialView: props.initialView,
})

let settled = false
watch(status, (now) => {
  if (settled || now === 'loading') return
  settled = true
  emit('settled')
}, { immediate: true })

/**
 * The slice a screen reader hears: the readout once the wheel has stopped,
 * not every step of a scroll, which would queue an announcement per step.
 * A change of view is not a scroll: its slice is announced at once, so the
 * new view's total never pairs with the old view's slice.
 */
const SETTLE_MS = 300
const settledSlice = ref(slice.value?.current ?? 0)
let settleTimer: ReturnType<typeof setTimeout> | undefined
watch([view, () => slice.value?.current ?? 0], ([nowView, current], [beforeView]) => {
  clearTimeout(settleTimer)
  if (nowView !== beforeView) settledSlice.value = current
  else settleTimer = setTimeout(() => { settledSlice.value = current }, SETTLE_MS)
})
onScopeDispose(() => clearTimeout(settleTimer))

/** The view switch: the bar's own buttons, with the bar's tooltip. */
const viewClass = 'tw:group tw:relative tw:flex tw:min-h-11 tw:items-center tw:rounded-ctl tw:px-1.5 tw:text-body-sm '
  + 'tw:disabled:opacity-50'
</script>

<template>
  <div data-stage-panel class="tw:flex tw:min-h-0 tw:min-w-0 tw:flex-1 tw:flex-col tw:bg-bg">
    <!-- `data-stage-panel`: what the bar's Fullscreen fills the screen with --
         the scan and the bar together, as on a case stage. -->
    <div class="tw:stage-ground tw:relative tw:min-h-72 tw:flex-1 tw:overflow-hidden">
      <!-- Always mounted: the renderer is built into this element once. -->
      <div
        ref="host"
        class="tw:absolute tw:inset-0"
        role="img"
        :aria-label="props.label ?? MY_MRI_COPY.viewerLabel"
        :aria-describedby="helpId"
      />
      <p :id="helpId" class="tw:sr-only">
        {{ view === '3d' ? MY_MRI_COPY.viewerHint : MY_MRI_COPY.viewerSliceHint }}
      </p>

      <div
        v-if="status === 'error'"
        role="alert"
        class="tw:absolute tw:inset-0 tw:flex tw:flex-col tw:items-center tw:justify-center tw:gap-3 tw:bg-surface-sunken tw:p-4
               tw:text-center tw:text-body-sm tw:text-text"
      >
        <p>{{ error }}</p>
        <button type="button" class="tw:rounded-card tw:border tw:border-border tw:px-3 tw:py-1 tw:font-bold tw:text-text" @click="$emit('retry')">
          {{ MY_MRI_COPY.tryAgain }}
        </button>
      </div>

      <template v-else>
        <div
          v-if="status === 'loading'"
          class="tw:pointer-events-none tw:absolute tw:inset-0 tw:flex tw:items-center tw:justify-center"
        >
          <div class="tw:pane tw:flex tw:items-center tw:gap-3 tw:rounded-card tw:px-4 tw:py-3 tw:text-text" role="status">
            <span
              class="tw:size-4 tw:animate-spin tw:rounded-full tw:border-2 tw:border-current tw:border-t-transparent"
              aria-hidden="true"
            />
            <span class="tw:text-body-sm">{{ MY_MRI_COPY.loading }}</span>
          </div>
        </div>

        <!-- The colour key, over the scan's corner: it explains the scan, so it
             stays with it. Not interactive: drags over it reach the canvas. -->
        <div class="tw:pointer-events-none tw:absolute tw:bottom-3 tw:left-3 tw:max-w-[calc(100%-1.5rem)]">
          <p
            v-if="noMask"
            role="status"
            class="tw:pane tw:rounded-card tw:px-3 tw:py-2 tw:text-caption tw:text-text-muted"
          >
            {{ MY_MRI_COPY.viewerNoMask }}
          </p>
          <ul
            v-else-if="props.findings.length"
            :aria-label="MY_MRI_COPY.viewerLegendLabel"
            class="tw:pane tw:flex tw:flex-col tw:gap-1 tw:rounded-card tw:px-3 tw:py-2 tw:text-caption tw:text-text"
          >
            <li v-for="finding in props.findings" :key="finding.channel" class="tw:flex tw:items-center tw:gap-2">
              <span
                class="tw:size-3 tw:shrink-0 tw:rounded-full"
                :style="{ backgroundColor: findingColour(finding.color) }"
                aria-hidden="true"
              />
              {{ finding.label }}
            </li>
          </ul>
        </div>
      </template>
    </div>

    <StageControls
      :slice-index="slice?.current ?? 0"
      :slice-max="slice?.total ?? 0"
      :settled-slice-index="settledSlice"
      :lesion-slice-index="0"
      :ready="status === 'ready'"
      :compact="true"
      :tour="false"
      :slice-hint="MY_MRI_COPY.viewerSliceHint"
      @reset="resetView()"
    >
      <!-- The views, in the bar after Reset view and Fullscreen. A container
           that takes the room the bar has left, so the names shorten (Ax, Cor,
           Sag) where the full ones do not fit beside the slice readout. Its
           minimum is the short names' width, so below that the bar wraps
           instead of overlapping them.

           The name comes from what is shown, never an aria-label, so it always
           contains the visible word (WCAG 2.5.3, for a reader who says what
           they see): "Coronal" in full, "Cor Coronal" short -- the full word
           rides along off screen, and is display:none once it is visible. -->
      <div class="tw:@container tw:min-w-33 tw:flex-1">
        <div
          role="group"
          :aria-label="MY_MRI_COPY.viewerViewsLabel"
          class="tw:flex tw:items-center"
        >
          <button
            v-for="option in MY_MRI_COPY.viewerViews"
            :key="option.view"
            type="button"
            :class="[viewClass, view === option.view
              ? 'tw:bg-brand-subtle tw:font-bold tw:text-brand-hover'
              : 'tw:text-text-muted tw:hover:bg-current/10']"
            :aria-pressed="view === option.view"
            :disabled="status !== 'ready'"
            @click="setView(option.view)"
          >
            <span class="tw:hidden tw:@[13rem]:inline">{{ option.label }}</span>
            <template v-if="option.short !== option.label">
              <span class="tw:@[13rem]:hidden">{{ option.short }}</span>
              <span class="tw:sr-only tw:@[13rem]:hidden">{{ ` ${option.label}` }}</span>
            </template>
            <span v-else class="tw:@[13rem]:hidden">{{ option.short }}</span>
            <span :class="STAGE_TIP_CLASS" aria-hidden="true">{{ option.title }}</span>
          </button>
        </div>
      </div>
    </StageControls>
  </div>
</template>
