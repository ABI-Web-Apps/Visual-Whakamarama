<script setup lang="ts">
import { computed, ref } from 'vue'
import RatingFaces from '@/components/feedback/RatingFaces.vue'
import { FEEDBACK_COPY } from '@/content/feedback'
import { postFeedback } from '@/feedback/api'
import type { FeedbackError, Rating } from '@/feedback/types'
import AppLink from '@/navigation/AppLink.vue'

/**
 * The feedback form (the client's own two questions), and its thank-you.
 *
 * The draft is the caller's (`v-model:rating`, `v-model:comment`), so closing
 * the dialog half-way loses nothing. A failed send keeps every word and says
 * why in the form itself; Send tries again.
 */
const rating = defineModel<Rating | null>('rating', { default: null })
const comment = defineModel<string>('comment', { default: '' })
const props = defineProps<{ page: string, titleId?: string }>()
const emit = defineEmits<{ sent: [] }>()

const MAX = 1000
const COUNT_FROM = 900

const status = ref<'idle' | 'sending' | 'sent'>('idle')
const error = ref('')
const canSend = computed(() => status.value === 'idle' && (rating.value !== null || comment.value.trim() !== ''))
const left = computed(() => MAX - comment.value.length)

async function submit() {
  if (!canSend.value) return
  status.value = 'sending'
  error.value = ''
  try {
    await postFeedback({ rating: rating.value, comment: comment.value }, props.page)
    status.value = 'sent'
    emit('sent')
  }
  catch (e) {
    error.value = (e as FeedbackError).summary ?? FEEDBACK_COPY.unreachable
    status.value = 'idle'
  }
}
</script>

<template>
  <div v-if="status === 'sent'" class="tw:flex tw:flex-col tw:items-center tw:px-2 tw:pb-4 tw:pt-6 tw:text-center" data-feedback-sent>
    <svg viewBox="0 0 64 64" class="vw-fb-check tw:size-16" fill="none" aria-hidden="true">
      <circle cx="32" cy="32" r="29" stroke="#E3F2E8" stroke-width="6" />
      <circle cx="32" cy="32" r="29" stroke="#2B6E45" stroke-width="3" class="vw-fb-check-ring" />
      <path d="m20 33 8.5 8.5L45 24" stroke="#2B6E45" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" class="vw-fb-check-mark" />
    </svg>
    <h2 :id="titleId" class="tw:mt-5 tw:text-h2 tw:font-bold tw:text-text">{{ FEEDBACK_COPY.thanks }}</h2>
    <p class="tw:mt-1.5 tw:text-body-sm tw:text-text-muted">{{ FEEDBACK_COPY.thanksDetail }}</p>
  </div>

  <form v-else class="tw:flex tw:flex-col" novalidate @submit.prevent="submit">
    <h2 :id="titleId" class="tw:text-h2 tw:font-bold tw:text-text">{{ FEEDBACK_COPY.title }}</h2>
    <p class="tw:mt-1 tw:text-body-sm tw:text-text-muted">{{ FEEDBACK_COPY.lead }}</p>

    <p class="tw:mt-6 tw:text-body tw:font-bold tw:text-text" aria-hidden="true">{{ FEEDBACK_COPY.easeQuestion }}</p>
    <RatingFaces v-model="rating" :label="FEEDBACK_COPY.easeQuestion" class="tw:mt-3" />

    <label for="vw-feedback-comment" class="tw:mt-6 tw:text-body tw:font-bold tw:text-text">{{ FEEDBACK_COPY.changeQuestion }}</label>
    <textarea
      id="vw-feedback-comment"
      v-model="comment"
      :maxlength="MAX"
      rows="4"
      :placeholder="FEEDBACK_COPY.placeholder"
      aria-describedby="vw-feedback-privacy"
      class="tw:mt-3 tw:min-h-28 tw:w-full tw:resize-y tw:rounded-ctl tw:border tw:border-border tw:bg-surface tw:px-3.5 tw:py-3
             tw:text-body tw:text-text tw:placeholder:text-text-subtle tw:transition-[border-color,box-shadow]
             tw:focus:border-group-results tw:focus:outline-none tw:focus:ring-4 tw:focus:ring-group-results/12"
    />
    <div class="tw:mt-2 tw:flex tw:items-start tw:justify-between tw:gap-3">
      <p id="vw-feedback-privacy" class="tw:text-caption tw:text-text-muted">{{ FEEDBACK_COPY.privacy }}</p>
      <p v-if="comment.length >= COUNT_FROM" data-count class="tw:shrink-0 tw:text-caption tw:tabular-nums tw:text-text-muted">
        {{ FEEDBACK_COPY.charactersLeft(left) }}
      </p>
    </div>

    <p
      v-if="error"
      role="alert"
      class="tw:mt-4 tw:rounded-ctl tw:bg-brand-subtle tw:px-3.5 tw:py-2.5 tw:text-body-sm tw:text-brand-hover"
    >
      {{ error }}
    </p>

    <button
      type="submit"
      :disabled="!canSend"
      class="tw:mt-5 tw:flex tw:min-h-12 tw:w-full tw:items-center tw:justify-center tw:gap-2 tw:rounded-ctl tw:bg-text
             tw:text-body tw:font-bold tw:text-white tw:shadow-sm tw:transition-[opacity,transform,background-color]
             tw:hover:bg-[#2A2F3D] tw:active:scale-[.99] tw:disabled:cursor-not-allowed tw:disabled:opacity-35
             tw:disabled:hover:bg-text"
    >
      <svg
        v-if="status === 'sending'"
        viewBox="0 0 24 24"
        class="tw:size-4 tw:animate-spin"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M12 3a9 9 0 1 0 9 9" />
      </svg>
      {{ status === 'sending' ? FEEDBACK_COPY.sending : FEEDBACK_COPY.send }}
    </button>

    <p class="tw:mt-4 tw:text-center tw:text-body-sm tw:text-text-muted">
      {{ FEEDBACK_COPY.talkLead }}
      <AppLink
        to="/contact"
        class="tw:font-bold tw:text-group-results tw:underline tw:decoration-group-results/30 tw:underline-offset-2
               tw:hover:decoration-group-results"
      >{{ FEEDBACK_COPY.talkAction }}</AppLink>
    </p>
  </form>
</template>

<style scoped>
.vw-fb-check-ring {
  stroke-dasharray: 183;
  stroke-dashoffset: 183;
  transform: rotate(-90deg);
  transform-origin: 50% 50%;
  animation: vw-fb-draw .55s cubic-bezier(.65, 0, .35, 1) forwards;
}
.vw-fb-check-mark {
  stroke-dasharray: 40;
  stroke-dashoffset: 40;
  animation: vw-fb-draw .35s .45s cubic-bezier(.65, 0, .35, 1) forwards;
}
@keyframes vw-fb-draw { to { stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) {
  .vw-fb-check-ring,
  .vw-fb-check-mark { animation: none; stroke-dashoffset: 0; }
}
</style>
