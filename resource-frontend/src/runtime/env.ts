/**
 * Where things live, for each of the three ways this app runs.
 *
 *                  public files (logos,     imaging (NRRD, GLB,      API
 *                  portraits, draco)        view presets)
 *   vite dev       BASE_URL                 backend /api/modelView   VITE_PLUGIN_API_URL:PORT
 *   standalone     BASE_URL                 backend /api/modelView   <base>/api
 *   plugin         the UMD script's folder  backend /api/modelView   <route prefix>/api
 *
 * Every deployment has the backend: the imaging catalogue and the patient
 * pages are always served by it.
 */

/**
 * The plugin bundle's own folder, read while the bundle is being evaluated.
 *
 * `document.currentScript` is only set during that synchronous evaluation,
 * so it has to be captured at module scope -- it is a read, not a side
 * effect. The portal serves the bundle from the same folder as the build's
 * `public/` files (`/tools/<expose>/primary/`), which is why it is the
 * public base in plugin mode.
 */
const pluginScriptSrc: string = __IS_PLUGIN__ && typeof document !== 'undefined'
  ? (document.currentScript as HTMLScriptElement | null)?.src ?? ''
  : ''

function trimSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

export function getApiBaseUrl(): string {
  if (__IS_PLUGIN__) return `${import.meta.env.VITE_PLUGIN_ROUTE_PREFIX ?? ''}/api`
  if (import.meta.env.PROD) return `${trimSlash(import.meta.env.BASE_URL)}/api`
  const url = import.meta.env.VITE_PLUGIN_API_URL || 'http://localhost'
  const port = import.meta.env.VITE_PLUGIN_API_PORT || '8082'
  return `${url}:${port}/api`
}

/** The base `public/` files are served from, always ending in `/`. */
export function publicBase(): string {
  if (__IS_PLUGIN__) {
    if (pluginScriptSrc) return pluginScriptSrc.split(/[?#]/)[0]!.replace(/[^/]*$/, '')
    const expose = (import.meta.env.VITE_PLUGIN_ROUTE_PREFIX ?? '').split('/').filter(Boolean).pop()
    return expose ? `/tools/${expose}/primary/` : '/'
  }
  return import.meta.env.BASE_URL
}

/** The base imaging assets are joined onto: the backend's catalogue. */
export function assetBase(): string {
  return `${getApiBaseUrl()}/modelView/`
}
