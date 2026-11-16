import type { TourChapter, TourLayoutScope, TourStep } from './tourTypes'

export const TOUR_CHAPTERS: TourChapter[] = [
  { id: 'layout', label: 'The layout' },
  { id: 'reading', label: 'Reading a case' },
  { id: 'interacting', label: 'Interacting' },
  { id: 'lesion', label: 'Finding a lesion' },
]

/**
 * The tour, in chapter order.
 *
 * Chapter order follows ASSET WEIGHT, not narrative convenience. Chapter 1
 * needs no 3D at all, so the tour can start the instant it is asked for and
 * the ~25 seconds a reader spends on it is free download time. Chapter 2
 * needs only the anatomy GLB (0.59-1.0MB, Draco). The 20-30MB volumes are
 * held back to the end of chapter 3 and chapter 4.
 */
const STEPS: TourStep[] = [
  // ── Chapter 1: the layout (no 3D) ──────────────────────────────────────
  {
    id: 'welcome',
    chapter: 'layout',
    placement: 'center',
    title: 'Welcome to Te Uma',
    body: 'A 90-second tour of how this resource works. You can leave at any time — press Escape.',
  },
  {
    id: 'case-list',
    chapter: 'layout',
    target: ['#case-sidebar'],
    prepare: [{ kind: 'openSidebar' }],
    placement: 'right',
    title: 'Every case lives here',
    body: 'Cases are grouped by what they show: a normal breast, the four breast density grades, benign findings, and cancers.',
  },

  // ── Chapter 2: reading a case (anatomy GLB only) ───────────────────────
  // Below xl the case-list step opened the case-nav drawer (a fixed,
  // scrim-covered overlay there); it must close again once the tour moves
  // past it, or every later step's halo is drawn under a dimmed drawer.
  {
    id: 'panels-wide',
    chapter: 'reading',
    layout: 'wide',
    target: ['[data-tour="panels"]'],
    prepare: [{ kind: 'closeSidebar' }],
    placement: 'bottom',
    title: 'Three views of one breast',
    body: 'Anatomy, mammogram and MRI sit side by side, so you can read across them.',
  },
  {
    id: 'panels-narrow',
    chapter: 'reading',
    layout: 'narrow',
    target: ['[data-tour="panel-tabs"]'],
    prepare: [{ kind: 'closeSidebar' }],
    placement: 'bottom',
    title: 'Three views of one breast',
    body: 'Anatomy, mammogram and MRI. Tap a tab to switch between them.',
  },

  // ── Chapter 3: interacting ─────────────────────────────────────────────
  {
    id: 'rotate',
    chapter: 'interacting',
    target: ['[data-panel="anatomy"]'],
    prepare: [{ kind: 'focusPanel', panel: 'anatomy' }],
    demo: { kind: 'orbit', panel: 'anatomy', degrees: 120, durationMs: 2500 },
    requiresStage: 'anatomy',
    placement: 'right',
    title: 'Rotate the model',
    body: 'The anatomy model is turning now. Take over whenever you like — drag it, or use the arrow keys.',
    bodyFallback: 'Drag the anatomy model to rotate it, or use the arrow keys.',
  },
  {
    id: 'slices',
    chapter: 'interacting',
    target: ['[data-panel="mri"]'],
    prepare: [{ kind: 'focusPanel', panel: 'mri' }],
    demo: { kind: 'scrubSlices', panel: 'mri', durationMs: 2200 },
    requiresStage: 'mri',
    placement: 'left',
    title: 'Move through the slices',
    body: 'An MRI is a stack of slices. This one is stepping through them.',
    bodyFallback: 'Drag up and down on the MRI to move through its slices, or use the [ and ] keys.',
  },
  {
    id: 'controls',
    chapter: 'interacting',
    // `[data-tour="stage-controls"]` lives on EVERY panel's bar (three-up
    // renders three). Scoped to the focused panel first, so the halo rings
    // the bar the copy is actually describing; the unscoped selector stays
    // as a fallback for the rare case no panel is marked focused yet.
    target: ['[data-panel][data-focused="true"] [data-tour="stage-controls"]', '[data-tour="stage-controls"]'],
    placement: 'top',
    title: 'Controls',
    body: 'Reset the view, go fullscreen, and — where a case has one — jump straight to the lesion.',
  },

  // ── Chapter 4: finding a lesion ────────────────────────────────────────
  {
    id: 'locate',
    chapter: 'lesion',
    route: '/cancer-ductal/mri',
    // Locate lesion only renders once the volume has loaded (StageControls'
    // hasLesion). Until then the halo rings the MRI panel the volume is
    // loading into.
    target: ['[data-tour="locate-lesion"]', '[data-panel="mri"]'],
    demo: { kind: 'locateLesion', panel: 'mri' },
    requiresStage: 'mri',
    placement: 'top',
    title: 'Find the lesion',
    body: 'This is an invasive ductal carcinoma. Locate lesion jumps to the slice the lesion sits on.',
    // The fallback must not send the reader after a control that is not on
    // screen yet.
    bodyFallback: 'This is an invasive ductal carcinoma. Once its MRI has finished loading, Locate lesion jumps to the slice the lesion sits on.',
  },
  {
    id: 'prev-next',
    chapter: 'lesion',
    target: ['[data-tour="prev-next"]'],
    placement: 'left',
    title: 'Keep going',
    body: 'Next steps to the following view, then on to the next case. Pressing Next is enough to walk the whole resource.',
  },
  {
    id: 'finish',
    chapter: 'lesion',
    placement: 'center',
    title: "That's the tour",
    body: 'Reopen it any time from Guided tour, at the top right.',
  },
]

/** The steps that apply to a given layout, in order. */
export function tourSteps(layout: TourLayoutScope): TourStep[] {
  return STEPS.filter(s => !s.layout || s.layout === 'both' || s.layout === layout)
}
