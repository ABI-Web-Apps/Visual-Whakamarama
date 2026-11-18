<script setup lang="ts">
import { reactive } from 'vue'
import { MY_MRI_COPY } from '@/content/myMri'
import type { ReportPage } from '@/myMri/api'

/**
 * The report as page images, for a device whose browser cannot show a PDF
 * inline (see `prefersTouchReader`). Each page is a picture at the column's
 * width, white, one under the other.
 *
 * The images are 1600px wide (the backend renders them so), which is sharp on
 * a phone and on a tablet column. A picture of text says nothing to a screen
 * reader, so each page's own text sits beside it, visually hidden.
 */
const props = defineProps<{
  pages: ReportPage[]
  pageUrl: (index: number) => string
}>()

const RENDER_WIDTH = 1600
const failed = reactive(new Set<number>())

function heightOf(page: ReportPage): number {
  return Math.round(RENDER_WIDTH * page.height / page.width)
}
</script>

<template>
  <ol class="tw:flex tw:flex-col tw:gap-3">
    <li v-for="(page, i) in props.pages" :key="i" class="tw:relative">
      <p class="tw:sr-only">
        {{ MY_MRI_COPY.reportPageLabel(i + 1, props.pages.length) }}. {{ page.text }}
      </p>
      <img
        v-if="!failed.has(i)"
        :src="props.pageUrl(i)"
        alt=""
        aria-hidden="true"
        :width="RENDER_WIDTH"
        :height="heightOf(page)"
        :loading="i === 0 ? 'eager' : 'lazy'"
        decoding="async"
        draggable="false"
        class="tw:block tw:h-auto tw:w-full tw:rounded-chip tw:bg-white tw:shadow-md tw:ring-1 tw:ring-border"
        @error="failed.add(i)"
      >
      <p
        v-else
        class="tw:rounded-chip tw:bg-surface tw:p-4 tw:text-body-sm tw:text-text-muted tw:ring-1 tw:ring-border"
      >
        {{ MY_MRI_COPY.reportPageFailed(i + 1) }}
      </p>
    </li>
  </ol>
</template>
