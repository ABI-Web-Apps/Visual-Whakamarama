<script setup lang="ts">
import { computed } from 'vue'
import ImagePlaceholder from '@/components/myImages/ImagePlaceholder.vue'
import ResultColumn from '@/components/myImages/ResultColumn.vue'
import MyMriColumnState from '@/components/myMri/MyMriColumnState.vue'
import MyMriViewer from '@/components/myMri/MyMriViewer.vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import { MY_IMAGES_COPY } from '@/content/myImages'
import { MY_MRI_COPY, sessionProgressText } from '@/content/myMri'
import { APP_TITLE, useDocumentTitle } from '@/navigation/head'
import { providePageRoute } from '@/navigation/router'
import type { PageRoute } from '@/navigation/routes'
import { useMyMriSession } from '@/myMri/useMyMriSession'
import { useViewerRetry } from '@/myMri/useViewerRetry'

/**
 * My Images: the patient's own anatomy, mammogram and MRI in the three
 * columns the Overview (The Breast) page uses for the examples.
 *
 * Only the MRI exists in the data. The other two columns hold their place and
 * link to the example instead (ImagePlaceholder). The MRI column header opens
 * the MRI page (/my-images/mri): current slice, previous MRI and 3D.
 */
const props = defineProps<{ route: PageRoute }>()
providePageRoute(computed(() => props.route))

const session = useMyMriSession()
const { cohort, status, error, progress, total, reload, urls, findings } = session
const progressText = computed(() => sessionProgressText(progress.value, total.value))
const { attempt, retry } = useViewerRetry(session)

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
        <p class="tw:mt-1 tw:text-body-sm tw:text-text-muted">{{ MY_MRI_COPY.subline(cohort) }}</p>
      </div>
    </template>

    <template #stage>
      <!-- Three-up above a 1000px column, as the case page's panels are
           (CasePanels.vue); stacked and scrolling below it. -->
      <div class="tw:@container tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-y-auto">
        <div
          class="tw:grid tw:grid-cols-1 tw:gap-3 tw:p-3
                 tw:@[1000px]:min-h-0 tw:@[1000px]:flex-1 tw:@[1000px]:grid-cols-3 tw:@[1000px]:grid-rows-1"
        >
          <ResultColumn :label="MY_IMAGES_COPY.anatomy">
            <ImagePlaceholder
              :message="MY_IMAGES_COPY.anatomyMissing"
              example-to="/the-breast/anatomy"
              :example-label="MY_IMAGES_COPY.seeExample"
            />
          </ResultColumn>
          <ResultColumn :label="MY_IMAGES_COPY.mammogram">
            <ImagePlaceholder
              :message="MY_IMAGES_COPY.mammogramMissing"
              example-to="/the-breast/mammogram"
              :example-label="MY_IMAGES_COPY.seeExample"
            />
          </ResultColumn>
          <ResultColumn :label="MY_IMAGES_COPY.mri" to="/my-images/mri" :open-label="MY_IMAGES_COPY.open">
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
      </div>
    </template>
  </DefaultLayout>
</template>
