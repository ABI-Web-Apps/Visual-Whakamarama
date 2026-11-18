<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { CONTACT_COPY, gmailComposeHref, mailtoHref, outlookComposeHref } from '@/content/contact'
import { useToast } from '@/composables/useToast'
import { copyText } from '@/utils/clipboard'

/**
 * One person's email address, as the thing to press.
 *
 * The address is a real `mailto:` link, so the device's own mail app opens
 * with the address (and a subject) filled in, and the same click copies the
 * address. A page cannot ask whether a mail app is set up -- with none (common
 * on Windows) the click quietly does nothing -- but it can notice one opening:
 * the page loses focus or is hidden. If that has not happened 1.5 s after the
 * click, a small panel says the address is copied and offers Outlook and
 * Gmail on the web, each opening a new message to this address.
 *
 * The Copy button beside the address copies without opening anything.
 */
const props = defineProps<{ email: string, name: string }>()
const toast = useToast()

/** Split at the @, so a narrow phone wraps the address there and nowhere else. */
const at = props.email.indexOf('@')
const local = at > 0 ? props.email.slice(0, at) : props.email
const domain = at > 0 ? props.email.slice(at) : ''

const WATCH_MS = 1500
/** Shown when no mail app took the click: whether the address was copied. */
const fallback = ref<null | { copied: boolean }>(null)
let stopWatching: (() => void) | null = null

/** Resolves true if the page lost focus or was hidden within WATCH_MS: a mail app came up. */
function watchForMailApp(): Promise<boolean> {
  return new Promise((resolve) => {
    let left = false
    const onLeave = () => { left = true }
    const onVisibility = () => { if (document.visibilityState === 'hidden') left = true }
    window.addEventListener('blur', onLeave)
    document.addEventListener('visibilitychange', onVisibility)
    const timer = setTimeout(() => { stop(); resolve(left) }, WATCH_MS)
    function stop() {
      clearTimeout(timer)
      window.removeEventListener('blur', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
      stopWatching = null
    }
    stopWatching = stop
  })
}

async function onOpen() {
  // No preventDefault: the browser follows the mailto link as it normally would.
  stopWatching?.()
  fallback.value = null
  const opened = watchForMailApp()
  const copied = await copyText(props.email)
  if (await opened) toast.show(copied ? CONTACT_COPY.opening : CONTACT_COPY.openingNoCopy(props.email))
  else if (stopWatching === null && !unmounted) fallback.value = { copied }
}

let unmounted = false
onBeforeUnmount(() => {
  unmounted = true
  stopWatching?.()
})

async function onCopy() {
  const copied = await copyText(props.email)
  toast.show(copied ? CONTACT_COPY.copied : CONTACT_COPY.copyFailed(props.email))
}
</script>

<template>
  <div>
  <div
    class="tw:group/email tw:flex tw:items-stretch tw:overflow-hidden tw:rounded-ctl tw:bg-surface tw:ring-1 tw:ring-border
           tw:transition-shadow tw:hover:ring-group-results/45 tw:focus-within:ring-group-results/45"
  >
    <a
      :href="mailtoHref(props.email)"
      :aria-label="CONTACT_COPY.emailLabel(props.name, props.email)"
      class="tw:flex tw:min-h-14 tw:min-w-0 tw:flex-1 tw:items-center tw:gap-2.5 tw:px-3 tw:py-2.5 tw:sm:gap-3 tw:sm:px-3.5
             tw:text-group-results tw:transition-colors tw:hover:bg-group-results/6 tw:focus-visible:bg-group-results/6
             tw:focus-visible:outline-none"
      @click="onOpen"
    >
      <span
        class="tw:flex tw:size-8 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:bg-group-results/10 tw:sm:size-9
               tw:transition-colors tw:group-hover/email:bg-group-results tw:group-hover/email:text-white"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" class="tw:size-[1.125rem]" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
          <path d="m4 7.5 8 5.5 8-5.5" />
        </svg>
      </span>
      <span class="tw:min-w-0 tw:break-words tw:text-body-sm tw:font-semibold tw:sm:text-body">{{ local }}<wbr>{{ domain }}</span>
    </a>
    <button
      type="button"
      :aria-label="CONTACT_COPY.copyLabel(props.email)"
      class="tw:group tw:relative tw:flex tw:w-11 tw:shrink-0 tw:sm:w-12 tw:items-center tw:justify-center tw:border-l tw:border-border
             tw:text-text-muted tw:transition-colors tw:hover:bg-surface-sunken tw:hover:text-text
             tw:focus-visible:bg-surface-sunken tw:focus-visible:outline-none"
      @click="onCopy"
    >
      <svg viewBox="0 0 24 24" class="tw:size-[1.125rem]" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
        <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
      </svg>
      <span
        class="tw:pointer-events-none tw:absolute tw:bottom-full tw:right-0 tw:z-10 tw:mb-2 tw:whitespace-nowrap tw:rounded-ctl
               tw:bg-text tw:px-2 tw:py-1 tw:text-caption tw:font-medium tw:text-surface tw:opacity-0 tw:shadow-md
               tw:transition-opacity tw:group-hover:opacity-100 tw:group-focus-visible:opacity-100"
        aria-hidden="true"
      >Copy</span>
    </button>
  </div>

  <!-- No mail app took the click: say the address is copied, offer webmail. -->
  <div
    v-if="fallback"
    data-email-fallback
    role="status"
    class="tw:relative tw:mt-2 tw:rounded-ctl tw:bg-surface-sunken tw:py-3 tw:pl-3.5 tw:pr-11 tw:text-body-sm tw:text-text"
  >
    <p class="tw:font-bold">{{ CONTACT_COPY.noApp }}</p>
    <p class="tw:mt-0.5 tw:text-text-muted">
      {{ fallback.copied ? CONTACT_COPY.noAppCopied : CONTACT_COPY.noAppNotCopied(props.email) }}
    </p>
    <div class="tw:mt-2.5 tw:flex tw:flex-wrap tw:gap-2">
      <a
        :href="outlookComposeHref(props.email)"
        target="_blank"
        rel="noopener noreferrer"
        data-webmail="outlook"
        class="tw:inline-flex tw:min-h-10 tw:items-center tw:gap-1.5 tw:rounded-full tw:bg-surface tw:px-4 tw:font-bold
               tw:text-text tw:ring-1 tw:ring-border tw:transition-shadow tw:hover:ring-group-results/45"
      >
        {{ CONTACT_COPY.outlook }}
        <svg viewBox="0 0 24 24" class="tw:size-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M8 16 16 8M9 8h7v7" />
        </svg>
      </a>
      <a
        :href="gmailComposeHref(props.email)"
        target="_blank"
        rel="noopener noreferrer"
        data-webmail="gmail"
        class="tw:inline-flex tw:min-h-10 tw:items-center tw:gap-1.5 tw:rounded-full tw:bg-surface tw:px-4 tw:font-bold
               tw:text-text tw:ring-1 tw:ring-border tw:transition-shadow tw:hover:ring-group-results/45"
      >
        {{ CONTACT_COPY.gmail }}
        <svg viewBox="0 0 24 24" class="tw:size-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M8 16 16 8M9 8h7v7" />
        </svg>
      </a>
    </div>
    <button
      type="button"
      :aria-label="CONTACT_COPY.close"
      class="tw:absolute tw:right-1 tw:top-1 tw:flex tw:size-10 tw:items-center tw:justify-center tw:rounded-full
             tw:text-text-muted tw:hover:bg-surface tw:hover:text-text"
      @click="fallback = null"
    >
      <svg viewBox="0 0 24 24" class="tw:size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  </div>
  </div>
</template>
