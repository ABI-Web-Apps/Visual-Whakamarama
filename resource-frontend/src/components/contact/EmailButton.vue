<script setup lang="ts">
import { CONTACT_COPY, mailtoHref } from '@/content/contact'
import { useToast } from '@/composables/useToast'
import { copyText } from '@/utils/clipboard'

/**
 * One person's email address, as the thing to press.
 *
 * The address is a real `mailto:` link, so the device's own mail app opens
 * with the address (and a subject) filled in. A web page cannot tell whether
 * a mail app is set up -- with none, the click quietly does nothing -- so the
 * same click also copies the address and says so. The Copy button beside it
 * copies without opening anything, for someone who writes from webmail.
 */
const props = defineProps<{ email: string, name: string }>()
const toast = useToast()

/** Split at the @, so a narrow phone wraps the address there and nowhere else. */
const at = props.email.indexOf('@')
const local = at > 0 ? props.email.slice(0, at) : props.email
const domain = at > 0 ? props.email.slice(at) : ''

async function onOpen() {
  // No preventDefault: the browser follows the mailto link as it normally would.
  const copied = await copyText(props.email)
  toast.show(copied ? CONTACT_COPY.opening : CONTACT_COPY.openingNoCopy(props.email))
}

async function onCopy() {
  const copied = await copyText(props.email)
  toast.show(copied ? CONTACT_COPY.copied : CONTACT_COPY.copyFailed(props.email))
}
</script>

<template>
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
</template>
