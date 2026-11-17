<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import CollapsedPane from '@/components/layout/CollapsedPane.vue'
import PaneGutter from '@/components/layout/PaneGutter.vue'
import ImagePlaceholder from '@/components/myImages/ImagePlaceholder.vue'
import ResultColumn from '@/components/myImages/ResultColumn.vue'
import MyMriColumnState from '@/components/myMri/MyMriColumnState.vue'
import MyMriViewer from '@/components/myMri/MyMriViewer.vue'
import { PANE_CLASS, ROW_DRAGGING_CLASS, resizeLabel, usePaneSplit } from '@/composables/usePaneSplit'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import { MY_IMAGES_MRI_COPY } from '@/content/myImages'
import { sessionProgressText } from '@/content/myMri'
import AppLink from '@/navigation/AppLink.vue'
import { APP_TITLE, useDocumentTitle } from '@/navigation/head'
import { providePageRoute } from '@/navigation/router'
import type { PageRoute } from '@/navigation/routes'
import { useMyMriSession } from '@/myMri/useMyMriSession'
import { useViewerRetry } from '@/myMri/useViewerRetry'

/**
 * My Images › MRI: the annotator's reading layout for a patient. The current
 * MRI one slice at a time, the previous MRI beside it, and the 3D view that
 * shows where the marked areas sit -- each with the case stages' control bar,
 * the widths draggable (usePaneSplit).
 *
 * There is no previous MRI in the data, so that column holds its place with
 * no example in it: an example scan beside the patient's own could be read as
 * their earlier one. It can be minimised to a rail at the end of the row, and
 * the other two then share the row; the rail puts it back.
 *
 * Two viewers of one scan, each loading it itself, each with its own Try
 * again: a failure in one rebuilds that one alone.
 */
const props = defineProps<{ route: PageRoute }>()
providePageRoute(computed(() => props.route))

const session = useMyMriSession()
const { status, error, progress, total, reload, urls, findings } = session
const progressText = computed(() => sessionProgressText(progress.value, total.value))
const current = useViewerRetry(session)
const threeD = useViewerRetry(session)

const split = usePaneSplit([
  { id: 'current', weight: 1 },
  { id: 'previous', weight: 1 },
  { id: 'threeD', weight: 1 },
])
const previousCollapsed = computed(() => Boolean(split.collapsed.value.previous))

/** Focus follows the control that replaced the one pressed, so the keyboard is never dropped. */
const row = ref<HTMLElement | null>(null)
async function collapsePrevious() {
  split.collapse('previous')
  await nextTick()
  row.value?.querySelector<HTMLElement>('[data-collapsed-pane]')?.focus()
}
async function expandPrevious() {
  split.expand('previous')
  await nextTick()
  row.value?.querySelector<HTMLElement>('[data-collapse]')?.focus()
}

useDocumentTitle(() => `${MY_IMAGES_MRI_COPY.title} — ${APP_TITLE}`)
</script>

<template>
  <DefaultLayout :square-stage="false" :stage-label="MY_IMAGES_MRI_COPY.stageLabel">
    <template #heading>
      <div class="tw:p-6 tw:pb-0">
        <AppLink
          to="/my-images"
          class="tw:mb-2 tw:inline-flex tw:min-h-11 tw:items-center tw:gap-1 tw:text-body-sm tw:font-bold tw:text-brand-hover
                 tw:hover:underline"
        >
          <span aria-hidden="true">←</span> {{ MY_IMAGES_MRI_COPY.back }}
        </AppLink>
        <p class="tw:text-caption tw:font-bold tw:uppercase tw:tracking-wide tw:text-group-results">
          {{ MY_IMAGES_MRI_COPY.eyebrow }}
        </p>
        <h1 class="tw:text-h1 tw:font-bold tw:text-text">{{ MY_IMAGES_MRI_COPY.title }}</h1>
      </div>
    </template>

    <template #stage>
      <!-- Side by side above a 1000px column, as on My Images and the case
           page, with a gutter to drag between each two; stacked and scrolling
           below it. -->
      <div class="tw:@container tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-y-auto">
        <div
          ref="row"
          class="tw:flex tw:flex-col tw:gap-3 tw:p-3
                 tw:@[1000px]:min-h-0 tw:@[1000px]:flex-1 tw:@[1000px]:flex-row tw:@[1000px]:gap-0"
          :class="split.dragging.value ? ROW_DRAGGING_CLASS : ''"
        >
          <ResultColumn
            v-bind="split.paneAttrs('current')"
            :class="PANE_CLASS"
            :style="split.paneStyle('current')"
            :label="MY_IMAGES_MRI_COPY.current"
          >
            <MyMriColumnState :status="status" :summary="error?.summary" :progress-text="progressText" live @retry="reload()">
              <MyMriViewer
                v-if="urls"
                :key="`${urls.mri}#current#${current.attempt.value}`"
                :mri="urls.mri"
                :mask="urls.mask"
                :findings="findings"
                initial-view="axial"
                :label="MY_IMAGES_MRI_COPY.currentLabel"
                @retry="current.retry()"
              />
            </MyMriColumnState>
          </ResultColumn>

          <template v-if="!previousCollapsed">
            <PaneGutter
              :split="split"
              before="current"
              after="previous"
              :label="resizeLabel(MY_IMAGES_MRI_COPY.current, MY_IMAGES_MRI_COPY.previous)"
            />
            <ResultColumn
              v-bind="split.paneAttrs('previous')"
              :class="PANE_CLASS"
              :style="split.paneStyle('previous')"
              :label="MY_IMAGES_MRI_COPY.previous"
              collapsible
              :collapse-label="MY_IMAGES_MRI_COPY.previousCollapse"
              @collapse="collapsePrevious()"
            >
              <ImagePlaceholder :message="MY_IMAGES_MRI_COPY.previousMissing" />
            </ResultColumn>
            <PaneGutter
              :split="split"
              before="previous"
              after="threeD"
              :label="resizeLabel(MY_IMAGES_MRI_COPY.previous, MY_IMAGES_MRI_COPY.threeD)"
            />
          </template>
          <template v-else>
            <PaneGutter
              :split="split"
              before="current"
              after="threeD"
              :label="resizeLabel(MY_IMAGES_MRI_COPY.current, MY_IMAGES_MRI_COPY.threeD)"
            />
            <CollapsedPane
              v-bind="split.paneAttrs('previous')"
              :style="split.paneStyle('previous')"
              :label="MY_IMAGES_MRI_COPY.previous"
              :expand-label="MY_IMAGES_MRI_COPY.previousExpand"
              @expand="expandPrevious()"
            />
          </template>

          <ResultColumn
            v-bind="split.paneAttrs('threeD')"
            :class="PANE_CLASS"
            :style="split.paneStyle('threeD')"
            :label="MY_IMAGES_MRI_COPY.threeD"
          >
            <MyMriColumnState :status="status" :summary="error?.summary" :progress-text="progressText" @retry="reload()">
              <MyMriViewer
                v-if="urls"
                :key="`${urls.mri}#3d#${threeD.attempt.value}`"
                :mri="urls.mri"
                :mask="urls.mask"
                :findings="findings"
                initial-view="3d"
                :label="MY_IMAGES_MRI_COPY.threeDLabel"
                @retry="threeD.retry()"
              />
            </MyMriColumnState>
          </ResultColumn>
        </div>
      </div>
    </template>

    <template #content>
      <div class="tw:flex tw:flex-col tw:gap-4 tw:p-6 tw:text-body tw:text-text">
        <h2 class="tw:text-caption tw:font-bold tw:uppercase tw:tracking-wide tw:text-text-muted">
          {{ MY_IMAGES_MRI_COPY.panelHeading }}
        </h2>
        <p>{{ MY_IMAGES_MRI_COPY.currentNote }}</p>
        <p>{{ MY_IMAGES_MRI_COPY.previousNote }}</p>
        <p>{{ MY_IMAGES_MRI_COPY.threeDNote }}</p>
        <p>{{ MY_IMAGES_MRI_COPY.resetNote }}</p>
      </div>
    </template>
  </DefaultLayout>
</template>
