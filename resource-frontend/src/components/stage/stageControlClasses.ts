/**
 * The control bar's button and tooltip, shared by everything that sits in a
 * panel's bar: StageControls' own buttons, the MRI viewer's view switch and
 * the report's download. One definition, so every panel's bar looks and
 * behaves the same.
 */

/** `min-h-11` is §11's 44px touch-target floor; `hover:bg-current/10` tints
 * from the bar's own foreground colour. `group` and `relative` are what the
 * tooltip hangs off. */
export const STAGE_BUTTON_CLASS = 'tw:group tw:relative tw:flex tw:min-h-11 tw:items-center tw:gap-1.5 tw:rounded-ctl tw:px-3 tw:text-body-sm '
  + 'tw:hover:bg-current/10 tw:disabled:opacity-50 tw:disabled:hover:bg-transparent'

/**
 * The tooltip shown for an icon-only button.
 *
 * Compact mode hides the labels, and the browser's own `title` bubble is
 * not an answer: it is unstyled, appears after a delay the app does not
 * control, and looks nothing like the rest of the interface.
 *
 * CSS only -- no timers, no positioning library. It sits above the button
 * because the bar is at the foot of a panel, and it is `pointer-events-none`
 * so it can never eat the click it is describing. `group-focus-visible`
 * matters as much as `group-hover`: a keyboard reader gets the same hint, and
 * it is the same accessible name the button already carries via `aria-label`.
 */
const TIP_BASE = 'tw:pointer-events-none tw:absolute tw:bottom-full tw:z-10 tw:mb-2 '
  + 'tw:whitespace-nowrap tw:rounded-ctl tw:bg-text tw:px-2 tw:py-1 tw:text-caption tw:font-medium tw:text-surface '
  + 'tw:opacity-0 tw:shadow-md tw:transition-opacity tw:duration-100 '
  + 'tw:group-hover:opacity-100 tw:group-focus-visible:opacity-100'

export const STAGE_TIP_CLASS = `${TIP_BASE} tw:left-1/2 tw:-translate-x-1/2`

/** The same tooltip, held to its anchor's right edge: for the readout at the
 * end of the bar, where a centred one would run off the panel. */
export const STAGE_TIP_END_CLASS = `${TIP_BASE} tw:right-0`
