<script setup lang="ts">
import AppLink from '@/navigation/AppLink.vue'

/**
 * The place an image of the patient's own will go. It says so plainly and,
 * where there is one, links to the educational example of the same view.
 *
 * The example never appears inside the patient's slot: a generic image there
 * could be taken for the patient's own.
 */
defineProps<{ message: string, exampleTo?: string, exampleLabel?: string }>()
</script>

<template>
  <div
    data-placeholder
    class="tw:flex tw:flex-1 tw:flex-col tw:items-center tw:justify-center tw:gap-3 tw:bg-surface-sunken tw:p-6 tw:text-center"
  >
    <svg
      viewBox="0 0 24 24"
      class="tw:size-10 tw:text-text-muted"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke-dasharray="2.5 2" />
      <path d="M7 15.5l3.5-4 3 3 2-2 2.5 3" />
      <circle cx="9" cy="9" r="1.2" />
    </svg>
    <p class="tw:max-w-60 tw:text-body-sm tw:text-text-muted">{{ message }}</p>
    <AppLink
      v-if="exampleTo"
      :to="exampleTo"
      class="tw:inline-flex tw:min-h-11 tw:items-center tw:rounded-ctl tw:px-3 tw:text-body-sm tw:font-bold tw:text-brand-hover
             tw:underline tw:decoration-brand/40 tw:underline-offset-2 tw:hover:decoration-brand"
    >
      {{ exampleLabel }} →
    </AppLink>
  </div>
</template>
