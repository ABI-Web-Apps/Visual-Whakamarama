<script setup lang="ts">
/**
 * A panel the reader has minimised: a narrow rail at the end of the row
 * (usePaneSplit puts it there), its name running down it, the whole rail one
 * button that puts the panel back. Stacked below the row breakpoint it is a
 * one-line bar instead.
 */
defineProps<{ label: string, expandLabel: string }>()
defineEmits<{ expand: [] }>()
</script>

<template>
  <button
    type="button"
    data-collapsed-pane
    :aria-label="expandLabel"
    class="tw:group tw:flex tw:min-h-11 tw:shrink-0 tw:items-center tw:gap-2 tw:rounded-card tw:border tw:border-border
           tw:bg-surface tw:px-3 tw:text-text-muted tw:shadow-sm tw:transition-colors
           tw:hover:border-brand/40 tw:hover:bg-brand-subtle tw:hover:text-brand-hover
           tw:@[1000px]:ml-3 tw:@[1000px]:w-11 tw:@[1000px]:flex-col tw:@[1000px]:px-0 tw:@[1000px]:py-3"
    @click="$emit('expand')"
  >
    <!-- Restore: a panel opening out of the edge. -->
    <svg
      viewBox="0 0 24 24"
      class="tw:size-4 tw:shrink-0"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M9 4.5v15M15 10l-2.5 2 2.5 2" />
    </svg>
    <span
      class="tw:text-caption tw:font-bold tw:uppercase tw:tracking-[0.12em] tw:whitespace-nowrap
             tw:@[1000px]:[writing-mode:vertical-rl]"
    >
      {{ label }}
    </span>
  </button>
</template>
