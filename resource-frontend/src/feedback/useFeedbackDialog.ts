import { inject, provide, ref } from 'vue'
import type { InjectionKey, Ref } from 'vue'

/**
 * Whether the feedback dialog is open, shared by the widget that draws it
 * (FeedbackWidget, mounted once in App.vue) and anything else that offers
 * it (About, Contact us). Provided, not module state: the plugin bundle
 * re-runs on every mount.
 */
export type FeedbackDialogMode = 'feedback' | 'stay'

export interface FeedbackDialog {
  isOpen: Ref<boolean>
  /** Which half is showing: the feedback form, or Stay in touch. */
  mode: Ref<FeedbackDialogMode>
  open: (mode?: FeedbackDialogMode) => void
  close: () => void
}

export const FEEDBACK_DIALOG_KEY: InjectionKey<FeedbackDialog> = Symbol('vw-feedback-dialog')

export function provideFeedbackDialog(): FeedbackDialog {
  const isOpen = ref(false)
  const mode = ref<FeedbackDialogMode>('feedback')
  const dialog: FeedbackDialog = {
    isOpen,
    mode,
    open: (to = 'feedback') => {
      mode.value = to
      isOpen.value = true
    },
    close: () => { isOpen.value = false },
  }
  provide(FEEDBACK_DIALOG_KEY, dialog)
  return dialog
}

/** The app's feedback dialog, or null where none is provided (a page mounted on its own). */
export function useFeedbackDialog(): FeedbackDialog | null {
  return inject(FEEDBACK_DIALOG_KEY, null)
}
