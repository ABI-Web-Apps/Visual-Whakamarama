<script setup lang="ts">
import { computed } from 'vue'
import { useAssetUrl } from '@/composables/useAssetUrl'
import { FEEDBACK_COPY } from '@/content/feedback'
import { citations, organisations, shownLogos, thanksSentence, WITH_THANKS } from '@/content/team'
import { useFeedbackDialog } from '@/feedback/useFeedbackDialog'
import ContactCta from '@/components/contact/ContactCta.vue'
import AppLink from '@/navigation/AppLink.vue'
import { useAppRouter } from '@/navigation/router'
import { createTapCounter } from '@/utils/adminShortcut'
import { APP_TITLE, useDocumentTitle } from '@/navigation/head'
import type { PageRoute } from '@/navigation/routes'

// Every page receives its route from App.vue; this one does not need it, but
// declaring it keeps it from falling through onto <main> as an attribute.
defineProps<{ route?: PageRoute }>()

/**
 * About.
 *
 * Replaces two things at once: a two-sentence stub in this app, and the
 * legacy app's About page, which was a single 4.9MB bitmap of the whole team
 * panel with no way back to the rest of the site.
 *
 * Structured rather than reproduced -- partners, then the people, then where
 * the imaging and the model came from, all as real text with the DOIs as
 * real links. See content/team.ts for what that bitmap cost.
 */
useDocumentTitle(() => `About — ${APP_TITLE}`)

const { publicUrl } = useAssetUrl()
const feedback = useFeedbackDialog()

// A phone has no Ctrl + Shift + F: five quick taps on the version line open
// the team's inbox instead (which still asks for the password).
const router = useAppRouter()
const versionTaps = createTapCounter({
  taps: 5,
  windowMs: 2000,
  onTrigger: () => { void router.navigateTo('/feedback-review') },
})
const appVersion = __APP_VERSION__

/** Organisations with people to show, in content order; one row each. */
const teamOrgs = computed(() => organisations.filter(o => o.members.length > 0))
</script>

<template>
  <!-- A `<main>`, not a `<div>`: this page does not use the case layout (it
       has no stage and no sidebar), so nothing else on it provides the one
       main landmark every page owes. -->
  <main class="tw:mx-auto tw:max-w-5xl tw:px-6 tw:py-10 tw:max-md:pb-28 tw:sm:px-10 tw:sm:py-16">
    <!-- The legacy About page was a dead end: it had no way back to the app
         at all, which is the second half of the human's #13. -->
    <AppLink
      to="/"
      class="tw:group tw:inline-flex tw:min-h-11 tw:items-center tw:gap-1.5 tw:text-caption
             tw:uppercase tw:tracking-[0.14em] tw:text-text-muted tw:hover:text-brand-hover"
    >
      <svg viewBox="0 0 24 24" class="tw:size-3 tw:transition-transform tw:group-hover:-translate-x-0.5" aria-hidden="true">
        <path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="m15 5-7 7 7 7" />
      </svg>
      Back to the resource
    </AppLink>

    <h1 class="tw:mt-4 tw:text-h1 tw:font-bold tw:tracking-tight tw:text-text">About</h1>
    <p class="tw:prose-medical tw:mt-4 tw:max-w-2xl tw:text-body tw:text-text-muted">
      Te Uma is an educational resource from the Auckland Bioengineering
      Institute, built with Breast Cancer Foundation NZ and Iwi United Engaged.
    </p>
    <ContactCta variant="banner" class="tw:mt-8 tw:max-w-xl" />

    <!-- ── Partners ─────────────────────────────────────────────────────── -->
    <section class="tw:mt-14" aria-labelledby="partners-heading">
      <h2 id="partners-heading" class="tw:text-caption tw:uppercase tw:tracking-[0.14em] tw:text-text-muted">
        Partners
      </h2>
      <ul class="tw:mt-5 tw:flex tw:flex-wrap tw:items-center tw:gap-x-12 tw:gap-y-8">
        <li v-for="org in shownLogos()" :key="org.name">
          <img
            :src="publicUrl(`logos/${org.logo}`)"
            :alt="org.name"
            :style="{ width: `${org.logoWidth}rem` }"
            class="tw:h-auto tw:max-w-full"
            loading="lazy"
          >
        </li>
      </ul>
    </section>

    <!-- ── Team ─────────────────────────────────────────────────────────
         One row per organisation: its name on the left, its people on the
         right, so a group of one and a group of twelve both sit well. An
         organisation with nobody listed has no row. A thank-you closes the
         section, naming the people it thanks. -->
    <section class="tw:mt-14" aria-labelledby="team-heading">
      <h2 id="team-heading" class="tw:text-caption tw:uppercase tw:tracking-[0.14em] tw:text-text-muted">
        Our Team
      </h2>

      <div class="tw:mt-5 tw:divide-y tw:divide-border tw:border-y tw:border-border">
        <div
          v-for="org in teamOrgs"
          :key="org.name"
          data-team-row
          class="tw:grid tw:gap-5 tw:py-8 tw:md:grid-cols-[13rem_minmax(0,1fr)] tw:md:gap-10"
        >
          <h3 class="tw:text-body tw:font-bold tw:leading-snug tw:text-text tw:md:pt-1">{{ org.name }}</h3>
          <ul class="tw:grid tw:grid-cols-3 tw:gap-x-5 tw:gap-y-6 tw:sm:grid-cols-4 tw:lg:grid-cols-5">
            <li v-for="person in org.members" :key="person.name" class="tw:text-center">
              <!--
                `object-contain` in a fixed 3:4 frame, NOT `object-cover` in a
                circle: nothing of a face is cropped. Decorative: the name is
                the very next node, so an `alt` would announce everyone twice.
              -->
              <img
                :src="publicUrl(`team/${person.photo}`)"
                alt=""
                aria-hidden="true"
                width="240"
                height="320"
                loading="lazy"
                class="tw:aspect-3/4 tw:w-full tw:rounded-card tw:bg-surface-sunken tw:object-contain tw:ring-1 tw:ring-border"
              >
              <span class="tw:mt-2 tw:block tw:text-body-sm tw:leading-snug tw:text-text">{{ person.name }}</span>
            </li>
          </ul>
        </div>

        <div
          v-if="WITH_THANKS.length"
          data-team-row="thanks"
          class="tw:grid tw:gap-3 tw:py-8 tw:md:grid-cols-[13rem_minmax(0,1fr)] tw:md:gap-10"
        >
          <h3 class="tw:text-body tw:font-bold tw:leading-snug tw:text-text tw:md:pt-0.5">With thanks</h3>
          <p class="tw:max-w-2xl tw:text-body tw:leading-relaxed tw:text-text-muted">
            <template v-for="(part, i) in thanksSentence(WITH_THANKS)" :key="i">
              <strong v-if="part.name" class="tw:font-semibold tw:text-text">{{ part.text }}</strong>
              <template v-else>{{ part.text }}</template>
            </template>
          </p>
        </div>
      </div>
    </section>

    <!-- ── Sources ──────────────────────────────────────────────────────── -->
    <section class="tw:mt-14" aria-labelledby="sources-heading">
      <h2 id="sources-heading" class="tw:text-caption tw:uppercase tw:tracking-[0.14em] tw:text-text-muted">
        Imaging and model sources
      </h2>
      <ul class="tw:mt-5 tw:flex tw:flex-col tw:gap-5">
        <li v-for="c in citations" :key="c.doi" class="tw:max-w-3xl">
          <p class="tw:text-body-sm tw:font-bold tw:text-text">{{ c.used }}</p>
          <p class="tw:mt-1 tw:text-body-sm tw:leading-relaxed tw:text-text-muted">
            {{ c.reference }}
            <!-- A real anchor. In the bitmap this was a picture of a URL. -->
            <a
              :href="c.doi"
              target="_blank"
              rel="noopener noreferrer"
              class="tw:text-brand-hover tw:underline tw:decoration-brand/40 tw:underline-offset-2 tw:hover:decoration-brand"
            >{{ c.doi }}</a>
          </p>
        </li>
      </ul>
    </section>

    <!-- ── Feedback ─────────────────────────────────────────────────────── -->
    <section class="tw:mt-14 tw:border-t tw:border-border tw:pt-8">
      <!-- The in-app feedback (the floating button's own dialog), not the
           legacy app's Google Form. -->
      <p v-if="feedback" class="tw:flex tw:flex-wrap tw:items-center tw:gap-x-3 tw:gap-y-2 tw:text-body-sm tw:text-text-muted">
        {{ FEEDBACK_COPY.openLead }}
        <button
          type="button"
          data-feedback-open
          class="tw:min-h-11 tw:rounded-full tw:bg-surface-sunken tw:px-4 tw:font-bold tw:text-text tw:transition-colors tw:hover:bg-border"
          @click="feedback.open()"
        >{{ FEEDBACK_COPY.open }}</button>
      </p>
      <!-- touch-action: manipulation turns off double-tap zoom on this line
           only (pinch zoom stays); select-none keeps fast taps from selecting it. -->
      <p
        class="vw-version tw:mt-4 tw:inline-block tw:touch-manipulation tw:select-none tw:text-caption tw:tabular-nums tw:text-text-muted"
        data-app-version
        @click="versionTaps.tap()"
      >
        {{ APP_TITLE }} v{{ appVersion }}
      </p>
    </section>
  </main>
</template>

<style scoped>
/* Five quick taps open the team's inbox: no grey flash on each one. */
.vw-version { -webkit-tap-highlight-color: transparent; }
</style>
