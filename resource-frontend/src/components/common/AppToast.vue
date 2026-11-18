<script setup lang="ts">
import { useToast } from '@/composables/useToast'

/**
 * The app's one toast (see useToast). The live region is always in the page,
 * empty while there is nothing to say: a region added together with its text
 * is often not announced at all.
 *
 * Bottom centre, above the feedback button's row on a phone (that button sits
 * bottom-right, 48px tall, 16px up), so the two never overlap.
 */
const { message } = useToast()
</script>

<template>
  <div
    role="status"
    aria-live="polite"
    class="vw-toast-slot tw:pointer-events-none tw:fixed tw:inset-x-0 tw:z-[60] tw:flex tw:justify-center tw:px-4"
  >
    <Transition name="vw-toast">
      <p
        v-if="message"
        class="vw-toast tw:flex tw:max-w-md tw:items-center tw:gap-2.5 tw:rounded-full tw:px-4 tw:py-2.5
               tw:text-body-sm tw:font-medium tw:text-white"
      >
        <svg viewBox="0 0 20 20" class="tw:size-4 tw:shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m5 10.5 3 3 7-7" />
        </svg>
        {{ message }}
      </p>
    </Transition>
  </div>
</template>

<style scoped>
.vw-toast-slot {
  bottom: calc(5.5rem + env(safe-area-inset-bottom));
}
@media (min-width: 768px) {
  .vw-toast-slot { bottom: 1.75rem; }
}
/* The tour HUD's dark glass family: the toast floats over anything. */
.vw-toast {
  background: rgb(20 18 26 / .94);
  -webkit-backdrop-filter: blur(14px) saturate(1.15);
  backdrop-filter: blur(14px) saturate(1.15);
  box-shadow: 0 12px 32px rgb(0 0 0 / .28), inset 0 1px 0 rgb(255 255 255 / .08);
}
.vw-toast-enter-active,
.vw-toast-leave-active {
  transition: opacity .18s ease, transform .18s ease;
}
.vw-toast-enter-from,
.vw-toast-leave-to {
  opacity: 0;
  transform: translateY(.5rem);
}
@media (prefers-reduced-motion: reduce) {
  .vw-toast-enter-from,
  .vw-toast-leave-to { transform: none; }
}
</style>
