<script lang="ts">
/** Numbers each form's ids: the feedback dialog and Contact us can show one each at once. */
let formCount = 0
</script>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { KEEP_IN_TOUCH_COPY } from '@/content/feedback'
import { postSubscriber } from '@/feedback/api'
import { classifyContact } from '@/feedback/contactKind'
import type { FeedbackError } from '@/feedback/types'

/**
 * Stay in touch: a first name (optional) and an email address or mobile
 * number, in the client's own words.
 *
 * `stacked` is the mock-up's order, for the feedback dialog and any phone.
 * `split` puts the heading, invitation and promise on the left and the
 * fields on the right from `md` up, for Contact us.
 *
 * The contact is checked against the backend's own rule (classifyContact)
 * before anything is sent; a refusal from the backend shows the same way.
 * The fields are `v-model`s with local defaults, so the dialog can keep what
 * was typed while the reader looks at the other tab.
 */
const firstName = defineModel<string>('firstName', { default: '' })
const contact = defineModel<string>('contact', { default: '' })
const props = withDefaults(defineProps<{ layout?: 'stacked' | 'split', titleId?: string }>(), { layout: 'stacked' })
const emit = defineEmits<{ done: [] }>()

const n = ++formCount
const ids = {
  title: props.titleId ?? `vw-kit-title-${n}`,
  name: `vw-kit-name-${n}`,
  nameHelp: `vw-kit-name-help-${n}`,
  contact: `vw-kit-contact-${n}`,
  invalid: `vw-kit-invalid-${n}`,
  privacy: `vw-kit-privacy-${n}`,
}

const status = ref<'idle' | 'sending' | 'done'>('idle')
const done = ref<HTMLElement | null>(null)
const invalid = ref(false)
const error = ref('')
const split = computed(() => props.layout === 'split')

async function submit() {
  if (status.value !== 'idle') return
  error.value = ''
  invalid.value = classifyContact(contact.value) === null
  if (invalid.value) {
    document.getElementById(ids.contact)?.focus()
    return
  }
  status.value = 'sending'
  try {
    await postSubscriber({ first_name: firstName.value.trim(), contact: contact.value.trim() })
    status.value = 'done'
    emit('done')
    // The focused button is gone: the confirmation takes focus, and is announced.
    await nextTick()
    done.value?.focus()
  }
  catch (e) {
    error.value = (e as FeedbackError).summary
    status.value = 'idle'
  }
}

const inputClass = 'tw:mt-2 tw:min-h-12 tw:w-full tw:rounded-ctl tw:border tw:bg-surface tw:px-3.5 tw:text-body tw:text-text '
  + 'tw:placeholder:text-text-subtle tw:transition-[border-color,box-shadow] '
  + 'tw:focus:border-group-results tw:focus:outline-none tw:focus:ring-4 tw:focus:ring-group-results/12'
</script>

<template>
  <div
    data-keep-in-touch
    :class="split
      ? 'tw:grid tw:gap-6 tw:md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] tw:md:gap-10'
      : 'tw:flex tw:flex-col'"
  >
    <div>
      <h2 :id="ids.title" class="tw:text-h2 tw:font-bold tw:text-text" :class="split ? 'tw:sm:text-[1.5rem] tw:sm:leading-8' : ''">
        {{ KEEP_IN_TOUCH_COPY.title }}
      </h2>
      <p class="tw:mt-1 tw:text-body-sm tw:text-text-muted" :class="split ? 'tw:sm:text-body' : ''">{{ KEEP_IN_TOUCH_COPY.lead }}</p>
      <p v-if="split" :id="ids.privacy" class="tw:mt-4 tw:hidden tw:max-w-sm tw:text-caption tw:leading-relaxed tw:text-text-muted tw:md:block">
        {{ KEEP_IN_TOUCH_COPY.privacy }}
      </p>
    </div>

    <div
      v-if="status === 'done'"
      ref="done"
      data-keep-in-touch-done
      tabindex="-1"
      class="tw:flex tw:items-center tw:gap-4 tw:rounded-card tw:bg-[#E3F2E8] tw:p-5 tw:focus:outline-none"
      :class="split ? '' : 'tw:mt-6'"
      role="status"
    >
      <svg viewBox="0 0 24 24" class="tw:size-10 tw:shrink-0" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#2B6E45" />
        <path d="m7.2 12.4 3.2 3.2 6.4-6.8" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <div>
        <p class="tw:text-body tw:font-bold tw:text-[#1F5233]">{{ KEEP_IN_TOUCH_COPY.done }}</p>
        <p class="tw:text-body-sm tw:text-[#2B6E45]">{{ KEEP_IN_TOUCH_COPY.doneDetail }}</p>
      </div>
    </div>

    <form v-else class="tw:flex tw:flex-col" :class="split ? '' : 'tw:mt-5'" novalidate @submit.prevent="submit">
      <div class="tw:rounded-card tw:bg-surface-sunken tw:p-4">
        <label :for="ids.name" class="tw:text-body-sm tw:font-bold tw:text-text">{{ KEEP_IN_TOUCH_COPY.nameLabel }}</label>
        <p :id="ids.nameHelp" class="tw:text-caption tw:text-text-muted">{{ KEEP_IN_TOUCH_COPY.nameHelp }}</p>
        <input
          :id="ids.name"
          v-model="firstName"
          type="text"
          autocomplete="given-name"
          maxlength="60"
          :placeholder="KEEP_IN_TOUCH_COPY.namePlaceholder"
          :aria-describedby="ids.nameHelp"
          :class="[inputClass, 'tw:border-border']"
        >
      </div>

      <label :for="ids.contact" class="tw:mt-5 tw:text-body-sm tw:font-bold tw:text-text">{{ KEEP_IN_TOUCH_COPY.contactLabel }}</label>
      <input
        :id="ids.contact"
        v-model="contact"
        type="text"
        inputmode="email"
        autocomplete="email"
        autocapitalize="off"
        spellcheck="false"
        maxlength="254"
        :placeholder="KEEP_IN_TOUCH_COPY.contactPlaceholder"
        :aria-invalid="invalid ? 'true' : 'false'"
        :aria-describedby="invalid ? `${ids.invalid} ${ids.privacy}` : ids.privacy"
        :class="[inputClass, invalid ? 'tw:border-brand' : 'tw:border-border']"
        @input="invalid = false"
      >
      <p v-if="invalid" :id="ids.invalid" role="alert" class="tw:mt-2 tw:text-body-sm tw:font-medium tw:text-brand-hover">
        {{ KEEP_IN_TOUCH_COPY.invalid }}
      </p>
      <p
        v-if="error"
        role="alert"
        class="tw:mt-3 tw:rounded-ctl tw:bg-brand-subtle tw:px-3.5 tw:py-2.5 tw:text-body-sm tw:text-brand-hover"
      >{{ error }}</p>

      <button
        type="submit"
        :aria-disabled="status === 'sending' ? 'true' : undefined"
        class="tw:mt-5 tw:flex tw:min-h-12 tw:w-full tw:items-center tw:justify-center tw:gap-2 tw:rounded-ctl tw:bg-text
               tw:text-body tw:font-bold tw:text-white tw:shadow-sm tw:transition-[opacity,background-color]
               tw:hover:bg-[#2A2F3D] tw:disabled:opacity-60"
      >
        {{ status === 'sending' ? KEEP_IN_TOUCH_COPY.sending : KEEP_IN_TOUCH_COPY.send }}
      </button>
      <!-- On a split page the promise sits under the heading instead, from md up. -->
      <p
        :id="split ? undefined : ids.privacy"
        class="tw:mt-3 tw:text-caption tw:leading-relaxed tw:text-text-muted"
        :class="split ? 'tw:md:hidden' : ''"
      >
        {{ KEEP_IN_TOUCH_COPY.privacy }}
      </p>
    </form>
  </div>
</template>
