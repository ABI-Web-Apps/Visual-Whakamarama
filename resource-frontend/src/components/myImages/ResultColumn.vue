<script setup lang="ts">
import AppLink from '@/navigation/AppLink.vue'

/**
 * One column of a patient page: the case three-up's card, with the same small
 * uppercase label on a hairline header (CasePanels.vue), so the patient's own
 * images read as the same three views as the examples.
 *
 * With `to`, the whole header is one link that opens the view in more detail:
 * the label plus an Open control, one tab stop. The body below it stays free
 * for a viewer that takes drags, so dragging there never navigates.
 */
defineProps<{ label: string, to?: string, openLabel?: string }>()
</script>

<template>
  <section
    class="tw:flex tw:min-h-80 tw:min-w-0 tw:flex-col tw:overflow-hidden tw:rounded-card tw:border tw:border-border
           tw:bg-surface tw:shadow-sm tw:@[1000px]:min-h-0"
  >
    <h2 class="tw:flex tw:min-h-10 tw:shrink-0 tw:items-center tw:border-b tw:border-border tw:bg-surface">
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
      <span
        v-else
        class="tw:px-3 tw:py-1.5 tw:text-caption tw:font-bold tw:uppercase tw:tracking-[0.12em] tw:text-text-muted"
      >
        {{ label }}
      </span>
    </h2>
    <div class="tw:relative tw:flex tw:min-h-0 tw:flex-1 tw:flex-col">
      <slot />
    </div>
  </section>
</template>
