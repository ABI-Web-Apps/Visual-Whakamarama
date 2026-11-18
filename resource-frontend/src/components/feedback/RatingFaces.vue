<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { RATINGS } from '@/feedback/types'
import type { Rating } from '@/feedback/types'

/**
 * Five faces, very hard to very easy, as one radio group.
 *
 * Drawn, not emoji: an emoji is a different picture on every platform (and
 * a missing one on some), and these have to read the same in a clinic's
 * Windows browser and on a patient's phone. Each sits muted until it is
 * pointed at or chosen; then it takes its own ink and fill (RATINGS), so the
 * row reads from burgundy to green without any face shouting first.
 *
 * Keyboard: one tab stop (the chosen face, or the first); the arrow keys
 * move the choice, as a radio group's do.
 */
const model = defineModel<Rating | null>({ default: null })
defineProps<{ label: string }>()

const buttons = ref<HTMLElement[]>([])

/** Mouth, brows and eyes per face, on a 32×32 grid around a head at (16,16) r 13. */
const FACES: Record<Rating, { mouth: string, extra?: string[], eyes: 'dots' | 'smile', fillMouth?: boolean }> = {
  1: { mouth: 'M10.5 22.5c1.5-2.4 3.4-3.5 5.5-3.5s4 1.1 5.5 3.5', extra: ['M9.6 10.6l3.2 1.6', 'M22.4 10.6l-3.2 1.6'], eyes: 'dots' },
  2: { mouth: 'M11.5 21.5c1.3-1.4 2.8-2 4.5-2s3.2.6 4.5 2', eyes: 'dots' },
  3: { mouth: 'M11.5 20.5h9', eyes: 'dots' },
  4: { mouth: 'M11 19c1.3 1.8 3 2.7 5 2.7s3.7-.9 5-2.7', eyes: 'dots' },
  5: { mouth: 'M10 18.2h12c0 3.6-2.7 6.2-6 6.2s-6-2.6-6-6.2z', eyes: 'smile', fillMouth: true },
}

function tabIndexOf(value: Rating): 0 | -1 {
  return (model.value ?? 1) === value ? 0 : -1
}

async function choose(value: Rating, focus = false) {
  model.value = value
  if (!focus) return
  await nextTick()
  buttons.value[value - 1]?.focus()
}

function onKeydown(event: KeyboardEvent, value: Rating) {
  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
    : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1
      : 0
  if (!step) return
  event.preventDefault()
  const next = (((value - 1 + step) % 5) + 5) % 5 + 1
  void choose(next as Rating, true)
}
</script>

<template>
  <div role="radiogroup" :aria-label="label" class="tw:grid tw:grid-cols-5 tw:gap-1.5 tw:sm:gap-2">
    <button
      v-for="r in RATINGS"
      :key="r.value"
      ref="buttons"
      type="button"
      role="radio"
      :aria-checked="model === r.value ? 'true' : 'false'"
      :aria-label="r.label"
      :tabindex="tabIndexOf(r.value)"
      class="vw-face tw:group tw:flex tw:min-h-[4.5rem] tw:flex-col tw:items-center tw:justify-center tw:gap-1 tw:rounded-ctl
             tw:border tw:px-1 tw:py-2 tw:transition-[background-color,border-color,transform] tw:duration-150
             tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2"
      :class="model === r.value
        ? 'tw:border-transparent'
        : 'tw:border-border tw:bg-surface tw:hover:bg-surface-sunken'"
      :style="{
        '--vw-face-ink': r.ink,
        '--vw-face-fill': r.fill,
        ...(model === r.value ? { background: r.fill, boxShadow: `inset 0 0 0 2px ${r.ink}` } : {}),
        outlineColor: r.ink,
      }"
      @click="choose(r.value)"
      @keydown="onKeydown($event, r.value)"
    >
      <svg
        viewBox="0 0 32 32"
        class="vw-face-icon tw:size-8 tw:transition-transform tw:duration-200"
        :class="model === r.value ? 'vw-face-on' : ''"
        fill="none"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="16" cy="16" r="13" class="vw-face-head" />
        <template v-if="FACES[r.value].eyes === 'dots'">
          <circle cx="12" cy="14" r="1.35" class="vw-face-dot" />
          <circle cx="20" cy="14" r="1.35" class="vw-face-dot" />
        </template>
        <template v-else>
          <path d="M10.3 14.2c.9-1.3 2.5-1.3 3.4 0" class="vw-face-line" />
          <path d="M18.3 14.2c.9-1.3 2.5-1.3 3.4 0" class="vw-face-line" />
        </template>
        <path v-for="d in FACES[r.value].extra ?? []" :key="d" :d="d" class="vw-face-line" />
        <path :d="FACES[r.value].mouth" class="vw-face-line" :class="FACES[r.value].fillMouth ? 'vw-face-mouth-fill' : ''" />
      </svg>
      <span
        class="tw:text-[0.6875rem] tw:leading-tight tw:sm:text-caption"
        :class="model === r.value ? 'tw:font-bold' : 'tw:font-medium tw:text-text-muted'"
        :style="model === r.value ? { color: r.ink } : {}"
      >{{ r.label }}</span>
    </button>
  </div>
</template>

<style scoped>
/* Muted until pointed at or chosen: the face's own ink comes in then. */
.vw-face-head { stroke: #A2A9B4; fill: #FFFFFF; }
.vw-face-line { stroke: #79828F; }
.vw-face-dot { fill: #79828F; }
.vw-face-mouth-fill { fill: #FFFFFF; }

.vw-face:hover .vw-face-head,
.vw-face:focus-visible .vw-face-head,
.vw-face-on .vw-face-head { stroke: var(--vw-face-ink); fill: var(--vw-face-fill); }
.vw-face:hover .vw-face-line,
.vw-face:focus-visible .vw-face-line,
.vw-face-on .vw-face-line { stroke: var(--vw-face-ink); }
.vw-face:hover .vw-face-dot,
.vw-face:focus-visible .vw-face-dot,
.vw-face-on .vw-face-dot { fill: var(--vw-face-ink); }
.vw-face-on .vw-face-head { fill: #FFFFFF; }
.vw-face-on .vw-face-mouth-fill { fill: var(--vw-face-ink); }

.vw-face:hover .vw-face-icon { transform: translateY(-1px); }
.vw-face-on { animation: vw-face-pop .32s cubic-bezier(.3, 1.5, .5, 1) both; }
@keyframes vw-face-pop {
  0% { transform: scale(.86); }
  100% { transform: scale(1.08); }
}
.vw-face-icon.vw-face-on { transform: scale(1.08); }
@media (prefers-reduced-motion: reduce) {
  .vw-face-on { animation: none; }
  .vw-face:hover .vw-face-icon { transform: none; }
}
</style>
