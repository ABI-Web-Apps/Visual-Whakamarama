<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import FeedbackForm from '@/components/feedback/FeedbackForm.vue'
import KeepInTouchForm from '@/components/feedback/KeepInTouchForm.vue'
import { FEEDBACK_COPY } from '@/content/feedback'
import type { FeedbackDraft } from '@/feedback/types'
import { useFeedbackDialog } from '@/feedback/useFeedbackDialog'
import type { FeedbackDialogMode } from '@/feedback/useFeedbackDialog'
import { useAppRouter } from '@/navigation/router'
import { useTourStore } from '@/stores/tour'
import { useViewerStore } from '@/stores/viewer'

/**
 * The feedback button, on every page, and the dialog it opens. Mounted once,
 * in App.vue, outside the kept-alive pages.
 *
 * The button, by screen:
 * - desktop and tablet: a "Feedback" pill, bottom-right, in the tour HUD's
 *   dark glass with a teal-violet-rose edge (the app's three accents);
 * - phone: the same as a 52px round button. It slides away while the reader
 *   scrolls down (it would sit on the text being read) and comes back when
 *   they scroll up or stop -- the usual way to keep a floating button out of
 *   a small screen's way.
 * It steps aside for the app's own furniture: hidden while the guided tour
 * runs and behind the open menu drawer, raised above the tour's invitation
 * card and, on a desktop case page with the text column collapsed, above
 * the stage's control bars.
 *
 * The dialog: a bottom sheet on a phone (a handle to drag it down), a card
 * growing out of the button on anything wider. Escape, the scrim and Close
 * shut it; focus stays inside while it is open and goes back to the button.
 * The draft lives here, so closing half-way loses nothing; once sent it
 * thanks the reader and closes itself.
 */
const dialog = useFeedbackDialog()
const isOpen = dialog?.isOpen ?? ref(false)
const mode = dialog?.mode ?? ref<FeedbackDialogMode>('feedback')
const router = useAppRouter()
const tour = useTourStore()
const viewer = useViewerStore()

const draft = reactive<FeedbackDraft>({ rating: null, comment: '' })
/** Stay in touch's fields, kept here too so switching tabs loses nothing. */
const stay = reactive({ firstName: '', contact: '' })
const titleId = 'vw-feedback-title'
const TABS: { mode: FeedbackDialogMode, label: string }[] = [
  { mode: 'feedback', label: FEEDBACK_COPY.tabFeedback },
  { mode: 'stay', label: FEEDBACK_COPY.tabStay },
]
const tabId = (m: FeedbackDialogMode) => `vw-feedback-tab-${m}`
const launcher = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)

/** Pages built on DefaultLayout: the ones with a stage and its control bars. */
const STAGE_PAGES = new Set(['case', 'my-report', 'my-images', 'my-images-mri'])
const overStage = computed(() => !viewer.contentOpen && STAGE_PAGES.has(router.route.value.name))

let closeTimer: ReturnType<typeof setTimeout> | undefined
let sent = false

function open() {
  if (dialog) dialog.open('feedback')
  else {
    mode.value = 'feedback'
    isOpen.value = true
  }
}

function showTab(m: FeedbackDialogMode, focus = false) {
  mode.value = m
  if (focus) void nextTick(() => document.getElementById(tabId(m))?.focus())
}

function onTabKeydown(event: KeyboardEvent) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
  event.preventDefault()
  showTab(mode.value === 'feedback' ? 'stay' : 'feedback', true)
}

function close() {
  clearTimeout(closeTimer)
  if (dialog) dialog.close()
  else isOpen.value = false
}

/**
 * After a send the dialog closes itself in a few seconds -- unless the
 * reader is still using it (the thank-you offers Stay in touch).
 */
function onSent() {
  sent = true
  clearTimeout(closeTimer)
  closeTimer = setTimeout(close, 5000)
}

function holdOpen() {
  clearTimeout(closeTimer)
}

watch(isOpen, async (now) => {
  if (now) {
    await nextTick()
    // The chosen face, or the first: the question, not the keyboard-raising textarea.
    panel.value?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')?.focus()
    return
  }
  if (sent) {
    draft.rating = null
    draft.comment = ''
    stay.firstName = ''
    stay.contact = ''
    sent = false
  }
  dragY.value = 0
  await nextTick()
  launcher.value?.focus()
})

// A link inside the dialog (Contact the team) moves the page; the dialog goes with it.
watch(() => router.route.value.path, () => { if (isOpen.value) close() })

function focusables(): HTMLElement[] {
  return Array.from(panel.value?.querySelectorAll<HTMLElement>(
    'button:not([disabled]), textarea, a[href], [tabindex="0"]',
  ) ?? []).filter((el, i, all) => all.indexOf(el) === i && el.getAttribute('tabindex') !== '-1')
}

function onKeydown(event: KeyboardEvent) {
  holdOpen()
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab') return
  const list = focusables()
  if (list.length === 0) return
  const first = list[0]!
  const last = list[list.length - 1]!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  }
  else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

// ── Phone: drag the sheet down by its handle to close it ──────────────────
const dragY = ref(0)
let dragStart: number | null = null
function onDragStart(event: PointerEvent) {
  dragStart = event.clientY
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
}
function onDragMove(event: PointerEvent) {
  if (dragStart === null) return
  dragY.value = Math.max(0, event.clientY - dragStart)
}
function onDragEnd() {
  if (dragStart === null) return
  dragStart = null
  if (dragY.value > 80) close()
  else dragY.value = 0
}

// ── Phone: out of the way while reading down the page ────────────────────
const scrollHidden = ref(false)
const lastTop = new WeakMap<EventTarget, number>()
let idleTimer: ReturnType<typeof setTimeout> | undefined

function topOf(target: EventTarget): number {
  if (target instanceof Element) return target.scrollTop
  return document.scrollingElement?.scrollTop ?? 0
}

function onScroll(event: Event) {
  const target = event.target
  if (!target || (target instanceof Node && panel.value?.contains(target))) return
  const top = topOf(target)
  const before = lastTop.get(target) ?? top
  lastTop.set(target, top)
  if (top - before > 6) scrollHidden.value = true
  else if (before - top > 6) scrollHidden.value = false
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => { scrollHidden.value = false }, 700)
}

onMounted(() => document.addEventListener('scroll', onScroll, { capture: true, passive: true }))
onBeforeUnmount(() => {
  document.removeEventListener('scroll', onScroll, { capture: true })
  clearTimeout(idleTimer)
  clearTimeout(closeTimer)
})
</script>

<template>
  <!-- Stable root that makes no box, like TourLauncher's. -->
  <div class="tw:contents">
    <button
      v-if="!tour.active"
      ref="launcher"
      type="button"
      data-feedback-launcher
      :aria-label="FEEDBACK_COPY.launcher"
      aria-haspopup="dialog"
      :aria-expanded="isOpen ? 'true' : 'false'"
      :data-lifted="tour.launcherShown ? 'true' : 'false'"
      :data-over-stage="overStage ? 'true' : 'false'"
      class="vw-fb-launcher tw:fixed tw:right-4 tw:z-40 tw:flex tw:items-center tw:justify-center tw:gap-2 tw:rounded-full
             tw:text-white tw:transition-[transform,opacity,box-shadow,bottom] tw:duration-300
             tw:max-md:size-13 tw:md:right-6 tw:md:min-h-11 tw:md:px-4"
      :class="[
        viewer.sidebarOpen ? 'tw:max-xl:hidden' : '',
        scrollHidden ? 'tw:max-md:pointer-events-none tw:max-md:translate-y-24 tw:max-md:opacity-0' : '',
        isOpen ? 'tw:md:pointer-events-none tw:md:scale-90 tw:md:opacity-0' : '',
      ]"
      @click="open"
    >
      <svg viewBox="0 0 24 24" class="tw:size-5 tw:shrink-0 tw:md:size-[1.125rem]" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20 12.2c0 4.1-3.6 7.3-8 7.3-1.1 0-2.2-.2-3.2-.6L4 20l1.2-3.6C4.4 15.2 4 13.7 4 12.2 4 8.1 7.6 4.8 12 4.8s8 3.3 8 7.4z" />
        <path d="M8.6 12.3h.01M12 12.3h.01M15.4 12.3h.01" stroke-width="2.4" />
      </svg>
      <span class="tw:text-body-sm tw:font-bold tw:max-md:sr-only" aria-hidden="true">{{ FEEDBACK_COPY.launcher }}</span>
    </button>

    <Transition name="vw-fb-scrim">
      <div
        v-if="isOpen"
        data-feedback-scrim
        aria-hidden="true"
        class="tw:fixed tw:inset-0 tw:z-50 tw:bg-text/35 tw:backdrop-blur-[2px] tw:md:bg-text/20"
        @click="close"
      />
    </Transition>

    <Transition name="vw-fb-panel">
      <div
        v-if="isOpen"
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        class="vw-fb-panel tw:fixed tw:z-50 tw:flex tw:flex-col tw:overflow-hidden tw:bg-surface tw:shadow-lg
               tw:max-md:inset-x-0 tw:max-md:bottom-0 tw:max-md:rounded-t-[1.75rem]
               tw:md:bottom-6 tw:md:right-6 tw:md:w-[26rem] tw:md:rounded-card tw:md:ring-1 tw:md:ring-border"
        :style="dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined"
        @keydown="onKeydown"
        @pointerdown="holdOpen"
      >
        <div class="vw-fb-masthead tw:shrink-0" aria-hidden="true" />
        <!-- The phone's handle: drag it down to close. -->
        <div
          class="tw:flex tw:h-6 tw:shrink-0 tw:touch-none tw:items-center tw:justify-center tw:md:hidden"
          aria-hidden="true"
          @pointerdown="onDragStart"
          @pointermove="onDragMove"
          @pointerup="onDragEnd"
          @pointercancel="onDragEnd"
        >
          <span class="tw:h-1 tw:w-10 tw:rounded-full tw:bg-border-strong" />
        </div>
        <button
          type="button"
          :aria-label="FEEDBACK_COPY.close"
          class="tw:absolute tw:right-3 tw:top-4 tw:flex tw:size-11 tw:items-center tw:justify-center tw:rounded-full
                 tw:text-text-muted tw:transition-colors tw:hover:bg-surface-sunken tw:hover:text-text tw:md:top-3"
          @click="close"
        >
          <svg viewBox="0 0 24 24" class="tw:size-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <!-- Feedback | Stay in touch. Tabs: one tab stop, the arrow keys switch. -->
        <div class="tw:shrink-0 tw:px-5 tw:pr-16 tw:md:px-6 tw:md:pr-16 tw:md:pt-4">
          <div
            role="tablist"
            :aria-label="FEEDBACK_COPY.tabsLabel"
            class="tw:inline-flex tw:rounded-full tw:bg-surface-sunken tw:p-1"
          >
            <button
              v-for="t in TABS"
              :id="tabId(t.mode)"
              :key="t.mode"
              type="button"
              role="tab"
              :aria-selected="mode === t.mode ? 'true' : 'false'"
              aria-controls="vw-feedback-tabpanel"
              :tabindex="mode === t.mode ? 0 : -1"
              class="tw:min-h-9 tw:rounded-full tw:px-3.5 tw:text-body-sm tw:font-bold tw:transition-[background-color,color,box-shadow]"
              :class="mode === t.mode ? 'tw:bg-surface tw:text-text tw:shadow-sm' : 'tw:text-text-muted tw:hover:text-text'"
              @click="showTab(t.mode)"
              @keydown="onTabKeydown"
            >{{ t.label }}</button>
          </div>
        </div>
        <div
          id="vw-feedback-tabpanel"
          role="tabpanel"
          :aria-labelledby="tabId(mode)"
          class="vw-fb-body tw:min-h-0 tw:overflow-y-auto tw:overscroll-contain tw:px-5 tw:pt-5 tw:md:px-6"
        >
          <FeedbackForm
            v-if="mode === 'feedback'"
            v-model:rating="draft.rating"
            v-model:comment="draft.comment"
            :page="router.route.value.path"
            :title-id="titleId"
            @sent="onSent"
            @stay="showTab('stay')"
          />
          <KeepInTouchForm
            v-else
            v-model:first-name="stay.firstName"
            v-model:contact="stay.contact"
            :title-id="titleId"
            @done="onSent"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ── The button ──────────────────────────────────────────────────────────
   Dark glass (TourLauncher's family) inside a thin ring of the app's three
   accents: teal, the results violet, the brand rose. */
.vw-fb-launcher {
  bottom: calc(1rem + env(safe-area-inset-bottom));
  border: 1.5px solid transparent;
  background:
    linear-gradient(rgb(20 18 26 / .94), rgb(20 18 26 / .94)) padding-box,
    linear-gradient(125deg, #22A2A8, #5B3F99 55%, #D94F70) border-box;
  -webkit-backdrop-filter: blur(14px) saturate(1.15);
  backdrop-filter: blur(14px) saturate(1.15);
  box-shadow: 0 10px 28px -8px rgb(23 26 35 / .55), inset 0 1px 0 rgb(255 255 255 / .08);
  animation: vw-fb-arrive .5s .6s cubic-bezier(.2, .8, .2, 1) both;
}
.vw-fb-launcher:hover,
.vw-fb-launcher:focus-visible {
  transform: translateY(-2px);
  box-shadow: 0 14px 34px -8px rgb(91 63 153 / .6), inset 0 1px 0 rgb(255 255 255 / .1);
}
.vw-fb-launcher[data-lifted="true"] { bottom: calc(8.5rem + env(safe-area-inset-bottom)); }
@media (min-width: 768px) {
  /* Above the tablet's bottom-sheet peek, as TourLauncher is. */
  .vw-fb-launcher { bottom: 6rem; }
  .vw-fb-launcher[data-lifted="true"] { bottom: 13rem; }
}
@media (min-width: 1280px) {
  .vw-fb-launcher { bottom: 1.5rem; }
  .vw-fb-launcher[data-lifted="true"] { bottom: 9rem; }
  /* The text column is collapsed: the stage's control bars reach the corner. */
  .vw-fb-launcher[data-over-stage="true"] { bottom: 5.5rem; }
}
@keyframes vw-fb-arrive {
  from { opacity: 0; transform: translateY(12px) scale(.96); }
  to { opacity: 1; transform: none; }
}

/* ── The dialog ──────────────────────────────────────────────────────── */
.vw-fb-panel {
  max-height: 92dvh;
  padding-bottom: env(safe-area-inset-bottom);
  transition: transform .32s cubic-bezier(.2, .8, .2, 1), opacity .2s ease;
}
.vw-fb-body { padding-bottom: 1.5rem; }
@media (min-width: 768px) {
  .vw-fb-panel { max-height: calc(100dvh - 3rem); transform-origin: bottom right; }
}
/* The patient summary's masthead line, as on Contact us. */
.vw-fb-masthead {
  height: 3px;
  background: linear-gradient(90deg, #22A2A8 0%, #3D6FB0 52%, #5B3F99 100%);
}

.vw-fb-scrim-enter-active,
.vw-fb-scrim-leave-active { transition: opacity .2s ease; }
.vw-fb-scrim-enter-from,
.vw-fb-scrim-leave-to { opacity: 0; }

.vw-fb-panel-enter-from,
.vw-fb-panel-leave-to { transform: translateY(100%); }
@media (min-width: 768px) {
  .vw-fb-panel-enter-from,
  .vw-fb-panel-leave-to { transform: translateY(10px) scale(.94); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .vw-fb-launcher { animation: none; transition: opacity .15s ease; }
  .vw-fb-launcher:hover,
  .vw-fb-launcher:focus-visible { transform: none; }
  .vw-fb-panel { transition: opacity .15s ease; }
  .vw-fb-panel-enter-from,
  .vw-fb-panel-leave-to { transform: none; opacity: 0; }
}
</style>
