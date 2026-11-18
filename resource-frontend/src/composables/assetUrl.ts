/**
 * Joins an asset URL (design doc §9.2). `base` comes from `assetBase()`
 * (runtime/env.ts): the backend's "<api base>/modelView/".
 */
export function assetUrl(path: string, base: string): string {
  if (!path) throw new Error('assetUrl received an empty path')
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

/**
 * `url` resolved against `base` -- at a call site, `document.baseURI`, which
 * is what a `fetch` on the page itself would have resolved it against.
 *
 * Required for every URL handed to copper3d's `loadNrrd` -- which is why
 * `loadNrrdVolume` is the only caller of it. Since 4.1 `loadNrrd`
 * fetches the volume inside a Web Worker started from a `blob:` URL, and a
 * worker resolves `fetch` against its own URL: nothing relative can be parsed
 * against `blob:`, so the worker throws "Failed to parse URL" before any
 * request goes out. The standalone and plugin builds' API base is
 * root-relative (`/api`, `/plugin/<expose>/api`), so every volume failed
 * there, while `yarn dev`'s absolute `http://localhost:8082/api` hid it.
 */
export function absoluteUrl(url: string, base: string): string {
  return new URL(url, base).href
}

/**
 * A file served straight out of `public/`, base-path aware.
 *
 * Distinct from `assetUrl` because `assetBase` is specifically the IMAGING
 * base, the backend's catalogue. Team portraits and partner logos are not
 * imaging: they are small, they always ship with the app, and routing them
 * through `assetBase` would ask the backend for `/modelView/team/...` and 404.
 *
 * `appBaseURL` is the app's own base: `/` standalone, the bundle's folder
 * as a plugin.
 */
export function publicUrl(path: string, appBaseURL: string): string {
  if (!path) throw new Error('publicUrl received an empty path')
  const prefix = appBaseURL.replace(/\/+$/, '')
  return `${prefix}/${path.replace(/^\/+/, '')}`
}
