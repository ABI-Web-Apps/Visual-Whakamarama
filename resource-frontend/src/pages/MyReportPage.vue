<script setup lang="ts">
import { computed } from 'vue'
import PaneGutter from '@/components/layout/PaneGutter.vue'
import ResultColumn from '@/components/myImages/ResultColumn.vue'
import MyMriColumnState from '@/components/myMri/MyMriColumnState.vue'
import MyMriReport from '@/components/myMri/MyMriReport.vue'
import MyMriViewer from '@/components/myMri/MyMriViewer.vue'
import { PANE_CLASS, ROW_DRAGGING_CLASS, resizeLabel, usePaneSplit } from '@/composables/usePaneSplit'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import { MY_MRI_COPY, colourSentence, sessionProgressText } from '@/content/myMri'
import { APP_TITLE, useDocumentTitle } from '@/navigation/head'
import { providePageRoute } from '@/navigation/router'
import type { PageRoute } from '@/navigation/routes'
import { useMyMriSession } from '@/myMri/useMyMriSession'
import { useViewerRetry } from '@/myMri/useViewerRetry'

/**
 * My Report: the patient's MRI beside their report, in the same columns and
 * control bars as every other panel. The report is what there is to read, so
 * it opens on two thirds of the row and the scan on one; the gutter between
 * them moves that.
 */
const props = defineProps<{ route: PageRoute }>()
providePageRoute(computed(() => props.route))

const session = useMyMriSession()
const { cohort, status, error, progress, total, reload, urls, findings, withReload } = session

const progressText = computed(() => sessionProgressText(progress.value, total.value))
const sentence = computed(() => colourSentence(findings.value))

/**
 * The viewer's own Try again rebuilds the scan alone; the report column stays
 * as it is. Session failures keep the column's Try again (`reload`).
 */
const { attempt: viewerAttempt, retry: retryViewer } = useViewerRetry(session)

const split = usePaneSplit([
  { id: 'mri', weight: 1 },
  { id: 'report', weight: 2 },
])

useDocumentTitle(() => `${MY_MRI_COPY.title} — ${APP_TITLE}`)
</script>

<template>
  <DefaultLayout :square-stage="false" stage-label="Your MRI scan and report">
    <template #heading>
      <div class="tw:p-6 tw:pb-0">
        <p class="tw:text-caption tw:font-bold tw:uppercase tw:tracking-wide tw:text-group-results">
          {{ MY_MRI_COPY.eyebrow }}
        </p>
        <h1 class="tw:text-h1 tw:font-bold tw:text-text">{{ MY_MRI_COPY.title }}</h1>
      </div>
    </template>

    <template #stage>
      <!-- Side by side above a 1000px column, as on the other pages, with a
           gutter to drag between them; stacked and scrolling below it. -->
      <div class="tw:@container tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-y-auto">
        <div
          class="tw:flex tw:flex-col tw:gap-3 tw:p-3
                 tw:@[1000px]:min-h-0 tw:@[1000px]:flex-1 tw:@[1000px]:flex-row tw:@[1000px]:gap-0"
          :class="split.dragging.value ? ROW_DRAGGING_CLASS : ''"
        >
          <ResultColumn
            v-bind="split.paneAttrs('mri')"
            :class="PANE_CLASS"
            :style="split.paneStyle('mri')"
            :label="MY_MRI_COPY.viewerHeading"
          >
            <MyMriColumnState :status="status" :summary="error?.summary" :progress-text="progressText" live @retry="reload()">
              <MyMriViewer
                v-if="urls"
                :key="`${urls.mri}#${viewerAttempt}`"
                :mri="urls.mri"
                :mask="urls.mask"
                :findings="findings"
                initial-view="axial"
                @retry="retryViewer()"
              />
            </MyMriColumnState>
          </ResultColumn>
          <PaneGutter
            :split="split"
            before="mri"
            after="report"
            :label="resizeLabel(MY_MRI_COPY.viewerHeading, MY_MRI_COPY.reportHeading)"
          />
          <ResultColumn
            v-bind="split.paneAttrs('report')"
            :class="PANE_CLASS"
            :style="split.paneStyle('report')"
            :label="MY_MRI_COPY.reportHeading"
          >
            <MyMriReport
              v-if="status === 'ready' && urls"
              :urls="urls"
              :cohort="cohort"
              :with-reload="withReload"
            />
            <MyMriColumnState v-else :status="status" :summary="error?.summary" :progress-text="progressText" @retry="reload()" />
          </ResultColumn>
        </div>
      </div>
    </template>

    <template #content>
      <div class="tw:flex tw:flex-col tw:gap-4 tw:p-6 tw:text-body tw:text-text">
        <h2 class="tw:text-caption tw:font-bold tw:uppercase tw:tracking-wide tw:text-text-muted">
          {{ MY_MRI_COPY.panelHeading }}
        </h2>
        <p>{{ MY_MRI_COPY.intro }}</p>
        <p>
          {{ MY_MRI_COPY.markedAreas }}
          <template v-if="sentence">{{ ' ' }}{{ MY_MRI_COPY.colourMatch(sentence) }}</template>
        </p>
        <p>
          {{ MY_MRI_COPY.controlsLead }}
          <strong>{{ MY_MRI_COPY.controlsReset }}</strong> {{ MY_MRI_COPY.controlsTail }}
        </p>
        <p>{{ MY_MRI_COPY.views }}</p>
        <p>{{ MY_MRI_COPY.reportNote }}</p>
      </div>
    </template>
  </DefaultLayout>
</template>
