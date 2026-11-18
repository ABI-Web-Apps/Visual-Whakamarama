<script setup lang="ts">
import { CONTACT_COPY } from '@/content/contact'
import AppLink from '@/navigation/AppLink.vue'

/**
 * The way in to Contact us from the rest of the app: at the foot of the case
 * navigation (resident on a desktop, in the menu drawer on a phone, where the
 * header has no room for it) and near the top of About.
 *
 * One link, one tab stop. The envelope sits in the same violet tint as the
 * Contact page's email buttons, so the two read as the same thing.
 */
withDefaults(defineProps<{ variant?: 'sidebar' | 'banner' }>(), { variant: 'sidebar' })
</script>

<template>
  <AppLink
    to="/contact"
    data-contact-cta
    class="tw:group tw:flex tw:items-center tw:gap-3 tw:rounded-card tw:bg-surface tw:ring-1 tw:ring-border
           tw:transition-shadow tw:hover:ring-group-results/45 tw:hover:shadow-sm"
    :class="variant === 'banner' ? 'tw:p-4 tw:sm:px-5' : 'tw:p-3'"
  >
    <span
      class="tw:flex tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:bg-group-results/10 tw:text-group-results
             tw:transition-colors tw:group-hover:bg-group-results tw:group-hover:text-white"
      :class="variant === 'banner' ? 'tw:size-11' : 'tw:size-9'"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" class="tw:size-[1.125rem]" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
        <path d="m4 7.5 8 5.5 8-5.5" />
      </svg>
    </span>
    <span class="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
      <span class="tw:text-caption tw:text-text-muted" :class="variant === 'banner' ? 'tw:sm:text-body-sm' : ''">
        {{ variant === 'banner' ? CONTACT_COPY.ctaQuestion : CONTACT_COPY.ctaQuestionShort }}
      </span>
      <span class="tw:font-bold tw:text-group-results" :class="variant === 'banner' ? 'tw:text-body' : 'tw:text-body-sm'">
        {{ CONTACT_COPY.ctaAction }}
      </span>
    </span>
    <svg
      v-if="variant === 'banner'"
      viewBox="0 0 24 24"
      class="tw:size-4 tw:shrink-0 tw:text-text-subtle tw:transition-transform tw:group-hover:translate-x-0.5 tw:group-hover:text-group-results"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="m9 5 7 7-7 7" />
    </svg>
  </AppLink>
</template>
