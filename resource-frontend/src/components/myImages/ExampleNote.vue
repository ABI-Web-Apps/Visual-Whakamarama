<script setup lang="ts">
import AppLink from '@/navigation/AppLink.vue'

/**
 * The line across the top of a column that shows an example in place of the
 * patient's own image: what it is, that theirs is not available yet, and a
 * link to the case it comes from. It sits above the stage, never over it, so
 * nothing in the image can be read as theirs without it.
 */
defineProps<{ text: string, to: string, linkLabel: string }>()
</script>

<template>
  <p
    data-example-note
    class="tw:flex tw:shrink-0 tw:flex-wrap tw:items-center tw:gap-x-2 tw:border-b tw:border-border tw:bg-anatomy-fill
           tw:px-3 tw:py-1 tw:text-caption tw:text-text"
  >
    <span>{{ text }}</span>
    <AppLink
      :to="to"
      class="tw:inline-flex tw:min-h-6 tw:items-center tw:font-bold tw:text-anatomy-ink tw:underline tw:decoration-anatomy-ink/40
             tw:underline-offset-2 tw:hover:decoration-anatomy-ink"
    >
      {{ linkLabel }} →
    </AppLink>
  </p>
</template>
