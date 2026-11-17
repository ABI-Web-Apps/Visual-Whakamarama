<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import PaneGutter from '@/components/layout/PaneGutter.vue'
import ExampleNote from '@/components/myImages/ExampleNote.vue'
import ResultColumn from '@/components/myImages/ResultColumn.vue'
import MyMriColumnState from '@/components/myMri/MyMriColumnState.vue'
import MyMriViewer from '@/components/myMri/MyMriViewer.vue'
import CopperStage from '@/components/stage/CopperStage.vue'
import { PANE_CLASS, ROW_DRAGGING_CLASS, resizeLabel, usePaneSplit } from '@/composables/usePaneSplit'
import { getCase, getPanel } from '@/content/cases'
import { MY_IMAGES_COPY } from '@/content/myImages'
import { sessionProgressText } from '@/content/myMri'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import { APP_TITLE, useDocumentTitle } from '@/navigation/head'
import { providePageRoute } from '@/navigation/router'
import type { PageRoute } from '@/navigation/routes'
import { useMyMriSession } from '@/myMri/useMyMriSession'
import { useViewerRetry } from '@/myMri/useViewerRetry'

/**
 * My Images: the patient's own anatomy, mammogram and MRI in the three
 * columns the case pages use for the examples, each with the case stages'
 * control bar, the widths draggable (usePaneSplit).
 *
 * Only the MRI exists in the data. Until the other two do, their columns show
 * the Density C example, marked Example in the heading and with a line across
 * the top saying whose image it is not. The MRI column header opens the MRI
 * page (/my-images/mri): current slice, previous MRI and 3D.
 */
const props = defineProps<{ route: PageRoute }>()
providePageRoute(computed(() => props.route))

const session = useMyMriSession()
const { status, error, progress, total, reload, urls, findings } = session
const progressText = computed(() => sessionProgressText(progress.value, total.value))
const { attempt, retry } = useViewerRetry(session)

const split = usePaneSplit([
  { id: 'anatomy', weight: 1 },
  { id: 'mammogram', weight: 1 },
  { id: 'mri', weight: 1 },
])

const example = getCase(MY_IMAGES_COPY.exampleCase)!
const exampleAnatomy = getPanel(example, 'anatomy')!.modalities[0]!
const exampleMammogram = getPanel(example, 'mammogram')!.modalities[0]!

/**
 * Staged loading: the patient's own MRI has the connection to itself until it
 * is on screen (or has failed); the two examples (0.8MB and 15MB) follow.
 * A session that never settles must not strand them, hence the timer.
 */
const examplesReleased = ref(false)
function releaseExamples() { examplesReleased.value = true }
watch(status, (now) => { if (now === 'error') releaseExamples() }, { immediate: true })
const releaseTimer = setTimeout(releaseExamples, 15_000)
onScopeDispose(() => clearTimeout(releaseTimer))

useDocumentTitle(() => `${MY_IMAGES_COPY.title} — ${APP_TITLE}`)
</script>

<template>
  <DefaultLayout :square-stage="false" :stage-label="MY_IMAGES_COPY.stageLabel">
    <template #heading>
      <div class="tw:p-6 tw:pb-0">
        <p class="tw:text-caption tw:font-bold tw:uppercase tw:tracking-wide tw:text-group-results">
          {{ MY_IMAGES_COPY.eyebrow }}
        </p>
        <h1 class="tw:text-h1 tw:font-bold tw:text-text">{{ MY_IMAGES_COPY.title }}</h1>
      </div>
    </template>

    <template #stage>
      <!-- Side by side above a 1000px column, as the case page's panels are
           (CasePanels.vue), with a gutter to drag between each two; stacked
           and scrolling below it. -->
      <div class="tw:@container tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-y-auto">
        <div
          class="tw:flex tw:flex-col tw:gap-3 tw:p-3
                 tw:@[1000px]:min-h-0 tw:@[1000px]:flex-1 tw:@[1000px]:flex-row tw:@[1000px]:gap-0"
          :class="split.dragging.value ? ROW_DRAGGING_CLASS : ''"
        >
          <ResultColumn
            v-bind="split.paneAttrs('anatomy')"
            :class="PANE_CLASS"
            :style="split.paneStyle('anatomy')"
            :label="MY_IMAGES_COPY.anatomy"
            :badge="MY_IMAGES_COPY.example"
          >
            <ExampleNote
              :text="MY_IMAGES_COPY.anatomyExample"
              :to="`/${example.slug}/${exampleAnatomy.id}`"
              :link-label="MY_IMAGES_COPY.exampleLink"
            />
            <CopperStage
              :slug="example.slug"
              :group="example.group"
              panel-id="anatomy"
              :panel-label="MY_IMAGES_COPY.anatomyExampleLabel"
              :lesion-slice-index="0"
              :modality="exampleAnatomy"
              :compact="true"
              :load-enabled="examplesReleased"
              :tour="false"
            />
          </ResultColumn>
          <PaneGutter
            :split="split"
            before="anatomy"
            after="mammogram"
            :label="resizeLabel(MY_IMAGES_COPY.anatomy, MY_IMAGES_COPY.mammogram)"
          />
          <ResultColumn
            v-bind="split.paneAttrs('mammogram')"
            :class="PANE_CLASS"
            :style="split.paneStyle('mammogram')"
            :label="MY_IMAGES_COPY.mammogram"
            :badge="MY_IMAGES_COPY.example"
          >
            <ExampleNote
              :text="MY_IMAGES_COPY.mammogramExample"
              :to="`/${example.slug}/${exampleMammogram.id}`"
              :link-label="MY_IMAGES_COPY.exampleLink"
            />
            <CopperStage
              :slug="example.slug"
              :group="example.group"
              panel-id="mammogram"
              :panel-label="MY_IMAGES_COPY.mammogramExampleLabel"
              :lesion-slice-index="0"
              :modality="exampleMammogram"
              :compact="true"
              :load-enabled="examplesReleased"
              :tour="false"
            />
          </ResultColumn>
          <PaneGutter
            :split="split"
            before="mammogram"
            after="mri"
            :label="resizeLabel(MY_IMAGES_COPY.mammogram, MY_IMAGES_COPY.mri)"
          />
          <ResultColumn
            v-bind="split.paneAttrs('mri')"
            :class="PANE_CLASS"
            :style="split.paneStyle('mri')"
            :label="MY_IMAGES_COPY.mri"
            to="/my-images/mri"
            :open-label="MY_IMAGES_COPY.open"
          >
            <MyMriColumnState :status="status" :summary="error?.summary" :progress-text="progressText" live @retry="reload()">
              <MyMriViewer
                v-if="urls"
                :key="`${urls.mri}#${attempt}`"
                :mri="urls.mri"
                :mask="urls.mask"
                :findings="findings"
                initial-view="3d"
                :label="MY_IMAGES_COPY.mriLabel"
                @retry="retry()"
                @settled="releaseExamples()"
              />
            </MyMriColumnState>
          </ResultColumn>
        </div>
      </div>
    </template>

    <template #content>
      <div class="tw:flex tw:flex-col tw:gap-4 tw:p-6 tw:text-body tw:text-text">
        <h2 class="tw:text-caption tw:font-bold tw:uppercase tw:tracking-wide tw:text-text-muted">
          {{ MY_IMAGES_COPY.panelHeading }}
        </h2>
        <p>{{ MY_IMAGES_COPY.intro }}</p>
        <p>{{ MY_IMAGES_COPY.missing }}</p>
        <p>{{ MY_IMAGES_COPY.mriNote }}</p>
        <p>{{ MY_IMAGES_COPY.resizeNote }}</p>
      </div>
    </template>
  </DefaultLayout>
</template>
