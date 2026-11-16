<script setup lang="ts">
import { computed } from 'vue'
import ImagePlaceholder from '@/components/myImages/ImagePlaceholder.vue'
import ResultColumn from '@/components/myImages/ResultColumn.vue'
import MyMriColumnState from '@/components/myMri/MyMriColumnState.vue'
import MyMriViewer from '@/components/myMri/MyMriViewer.vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import { MY_IMAGES_MRI_COPY } from '@/content/myImages'
import { MY_MRI_COPY, sessionProgressText } from '@/content/myMri'
import AppLink from '@/navigation/AppLink.vue'
import { APP_TITLE, useDocumentTitle } from '@/navigation/head'
import { providePageRoute } from '@/navigation/router'
import type { PageRoute } from '@/navigation/routes'
import { useMyMriSession } from '@/myMri/useMyMriSession'
import { useViewerRetry } from '@/myMri/useViewerRetry'

/**
 * My Images › MRI: the annotator's reading layout for a patient. The current
 * MRI one slice at a time, the previous MRI beside it, and the 3D view that
 * shows where the marked areas sit.
 *
 * There is no previous MRI in the data, so that column holds its place with
 * no example in it: an example scan beside the patient's own could be read as
 * their earlier one.
 *
 * Two viewers of one scan, each loading it itself, each with its own Try
 * again: a failure in one rebuilds that one alone.
 */
const props = defineProps<{ route: PageRoute }>()
providePageRoute(computed(() => props.route))

const session = useMyMriSession()
const { cohort, status, error, progress, total, reload, urls, findings } = session
const progressText = computed(() => sessionProgressText(progress.value, total.value))
const current = useViewerRetry(session)
const threeD = useViewerRetry(session)

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
        <p class="tw:mt-1 tw:text-body-sm tw:text-text-muted">{{ MY_MRI_COPY.subline(cohort) }}</p>
      </div>
    </template>

    <template #stage>
      <!-- Three-up above a 1000px column, as on My Images and the case page;
           stacked and scrolling below it. -->
      <div class="tw:@container tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-y-auto">
        <div
          class="tw:grid tw:grid-cols-1 tw:gap-3 tw:p-3
                 tw:@[1000px]:min-h-0 tw:@[1000px]:flex-1 tw:@[1000px]:grid-cols-3 tw:@[1000px]:grid-rows-1"
        >
          <ResultColumn :label="MY_IMAGES_MRI_COPY.current">
            <MyMriColumnState :status="status" :summary="error?.summary" :progress-text="progressText" live @retry="reload()">
              <MyMriViewer
                v-if="urls"
                :key="`${urls.mri}#current#${current.attempt.value}`"
                :mri="urls.mri"
                :mask="urls.mask"
                :findings="findings"
                initial-view="axial"
                @retry="current.retry()"
              />
            </MyMriColumnState>
          </ResultColumn>
          <ResultColumn :label="MY_IMAGES_MRI_COPY.previous">
            <ImagePlaceholder :message="MY_IMAGES_MRI_COPY.previousMissing" />
          </ResultColumn>
          <ResultColumn :label="MY_IMAGES_MRI_COPY.threeD">
            <MyMriColumnState :status="status" :summary="error?.summary" :progress-text="progressText" @retry="reload()">
              <MyMriViewer
                v-if="urls"
                :key="`${urls.mri}#3d#${threeD.attempt.value}`"
                :mri="urls.mri"
                :mask="urls.mask"
                :findings="findings"
                initial-view="3d"
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
