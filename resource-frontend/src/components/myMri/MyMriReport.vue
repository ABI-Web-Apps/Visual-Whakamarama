<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import MyMriColumnState from '@/components/myMri/MyMriColumnState.vue'
import StageControls from '@/components/stage/StageControls.vue'
import { STAGE_BUTTON_CLASS, STAGE_TIP_CLASS } from '@/components/stage/stageControlClasses'
import { MY_MRI_COPY } from '@/content/myMri'
import { fetchBlob, isAbort, toMyMriError } from '@/myMri/api'
import type { MyMriError } from '@/myMri/api'

/**
 * The report column's body: the PDF, and under it the same control bar every
 * panel has (StageControls) -- Reset view puts the PDF back on its first page
 * at its opening zoom, Fullscreen fills the screen with it, and Download sits
 * beside them. The column's heading is the page's (ResultColumn).
 */
const props = defineProps<{
  urlFor: (tz: string) => string
  cohort: string
  withReload: <T>(fn: () => Promise<T>) => Promise<T>
}>()

const status = ref<'loading' | 'ready' | 'error'>('loading')
const summary = ref('')
const objectUrl = ref<string | null>(null)
/** Bumped by Reset view: a new frame opens the PDF as it first opened. */
const frameKey = ref(0)
// Phones cannot show a blob PDF inline; only an explicit `false` switches to links.
const inline = computed(() => navigator.pdfViewerEnabled !== false)

let controller: AbortController | null = null

function release() {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  objectUrl.value = null
}

function messageFor(e: MyMriError): string {
  return e.code === 'no_findings' ? MY_MRI_COPY.reportNoFindings : e.summary
}

/** Fetch the report on its own; the session and the 3D column are not involved. */
async function refetch(): Promise<void> {
  controller?.abort()
  const mine = new AbortController()
  controller = mine
  status.value = 'loading'
  release()
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const blob = await props.withReload(() => fetchBlob(props.urlFor(tz), mine.signal))
    if (mine.signal.aborted) return
    objectUrl.value = URL.createObjectURL(blob)
    status.value = 'ready'
  } catch (e) {
    if (isAbort(e) || mine.signal.aborted) return
    summary.value = messageFor(toMyMriError(e) as MyMriError)
    status.value = 'error'
  }
}

function resetView() {
  frameKey.value++
}

onBeforeUnmount(() => {
  controller?.abort()
  release()
})
void refetch()
defineExpose({ refetch })

const linkClass = 'tw:rounded-card tw:border tw:border-border tw:px-3 tw:py-1 tw:text-body-sm tw:font-bold tw:text-text'
</script>

<template>
  <div data-stage-panel class="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:bg-surface">
    <!-- `data-stage-panel`: what the bar's Fullscreen fills the screen with. -->
    <!-- The report column only exists once the session is ready, so its state is the live one. -->
    <MyMriColumnState :status="status" :summary="summary" :progress-text="MY_MRI_COPY.reportLoading" live @retry="refetch()">
      <iframe
        v-if="inline && objectUrl"
        :key="frameKey"
        :src="objectUrl"
        :title="MY_MRI_COPY.reportTitle"
        class="tw:min-h-96 tw:w-full tw:flex-1 tw:border-0 tw:bg-white"
      />
      <div v-else-if="objectUrl" class="tw:p-4">
        <a :href="objectUrl" target="_blank" rel="noopener" :class="linkClass">{{ MY_MRI_COPY.reportOpen }}</a>
      </div>
    </MyMriColumnState>

    <StageControls
      :slice-index="0"
      :slice-max="0"
      :settled-slice-index="0"
      :lesion-slice-index="0"
      :ready="status === 'ready' && inline"
      :compact="true"
      :tour="false"
      @reset="resetView()"
    >
      <a
        v-if="objectUrl"
        :href="objectUrl"
        :download="`${cohort}-mri-report.pdf`"
        :class="STAGE_BUTTON_CLASS"
        :aria-label="MY_MRI_COPY.reportDownload"
      >
        <svg
          viewBox="0 0 24 24"
          class="tw:size-4"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />
        </svg>
        <span :class="STAGE_TIP_CLASS" aria-hidden="true">{{ MY_MRI_COPY.reportDownload }}</span>
      </a>
    </StageControls>
  </div>
</template>
