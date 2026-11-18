<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import MyMriColumnState from '@/components/myMri/MyMriColumnState.vue'
import ReportPages from '@/components/myMri/ReportPages.vue'
import StageControls from '@/components/stage/StageControls.vue'
import { STAGE_BUTTON_CLASS, STAGE_TIP_CLASS } from '@/components/stage/stageControlClasses'
import { MY_MRI_COPY } from '@/content/myMri'
import { fetchBlob, fetchJson, isAbort, toMyMriError } from '@/myMri/api'
import type { MyMriError, ReportPage } from '@/myMri/api'
import { prefersTouchReader } from '@/utils/touchReader'

/**
 * The report column's body: the PDF, and under it the same control bar every
 * panel has (StageControls). The column's heading is the page's (ResultColumn).
 *
 * Two readers, chosen once:
 *
 * - `frame` (a mouse, a browser that shows PDFs inline): the PDF in an
 *   iframe, the browser's own viewer. Reset view reopens it at page 1.
 * - `pages` (a touch device, or a browser that will not show a PDF inline):
 *   the backend's page images, one under the other (`ReportPages`). An
 *   iframe there shows page 1 as a still picture on iOS and nothing on
 *   Android. Reset view scrolls back to page 1, and Open hands the PDF to the
 *   device's own viewer, which shows every page and pinch-zooms.
 *
 * Both fetch the PDF itself, for Download (and Open). The page list comes
 * with it, so one loading state, one error and one Try again cover both.
 */
interface ReportUrls { report: string, reportPages: string, reportPage: (index: number) => string }

const props = defineProps<{
  urls: ReportUrls
  cohort: string
  withReload: <T>(fn: () => Promise<T>) => Promise<T>
}>()

const reader: 'frame' | 'pages' = prefersTouchReader() || navigator.pdfViewerEnabled === false ? 'pages' : 'frame'

const status = ref<'loading' | 'ready' | 'error'>('loading')
const summary = ref('')
const objectUrl = ref<string | null>(null)
const pages = ref<ReportPage[]>([])
/** Bumped by Reset view: a new frame opens the PDF as it first opened. */
const frameKey = ref(0)
const pagesEl = ref<HTMLElement | null>(null)

let controller: AbortController | null = null

function release() {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  objectUrl.value = null
}

function messageFor(e: MyMriError): string {
  return e.code === 'no_report' || e.code === 'no_findings' ? MY_MRI_COPY.reportNone : e.summary
}

/** Fetch the report on its own; the session and the 3D column are not involved. */
async function refetch(): Promise<void> {
  controller?.abort()
  const mine = new AbortController()
  controller = mine
  status.value = 'loading'
  release()
  try {
    const [blob, list] = await Promise.all([
      props.withReload(() => fetchBlob(props.urls.report, mine.signal)),
      reader === 'pages'
        ? props.withReload(() => fetchJson<{ pages: ReportPage[] }>(props.urls.reportPages, mine.signal))
        : Promise.resolve(null),
    ])
    if (mine.signal.aborted) return
    objectUrl.value = URL.createObjectURL(blob)
    pages.value = list?.pages ?? []
    status.value = 'ready'
  } catch (e) {
    if (isAbort(e) || mine.signal.aborted) return
    summary.value = messageFor(toMyMriError(e) as MyMriError)
    status.value = 'error'
  }
}

function resetView() {
  if (reader === 'frame') frameKey.value++
  else pagesEl.value?.scrollTo({ top: 0 })
}

onBeforeUnmount(() => {
  controller?.abort()
  release()
})
void refetch()
defineExpose({ refetch })
</script>

<template>
  <div data-stage-panel class="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:bg-surface">
    <!-- `data-stage-panel`: what the bar's Fullscreen fills the screen with. -->
    <!-- The report column only exists once the session is ready, so its state is the live one. -->
    <MyMriColumnState :status="status" :summary="summary" :progress-text="MY_MRI_COPY.reportLoading" live @retry="refetch()">
      <iframe
        v-if="reader === 'frame' && objectUrl"
        :key="frameKey"
        :src="objectUrl"
        :title="MY_MRI_COPY.reportTitle"
        class="tw:min-h-96 tw:w-full tw:flex-1 tw:border-0 tw:bg-white"
      />
      <!-- Stacked (a phone, a narrow tablet) the page itself scrolls, so the
           pages take their natural height: a scroller inside a scroller is
           hard to work with a finger. Side by side the column has a fixed
           height, so the pages scroll inside it. -->
      <div
        v-else-if="reader === 'pages' && objectUrl"
        ref="pagesEl"
        data-report-pages
        :aria-label="MY_MRI_COPY.reportTitle"
        role="document"
        class="tw:bg-surface-sunken tw:p-3 tw:@[1000px]:min-h-0 tw:@[1000px]:flex-1 tw:@[1000px]:overflow-y-auto"
      >
        <ReportPages :pages="pages" :page-url="urls.reportPage" />
      </div>
    </MyMriColumnState>

    <StageControls
      :slice-index="0"
      :slice-max="0"
      :settled-slice-index="0"
      :lesion-slice-index="0"
      :ready="status === 'ready'"
      :compact="true"
      :tour="false"
      @reset="resetView()"
    >
      <a
        v-if="objectUrl && reader === 'pages'"
        :href="objectUrl"
        target="_blank"
        rel="noopener"
        :class="STAGE_BUTTON_CLASS"
        :aria-label="MY_MRI_COPY.reportOpen"
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
          <path d="M14 4h6v6M20 4l-8.5 8.5M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
        </svg>
        <span :class="STAGE_TIP_CLASS" aria-hidden="true">{{ MY_MRI_COPY.reportOpen }}</span>
      </a>
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
