import { inject, onScopeDispose, provide, readonly, ref } from 'vue'
import type { InjectionKey, Ref } from 'vue'

/**
 * One short message at the foot of the screen ("Email address copied.").
 *
 * Provided once by App.vue and drawn by AppToast there, so every page shares
 * one. Not module state: the plugin bundle re-runs on every mount, and a
 * provided instance goes away with the app that made it.
 */
export interface ToastApi {
  message: Readonly<Ref<string | null>>
  /** Shows `text` for `ms` (4 s by default), replacing whatever was showing. */
  show: (text: string, ms?: number) => void
}

export const TOAST_KEY: InjectionKey<ToastApi> = Symbol('vw-toast')

const DEFAULT_MS = 4000

export function provideToast(): ToastApi {
  const message = ref<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined

  function show(text: string, ms = DEFAULT_MS) {
    clearTimeout(timer)
    message.value = text
    timer = setTimeout(() => { message.value = null }, ms)
  }

  onScopeDispose(() => clearTimeout(timer))
  const api: ToastApi = { message: readonly(message), show }
  provide(TOAST_KEY, api)
  return api
}

/** The app's toast; a silent stand-in where none is provided (a component mounted on its own). */
export function useToast(): ToastApi {
  return inject(TOAST_KEY, null) ?? { message: readonly(ref(null)), show: () => {} }
}
