import { assetBase, publicBase } from '@/runtime/env'
import { assetUrl, publicUrl } from './assetUrl'

export function useAssetUrl() {
  const base = assetBase()
  const appBase = publicBase()
  return {
    /** Imaging assets (NRRD volumes, GLB models, view presets). */
    url: (path: string) => assetUrl(path, base),
    /** Anything else in `public/` -- team portraits, partner logos. See
     * `publicUrl` on why these must not go through the imaging base. */
    publicUrl: (path: string) => publicUrl(path, appBase),
  }
}
