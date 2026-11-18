<script setup lang="ts">
import { computed, nextTick, onDeactivated, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { REVIEW_COPY } from '@/content/feedback'
import { deleteFeedback, deleteSubscriber, fetchFeedback, fetchSubscribers } from '@/feedback/api'
import { csvFileName, feedbackCsv, subscribersCsv } from '@/feedback/csv'
import { RATINGS, ratingLabel } from '@/feedback/types'
import type { FeedbackEntry, FeedbackError, Rating, Subscriber } from '@/feedback/types'
import AppLink from '@/navigation/AppLink.vue'
import { APP_TITLE, useDocumentTitle } from '@/navigation/head'
import type { PageRoute } from '@/navigation/routes'

defineProps<{ route?: PageRoute }>()

/**
 * The team's feedback inbox: everything readers sent, and the Stay in touch
 * sign-ups. Linked from nowhere (Ctrl + Shift + F, or five taps on About's
 * version line), and still behind a password the backend checks on every
 * request -- this page never decides who may read.
 *
 * The password and the lists live only while the page is on screen: Lock,
 * leaving the page (it is kept alive, so `onDeactivated`) or the backend
 * refusing the password again all forget both.
 */
useDocumentTitle(() => `${REVIEW_COPY.title} — ${APP_TITLE}`)
const toast = useToast()

const password = ref('')
const unlocked = ref(false)
const busy = ref(false)
const gateError = ref('')
const shake = ref(false)
const passwordInput = ref<HTMLInputElement | null>(null)

const feedback = ref<FeedbackEntry[]>([])
const subscribers = ref<Subscriber[]>([])
const tab = ref<'feedback' | 'stay'>('feedback')

// ── Getting in, and out ───────────────────────────────────────────────────

async function load(pw: string): Promise<void> {
  const [f, s] = await Promise.all([fetchFeedback(pw), fetchSubscribers(pw)])
  feedback.value = f.items
  subscribers.value = s.items
}

async function unlock() {
  if (!password.value || busy.value) return
  busy.value = true
  gateError.value = ''
  try {
    await load(password.value)
    unlocked.value = true
  }
  catch (e) {
    refused(e as FeedbackError)
  }
  finally {
    busy.value = false
  }
}

function lock(message = '') {
  unlocked.value = false
  password.value = ''
  feedback.value = []
  subscribers.value = []
  confirming.value = null
  gateError.value = message
  tab.value = 'feedback'
}

/** Any refusal: the gate again, with why. */
function refused(e: FeedbackError) {
  const again = unlocked.value
  lock(e.status === 401 ? (again ? REVIEW_COPY.again : e.summary) : e.summary)
  shake.value = true
  setTimeout(() => { shake.value = false }, 450)
  void nextTick(() => passwordInput.value?.focus())
}

async function refresh() {
  busy.value = true
  try {
    await load(password.value)
  }
  catch (e) {
    refused(e as FeedbackError)
  }
  finally {
    busy.value = false
  }
}

onDeactivated(() => lock())

// ── Feedback: numbers and filters ────────────────────────────────────────

const ratingFilter = ref<Rating | null>(null)
const withComment = ref(false)
const search = ref('')

const rated = computed(() => feedback.value.filter(e => e.rating !== null))
const average = computed(() => rated.value.length
  ? rated.value.reduce((sum, e) => sum + (e.rating ?? 0), 0) / rated.value.length
  : null)
const counts = computed(() => RATINGS.map(r => ({ ...r, count: feedback.value.filter(e => e.rating === r.value).length })))

const shownFeedback = computed(() => {
  const words = search.value.trim().toLowerCase()
  return feedback.value.filter(e =>
    (ratingFilter.value === null || e.rating === ratingFilter.value)
    && (!withComment.value || e.comment.trim() !== '')
    && (!words || `${e.comment} ${e.page}`.toLowerCase().includes(words)))
})

function toggleRating(value: Rating) {
  ratingFilter.value = ratingFilter.value === value ? null : value
}

function inkOf(rating: Rating | null) {
  return RATINGS.find(r => r.value === rating) ?? { ink: '#586273', fill: '#EEF0F4', label: '' }
}

// ── Times ────────────────────────────────────────────────────────────────

const when = new Intl.DateTimeFormat('en-NZ', { dateStyle: 'medium', timeStyle: 'short' })
const relative = new Intl.RelativeTimeFormat('en-NZ', { numeric: 'auto' })
function localTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : when.format(d)
}
function ago(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000
  if (Number.isNaN(seconds)) return ''
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [['day', 86400], ['hour', 3600], ['minute', 60]]
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
  }
  return relative.format(0, 'minute')
}

// ── Deleting ─────────────────────────────────────────────────────────────

const confirming = ref<string | null>(null)
const deleting = ref<string | null>(null)

async function remove(kind: 'feedback' | 'stay', id: string) {
  deleting.value = id
  try {
    await (kind === 'feedback' ? deleteFeedback : deleteSubscriber)(password.value, id)
    toast.show(REVIEW_COPY.deleted)
  }
  catch (e) {
    const err = e as FeedbackError
    if (err.status === 401) return refused(err)
    if (err.status !== 404) {
      toast.show(err.summary)
      return
    }
    toast.show(err.summary) // already gone: drop it from the list too
  }
  finally {
    deleting.value = null
    confirming.value = null
  }
  if (kind === 'feedback') feedback.value = feedback.value.filter(e => e.id !== id)
  else subscribers.value = subscribers.value.filter(s => s.id !== id)
}

// ── Export ───────────────────────────────────────────────────────────────

function exportCsv() {
  const text = tab.value === 'feedback' ? feedbackCsv(shownFeedback.value) : subscribersCsv(subscribers.value)
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = csvFileName(tab.value === 'feedback' ? 'feedback' : 'stay-in-touch')
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

const toolButton = 'tw:inline-flex tw:min-h-10 tw:items-center tw:gap-1.5 tw:rounded-full tw:bg-surface tw:px-4 tw:text-body-sm '
  + 'tw:font-bold tw:text-text tw:ring-1 tw:ring-border tw:transition-shadow tw:hover:ring-group-results/45 tw:disabled:opacity-50'
</script>

<template>
  <main class="tw:mx-auto tw:max-w-5xl tw:px-4 tw:py-10 tw:max-md:pb-28 tw:sm:px-10 tw:sm:py-14">
    <AppLink
      to="/"
      class="tw:group tw:inline-flex tw:min-h-11 tw:items-center tw:gap-1.5 tw:text-caption
             tw:uppercase tw:tracking-[0.14em] tw:text-text-muted tw:hover:text-brand-hover"
    >
      <svg viewBox="0 0 24 24" class="tw:size-3 tw:transition-transform tw:group-hover:-translate-x-0.5" aria-hidden="true">
        <path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="m15 5-7 7 7 7" />
      </svg>
      {{ REVIEW_COPY.back }}
    </AppLink>

    <!-- ── The gate ───────────────────────────────────────────────────── -->
    <div v-if="!unlocked" class="tw:mx-auto tw:mt-8 tw:max-w-sm tw:sm:mt-14">
      <form
        data-review-gate
        class="tw:overflow-hidden tw:rounded-card tw:bg-surface tw:shadow-lg tw:ring-1 tw:ring-border"
        :class="shake ? 'vw-review-shake' : ''"
        novalidate
        @submit.prevent="unlock"
      >
        <div class="vw-review-masthead" aria-hidden="true" />
        <div class="tw:flex tw:flex-col tw:p-6 tw:sm:p-8">
          <span class="tw:flex tw:size-12 tw:items-center tw:justify-center tw:rounded-full tw:bg-group-results/10 tw:text-group-results" aria-hidden="true">
            <svg viewBox="0 0 24 24" class="tw:size-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
              <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
            </svg>
          </span>
          <h1 class="tw:mt-4 tw:text-h2 tw:font-bold tw:text-text">{{ REVIEW_COPY.title }}</h1>
          <p class="tw:mt-1 tw:text-body-sm tw:text-text-muted">{{ REVIEW_COPY.gateLead }}</p>
          <label for="vw-review-password" class="tw:mt-6 tw:text-body-sm tw:font-bold tw:text-text">{{ REVIEW_COPY.password }}</label>
          <input
            id="vw-review-password"
            ref="passwordInput"
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="tw:mt-2 tw:min-h-12 tw:w-full tw:rounded-ctl tw:border tw:border-border tw:bg-surface tw:px-3.5 tw:text-body tw:text-text
                   tw:focus:border-group-results tw:focus:outline-none tw:focus:ring-4 tw:focus:ring-group-results/12"
          >
          <p v-if="gateError" role="alert" class="tw:mt-3 tw:text-body-sm tw:font-medium tw:text-brand-hover">{{ gateError }}</p>
          <button
            type="submit"
            :disabled="!password || busy"
            class="tw:mt-5 tw:min-h-12 tw:w-full tw:rounded-ctl tw:bg-text tw:text-body tw:font-bold tw:text-white
                   tw:transition-[opacity,background-color] tw:hover:bg-[#2A2F3D] tw:disabled:cursor-not-allowed tw:disabled:opacity-40"
          >{{ busy ? REVIEW_COPY.unlocking : REVIEW_COPY.unlock }}</button>
        </div>
      </form>
    </div>

    <!-- ── The inbox ──────────────────────────────────────────────────── -->
    <div v-else data-review class="tw:mt-4">
      <div class="tw:flex tw:flex-wrap tw:items-end tw:justify-between tw:gap-4">
        <div>
          <h1 class="tw:text-h1 tw:font-bold tw:tracking-tight tw:text-text">{{ REVIEW_COPY.title }}</h1>
          <p class="tw:mt-1 tw:text-body-sm tw:text-text-muted">{{ REVIEW_COPY.lead }}</p>
        </div>
        <div class="tw:flex tw:gap-2">
          <button type="button" :class="toolButton" :disabled="busy" @click="refresh">
            <svg viewBox="0 0 24 24" class="tw:size-4" :class="busy ? 'tw:animate-spin' : ''" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4.5V11h-6.5" />
            </svg>
            {{ REVIEW_COPY.refresh }}
          </button>
          <button type="button" :class="toolButton" @click="lock()">
            <svg viewBox="0 0 24 24" class="tw:size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
              <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
            </svg>
            {{ REVIEW_COPY.lock }}
          </button>
        </div>
      </div>

      <div role="tablist" :aria-label="REVIEW_COPY.listsLabel" class="tw:mt-6 tw:inline-flex tw:rounded-full tw:bg-surface-sunken tw:p-1">
        <button
          v-for="t in [{ key: 'feedback', label: REVIEW_COPY.tabFeedback(feedback.length) }, { key: 'stay', label: REVIEW_COPY.tabStay(subscribers.length) }]"
          :key="t.key"
          type="button"
          role="tab"
          :aria-selected="tab === t.key ? 'true' : 'false'"
          class="tw:min-h-10 tw:rounded-full tw:px-4 tw:text-body-sm tw:font-bold tw:tabular-nums tw:transition-[background-color,color,box-shadow]"
          :class="tab === t.key ? 'tw:bg-surface tw:text-text tw:shadow-sm' : 'tw:text-text-muted tw:hover:text-text'"
          @click="tab = t.key as 'feedback' | 'stay'; confirming = null"
        >{{ t.label }}</button>
      </div>

      <!-- Feedback -->
      <section v-if="tab === 'feedback'" role="tabpanel" class="tw:mt-6">
        <div class="tw:grid tw:gap-3 tw:sm:grid-cols-[auto_auto_minmax(0,1fr)]">
          <div data-stat="total" class="tw:rounded-card tw:bg-surface tw:px-5 tw:py-4 tw:ring-1 tw:ring-border">
            <p class="tw:text-caption tw:text-text-muted">{{ REVIEW_COPY.total }}</p>
            <p class="tw:text-h1 tw:font-bold tw:tabular-nums tw:text-text">{{ feedback.length }}</p>
          </div>
          <div data-stat="average" class="tw:rounded-card tw:bg-surface tw:px-5 tw:py-4 tw:ring-1 tw:ring-border">
            <p class="tw:text-caption tw:text-text-muted">{{ REVIEW_COPY.average }}</p>
            <p class="tw:text-h1 tw:font-bold tw:tabular-nums tw:text-text">
              {{ average === null ? '—' : average.toFixed(1) }}<span class="tw:text-body tw:font-medium tw:text-text-muted"> / 5</span>
            </p>
          </div>
          <div class="tw:rounded-card tw:bg-surface tw:px-5 tw:py-4 tw:ring-1 tw:ring-border">
            <p class="tw:text-caption tw:text-text-muted">{{ REVIEW_COPY.spread }}</p>
            <div class="tw:mt-2.5 tw:flex tw:h-3 tw:overflow-hidden tw:rounded-full tw:bg-surface-sunken" aria-hidden="true">
              <span
                v-for="c in counts"
                :key="c.value"
                :style="{ flexGrow: c.count, background: c.ink }"
                class="tw:basis-0"
              />
            </div>
            <ul class="tw:mt-2 tw:flex tw:flex-wrap tw:gap-x-3 tw:gap-y-1 tw:text-caption tw:text-text-muted">
              <li v-for="c in counts" :key="c.value" class="tw:flex tw:items-center tw:gap-1.5">
                <span class="tw:size-2 tw:rounded-full" :style="{ background: c.ink }" aria-hidden="true" />
                {{ c.label }} <span class="tw:font-bold tw:tabular-nums tw:text-text">{{ c.count }}</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="tw:mt-5 tw:flex tw:flex-wrap tw:items-center tw:gap-2">
          <button
            v-for="r in RATINGS"
            :key="r.value"
            type="button"
            :data-filter-rating="r.value"
            :aria-pressed="ratingFilter === r.value ? 'true' : 'false'"
            class="tw:min-h-9 tw:rounded-full tw:px-3 tw:text-caption tw:font-bold tw:ring-1 tw:transition-colors"
            :class="ratingFilter === r.value ? 'tw:ring-transparent' : 'tw:bg-surface tw:text-text-muted tw:ring-border tw:hover:text-text'"
            :style="ratingFilter === r.value ? { background: r.fill, color: r.ink, boxShadow: `inset 0 0 0 1.5px ${r.ink}` } : {}"
            @click="toggleRating(r.value)"
          >{{ r.label }}</button>
          <label class="tw:ml-1 tw:inline-flex tw:min-h-9 tw:cursor-pointer tw:items-center tw:gap-2 tw:text-body-sm tw:text-text">
            <input v-model="withComment" type="checkbox" class="tw:size-4 tw:accent-[#5B3F99]">
            {{ REVIEW_COPY.withComment }}
          </label>
          <input
            v-model="search"
            type="search"
            :placeholder="REVIEW_COPY.search"
            :aria-label="REVIEW_COPY.search"
            class="tw:min-h-9 tw:min-w-0 tw:flex-1 tw:rounded-full tw:border tw:border-border tw:bg-surface tw:px-4 tw:text-body-sm
                   tw:focus:border-group-results tw:focus:outline-none tw:sm:max-w-64"
          >
          <button type="button" :class="toolButton" class="tw:ml-auto" @click="exportCsv">{{ REVIEW_COPY.exportCsv }}</button>
        </div>

        <p v-if="feedback.length === 0" class="tw:mt-8 tw:text-body tw:text-text-muted">{{ REVIEW_COPY.noFeedback }}</p>
        <p v-else-if="shownFeedback.length === 0" class="tw:mt-8 tw:text-body tw:text-text-muted">{{ REVIEW_COPY.noMatch }}</p>
        <ul v-else class="tw:mt-5 tw:flex tw:flex-col tw:gap-3">
          <li
            v-for="e in shownFeedback"
            :key="e.id"
            data-feedback-entry
            :data-id="e.id"
            class="tw:rounded-card tw:bg-surface tw:p-4 tw:ring-1 tw:ring-border tw:sm:p-5"
          >
            <div class="tw:flex tw:items-start tw:gap-3">
              <span
                class="tw:shrink-0 tw:rounded-full tw:px-2.5 tw:py-1 tw:text-caption tw:font-bold"
                :style="{ background: inkOf(e.rating).fill, color: inkOf(e.rating).ink }"
              >{{ e.rating === null ? REVIEW_COPY.noRating : ratingLabel(e.rating) }}</span>
              <p
                class="tw:min-w-0 tw:flex-1 tw:whitespace-pre-wrap tw:break-words tw:text-body"
                :class="e.comment ? 'tw:text-text' : 'tw:italic tw:text-text-subtle'"
              >{{ e.comment || REVIEW_COPY.noComment }}</p>
              <button
                v-if="confirming !== e.id"
                type="button"
                aria-label="Delete"
                class="tw:-mr-1 tw:-mt-1 tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full
                       tw:text-text-subtle tw:transition-colors tw:hover:bg-brand-subtle tw:hover:text-brand-hover"
                @click="confirming = e.id"
              >
                <svg viewBox="0 0 24 24" class="tw:size-[1.125rem]" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M4.5 7h15M9.5 7V5h5v2M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12M10 11v6M14 11v6" />
                </svg>
              </button>
            </div>
            <div
              v-if="confirming === e.id"
              class="tw:mt-3 tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:rounded-ctl tw:bg-brand-subtle tw:px-3 tw:py-2"
            >
              <p class="tw:mr-auto tw:text-body-sm tw:font-medium tw:text-brand-hover">{{ REVIEW_COPY.confirm }}</p>
              <button
                type="button"
                data-confirm-delete
                :disabled="deleting === e.id"
                class="tw:min-h-9 tw:rounded-full tw:bg-brand-hover tw:px-4 tw:text-body-sm tw:font-bold tw:text-white tw:disabled:opacity-50"
                @click="remove('feedback', e.id)"
              >{{ REVIEW_COPY.delete }}</button>
              <button
                type="button"
                data-cancel-delete
                class="tw:min-h-9 tw:rounded-full tw:px-3 tw:text-body-sm tw:font-bold tw:text-text"
                @click="confirming = null"
              >{{ REVIEW_COPY.cancel }}</button>
            </div>
            <p class="tw:mt-3 tw:flex tw:flex-wrap tw:gap-x-4 tw:gap-y-1 tw:text-caption tw:text-text-muted">
              <span :title="e.created_at">{{ localTime(e.created_at) }} · {{ ago(e.created_at) }}</span>
              <span>{{ e.page }}</span>
              <span>{{ e.device }}</span>
              <span>v{{ e.app_version }} {{ e.mode }}</span>
              <span class="tw:font-mono tw:text-text-subtle">{{ e.id }}</span>
            </p>
          </li>
        </ul>
      </section>

      <!-- Stay in touch -->
      <section v-else role="tabpanel" class="tw:mt-6">
        <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-3">
          <p class="tw:mr-auto tw:max-w-xl tw:text-body-sm tw:text-text-muted">{{ REVIEW_COPY.stayLead }}</p>
          <button type="button" :class="toolButton" @click="exportCsv">{{ REVIEW_COPY.exportCsv }}</button>
        </div>
        <p v-if="subscribers.length === 0" class="tw:mt-8 tw:text-body tw:text-text-muted">{{ REVIEW_COPY.noSubscribers }}</p>
        <ul v-else class="tw:mt-5 tw:divide-y tw:divide-border tw:overflow-hidden tw:rounded-card tw:bg-surface tw:ring-1 tw:ring-border">
          <li v-for="s in subscribers" :key="s.id" data-subscriber :data-id="s.id" class="tw:px-4 tw:py-3.5 tw:sm:px-5">
            <!-- Stacked on a phone, one line from sm up; Delete always at the end. -->
            <div class="tw:flex tw:items-center tw:gap-3">
              <div class="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-0.5 tw:sm:flex-row tw:sm:items-center tw:sm:gap-x-4">
                <p class="tw:text-body tw:font-bold tw:sm:w-36 tw:sm:shrink-0" :class="s.first_name ? 'tw:text-text' : 'tw:font-normal tw:italic tw:text-text-subtle'">
                  {{ s.first_name || REVIEW_COPY.noName }}
                </p>
                <a
                  :href="s.contact_type === 'email' ? `mailto:${s.contact}` : `tel:${s.contact}`"
                  class="tw:min-w-0 tw:break-all tw:text-body tw:font-semibold tw:text-group-results tw:underline tw:decoration-group-results/30 tw:underline-offset-2"
                >{{ s.contact }}</a>
                <span class="tw:flex tw:items-center tw:gap-2 tw:sm:ml-auto">
                  <span class="tw:rounded-full tw:bg-surface-sunken tw:px-2 tw:py-0.5 tw:text-caption tw:font-bold tw:text-text-muted">
                    {{ s.contact_type === 'email' ? REVIEW_COPY.email : REVIEW_COPY.phone }}
                  </span>
                  <span class="tw:text-caption tw:text-text-muted" :title="s.created_at">{{ localTime(s.created_at) }}</span>
                </span>
              </div>
              <button
                v-if="confirming !== s.id"
                type="button"
                aria-label="Delete"
                class="tw:flex tw:size-10 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:text-text-subtle
                       tw:transition-colors tw:hover:bg-brand-subtle tw:hover:text-brand-hover"
                @click="confirming = s.id"
              >
                <svg viewBox="0 0 24 24" class="tw:size-[1.125rem]" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M4.5 7h15M9.5 7V5h5v2M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12M10 11v6M14 11v6" />
                </svg>
              </button>
            </div>
            <div
              v-if="confirming === s.id"
              class="tw:mt-2 tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:rounded-ctl tw:bg-brand-subtle tw:px-3 tw:py-2"
            >
              <p class="tw:mr-auto tw:text-body-sm tw:font-medium tw:text-brand-hover">{{ REVIEW_COPY.confirmSubscriber }}</p>
              <button
                type="button"
                data-confirm-delete
                :disabled="deleting === s.id"
                class="tw:min-h-9 tw:rounded-full tw:bg-brand-hover tw:px-4 tw:text-body-sm tw:font-bold tw:text-white tw:disabled:opacity-50"
                @click="remove('stay', s.id)"
              >{{ REVIEW_COPY.delete }}</button>
              <button
                type="button"
                data-cancel-delete
                class="tw:min-h-9 tw:rounded-full tw:px-3 tw:text-body-sm tw:font-bold tw:text-text"
                @click="confirming = null"
              >{{ REVIEW_COPY.cancel }}</button>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </main>
</template>

<style scoped>
.vw-review-masthead {
  height: 4px;
  background: linear-gradient(90deg, #22A2A8 0%, #3D6FB0 52%, #5B3F99 100%);
}
.vw-review-shake { animation: vw-review-shake .4s cubic-bezier(.36, .07, .19, .97) both; }
@keyframes vw-review-shake {
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}
@media (prefers-reduced-motion: reduce) {
  .vw-review-shake { animation: none; }
}
</style>
