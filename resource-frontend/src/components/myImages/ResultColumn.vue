<script lang="ts">
/**
 * Numbers the columns' heading ids. Prefixed rather than `useId()`: in plugin
 * mode the portal's own Vue app shares the document and its ids, and `useId()`
 * is unique within one app only. A plain counter registers nothing global.
 */
let columnCount = 0
</script>

<script setup lang="ts">
import AppLink from '@/navigation/AppLink.vue'

/**
 * One column of a patient page: the case three-up's card, with the same small
 * uppercase label on a hairline header (CasePanels.vue), so the patient's own
 * images read as the same three views as the examples. What is in the column
 * brings its own control bar at the foot, as a case stage does.
 *
 * With `to`, the label is one link that opens the view in more detail: the
 * label plus an Open control, one tab stop. The body below it stays free for
 * a viewer that takes drags, so dragging there never navigates.
 *
 * `badge` marks a column whose image is not the patient's own (an example).
 * It is part of the heading, so the region's name says so too.
 *
 * With `collapsible`, a minimise button at the end of the header emits
 * `collapse`; the page swaps the column for a rail (CollapsedPane).
 *
 * The section is a region named by its heading: My Images' MRI page has two
 * viewers with the same controls, and the column names tell them apart.
 */
defineProps<{
  label: string
  to?: string
  openLabel?: string
  badge?: string
  collapsible?: boolean
  collapseLabel?: string
}>()
defineEmits<{ collapse: [] }>()
const headingId = `vw-result-column-${++columnCount}`
</script>

<template>
  <section
    :aria-labelledby="headingId"
    class="tw:flex tw:min-h-80 tw:min-w-0 tw:flex-col tw:overflow-hidden tw:rounded-card tw:border tw:border-border
           tw:bg-surface tw:shadow-sm tw:@[1000px]:min-h-0"
  >
    <div class="tw:flex tw:min-h-10 tw:shrink-0 tw:items-center tw:border-b tw:border-border tw:bg-surface">
      <h2 :id="headingId" class="tw:flex tw:min-w-0 tw:flex-1 tw:items-center">
        <AppLink
          v-if="to"
          :to="to"
          class="tw:group tw:flex tw:min-h-10 tw:flex-1 tw:items-center tw:gap-2 tw:px-3 tw:py-1.5 tw:hover:bg-brand-subtle"
        >
          <span class="tw:text-caption tw:font-bold tw:uppercase tw:tracking-[0.12em] tw:text-text-muted tw:group-hover:text-brand-hover">
            {{ label }}
          </span>
          <!-- Vue drops the line break between the two spans; without this the
               link's name reads "MRIOpen". -->
          {{ ' ' }}
          <span class="tw:ml-auto tw:flex tw:items-center tw:gap-1 tw:text-caption tw:font-bold tw:text-brand-hover">
            {{ openLabel ?? 'Open' }}
            <svg viewBox="0 0 24 24" class="tw:size-3.5" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M8 16 16 8M9 8h7v7" />
            </svg>
          </span>
        </AppLink>
        <span v-else class="tw:flex tw:min-w-0 tw:items-center tw:gap-2 tw:px-3 tw:py-1.5">
          <span class="tw:text-caption tw:font-bold tw:uppercase tw:tracking-[0.12em] tw:text-text-muted">{{ label }}</span>
          <!-- One space between the two, so the region's name reads "Anatomy Example". -->
          <template v-if="badge">{{ ' ' }}<span
            data-badge
            class="tw:rounded-chip tw:bg-anatomy-fill tw:px-1.5 tw:py-0.5 tw:text-caption tw:font-bold tw:text-anatomy-ink"
          >{{ badge }}</span></template>
        </span>
      </h2>
      <button
        v-if="collapsible"
        type="button"
        data-collapse
        class="tw:group tw:relative tw:mr-1 tw:flex tw:size-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-ctl
               tw:text-text-muted tw:hover:bg-surface-sunken tw:hover:text-text"
        :aria-label="collapseLabel ?? `Minimise ${label}`"
        @click="$emit('collapse')"
      >
        <!-- Minimise: a panel folding into its edge. -->
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
          <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
          <path d="M15 4.5v15M9 10l2.5 2L9 14" />
        </svg>
        <!-- Below the button: the header is at the top of the panel. -->
        <span
          aria-hidden="true"
          class="tw:pointer-events-none tw:absolute tw:top-full tw:right-0 tw:z-10 tw:mt-1 tw:whitespace-nowrap tw:rounded-ctl
                 tw:bg-text tw:px-2 tw:py-1 tw:text-caption tw:font-medium tw:text-surface tw:opacity-0 tw:shadow-md
                 tw:transition-opacity tw:duration-100 tw:group-hover:opacity-100 tw:group-focus-visible:opacity-100"
        >
          {{ collapseLabel ?? `Minimise ${label}` }}
        </span>
      </button>
    </div>
    <div class="tw:relative tw:flex tw:min-h-0 tw:flex-1 tw:flex-col">
      <slot />
    </div>
  </section>
</template>
