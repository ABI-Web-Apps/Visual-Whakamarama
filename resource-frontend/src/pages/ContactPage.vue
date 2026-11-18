<script setup lang="ts">
import EmailButton from '@/components/contact/EmailButton.vue'
import { CONTACT_ADDRESS, CONTACT_COPY, CONTACT_PEOPLE, initials } from '@/content/contact'
import { FEEDBACK_COPY } from '@/content/feedback'
import { useFeedbackDialog } from '@/feedback/useFeedbackDialog'
import AppLink from '@/navigation/AppLink.vue'
import { APP_TITLE, useDocumentTitle } from '@/navigation/head'
import type { PageRoute } from '@/navigation/routes'

// Every page receives its route from App.vue; this one does not need it, but
// declaring it keeps it from falling through onto <main> as an attribute.
defineProps<{ route?: PageRoute }>()

/**
 * Contact us.
 *
 * The two Co-Principal Investigators and the institute's address, set as one
 * sheet rather than a row of separate cards: it is one way to reach one team.
 * The bar across its top is the patient summary's own masthead (the teal to
 * violet line on the PDF the client approved), so the people a patient is
 * told to contact and the summary they were handed look like they belong
 * together. It draws in once, the page's one moment of motion.
 *
 * The email addresses are the controls: large, one per person, each opening
 * the device's mail app and copying the address (EmailButton).
 */
useDocumentTitle(() => `${CONTACT_COPY.title} — ${APP_TITLE}`)
const feedback = useFeedbackDialog()
</script>

<template>
  <!-- Its own `<main>`, like About: no stage, no sidebar. -->
  <main class="tw:mx-auto tw:max-w-4xl tw:px-6 tw:py-10 tw:sm:px-10 tw:sm:py-16">
    <AppLink
      to="/"
      class="tw:group tw:inline-flex tw:min-h-11 tw:items-center tw:gap-1.5 tw:text-caption
             tw:uppercase tw:tracking-[0.14em] tw:text-text-muted tw:hover:text-brand-hover"
    >
      <svg viewBox="0 0 24 24" class="tw:size-3 tw:transition-transform tw:group-hover:-translate-x-0.5" aria-hidden="true">
        <path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="m15 5-7 7 7 7" />
      </svg>
      {{ CONTACT_COPY.back }}
    </AppLink>

    <h1 class="tw:mt-4 tw:text-h1 tw:font-bold tw:tracking-tight tw:text-text tw:sm:text-display">
      {{ CONTACT_COPY.title }}
    </h1>
    <p class="tw:mt-3 tw:max-w-xl tw:text-body tw:text-text-muted tw:sm:text-h2 tw:sm:font-normal">
      {{ CONTACT_COPY.lead }}
    </p>

    <section
      :aria-label="CONTACT_COPY.peopleLabel"
      class="tw:relative tw:mt-10 tw:overflow-hidden tw:rounded-card tw:bg-surface tw:shadow-lg tw:ring-1 tw:ring-border tw:sm:mt-12"
    >
      <div class="vw-contact-masthead" aria-hidden="true" />

      <ul class="tw:grid tw:sm:grid-cols-2">
        <li
          v-for="person in CONTACT_PEOPLE"
          :key="person.email"
          data-contact-person
          class="tw:flex tw:flex-col tw:gap-6 tw:border-border tw:p-5 tw:sm:p-8
                 tw:max-sm:border-t tw:max-sm:first:border-t-0 tw:sm:border-l tw:sm:first:border-l-0"
        >
          <div class="tw:flex tw:items-center tw:gap-4">
            <span
              data-initials
              class="vw-contact-avatar tw:flex tw:size-14 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full
                     tw:text-h3 tw:font-bold tw:tracking-wide tw:text-group-results tw:sm:size-16 tw:sm:text-h2"
              aria-hidden="true"
            >{{ initials(person.name) }}</span>
            <div class="tw:min-w-0">
              <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-x-2 tw:gap-y-1">
                <h2 class="tw:text-h3 tw:font-bold tw:text-text tw:sm:text-h2">{{ person.name }}</h2>
                <span
                  v-if="person.iwi"
                  data-iwi
                  class="tw:rounded-full tw:bg-group-benign/10 tw:px-2 tw:py-0.5 tw:text-caption tw:font-semibold tw:text-group-benign"
                >{{ person.iwi }}</span>
              </div>
              <p class="tw:mt-0.5 tw:text-body-sm tw:text-text-muted">{{ person.role }}</p>
            </div>
          </div>
          <EmailButton class="tw:mt-auto" :email="person.email" :name="person.name" />
        </li>
      </ul>

      <div
        class="tw:flex tw:flex-col tw:gap-4 tw:border-t tw:border-border tw:bg-surface-sunken tw:px-5 tw:py-5
               tw:sm:flex-row tw:sm:items-center tw:sm:justify-between tw:sm:px-8"
      >
        <div class="tw:flex tw:items-start tw:gap-3">
          <svg viewBox="0 0 24 24" class="tw:mt-0.5 tw:size-5 tw:shrink-0 tw:text-group-results" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
            <circle cx="12" cy="10" r="2.4" />
          </svg>
          <address class="tw:text-body-sm tw:not-italic tw:leading-relaxed tw:text-text-muted">
            <span class="tw:block tw:font-bold tw:text-text">{{ CONTACT_ADDRESS.org }}</span>
            <span v-for="line in CONTACT_ADDRESS.lines" :key="line" class="tw:block">{{ line }}</span>
          </address>
        </div>
        <a
          :href="CONTACT_ADDRESS.mapsUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="tw:inline-flex tw:min-h-11 tw:shrink-0 tw:items-center tw:gap-1.5 tw:self-start tw:rounded-full tw:bg-surface
                 tw:px-4 tw:text-body-sm tw:font-bold tw:text-text tw:ring-1 tw:ring-border tw:transition-shadow
                 tw:hover:ring-group-results/45 tw:sm:self-auto"
        >
          {{ CONTACT_COPY.openMaps }}
          <svg viewBox="0 0 24 24" class="tw:size-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M8 16 16 8M9 8h7v7" />
          </svg>
        </a>
      </div>
    </section>

    <p v-if="feedback" class="tw:mt-8 tw:flex tw:flex-wrap tw:items-center tw:gap-x-3 tw:gap-y-2 tw:text-body-sm tw:text-text-muted">
      {{ FEEDBACK_COPY.openLead }}
      <button
        type="button"
        data-feedback-open
        class="tw:min-h-11 tw:rounded-full tw:bg-surface tw:px-4 tw:font-bold tw:text-text tw:ring-1 tw:ring-border
               tw:transition-shadow tw:hover:ring-group-results/45"
        @click="feedback.open()"
      >{{ FEEDBACK_COPY.open }}</button>
    </p>
  </main>
</template>

<style scoped>
/* The patient summary's masthead line (teal, through blue, to the results
   violet `--color-group-results`). Literal stops: a scoped block cannot read
   Tailwind's theme function. */
.vw-contact-masthead {
  height: 4px;
  background: linear-gradient(90deg, #22A2A8 0%, #3D6FB0 52%, #5B3F99 100%);
  transform-origin: left center;
  animation: vw-contact-draw .7s cubic-bezier(.2, .7, .2, 1) .1s both;
}
@keyframes vw-contact-draw {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
/* Initials in a ring of the same line: a soft violet fill inside a 2px
   gradient border. */
.vw-contact-avatar {
  border: 2px solid transparent;
  background:
    linear-gradient(#F5F2FB, #F5F2FB) padding-box,
    linear-gradient(135deg, #22A2A8, #5B3F99) border-box;
}
@media (prefers-reduced-motion: reduce) {
  .vw-contact-masthead { animation: none; }
}
</style>
