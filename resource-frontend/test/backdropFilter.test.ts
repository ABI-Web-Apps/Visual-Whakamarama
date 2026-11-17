import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transform } from 'lightningcss'
import { describe, expect, it } from 'vitest'

/**
 * The production CSS kept no `backdrop-filter` that Chromium reads.
 *
 * Every glass rule wrote the standard property and then the `-webkit-` one.
 * The build's minifier (lightningcss) treats the two as one property and keeps
 * the last, so the built CSS had only `-webkit-backdrop-filter`, which Chromium
 * ignores. No blur anywhere -- and the sidebar, no longer a containing block,
 * let its screen-reader-only text escape its scroll clip and stretch the page,
 * which then scrolled to a white strip under the app. `yarn dev` does not
 * minify, so it never showed there.
 *
 * Each rule that sets the property goes through the minifier here, with no
 * browser targets and with the build's baseline ones; the standard property
 * has to come out of both.
 */
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src')

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sources(path)
    return /\.(css|vue)$/.test(entry.name) ? [path] : []
  })
}

/** The `backdrop-filter` declarations of every innermost rule block, in source order. */
function backdropRules(): { file: string, declarations: string[] }[] {
  return sources(SRC).flatMap((file) => {
    const css = readFileSync(file, 'utf8')
    return [...css.matchAll(/\{([^{}]*)\}/g)]
      .map(([, body]) => body!.split(';').map(d => d.trim()).filter(d => /^(-webkit-)?backdrop-filter\s*:/.test(d)))
      .filter(declarations => declarations.length > 0)
      .map(declarations => ({ file: file.slice(SRC.length + 1), declarations }))
  })
}

const BASELINE = { chrome: 107 << 16, edge: 107 << 16, firefox: 104 << 16, safari: 16 << 16 }

function minify(declarations: string[], targets?: typeof BASELINE): string {
  const code = new TextEncoder().encode(`.a{${declarations.join(';')}}`)
  return new TextDecoder().decode(transform({ filename: 'rule.css', code, minify: true, targets }).code)
}

describe('backdrop-filter survives the production minifier', () => {
  const rules = backdropRules()

  it('finds the glass rules', () => {
    // tokens.css's three panes and the tour's three dark panels.
    expect(rules.length).toBeGreaterThanOrEqual(6)
  })

  it.each(rules.map(r => [r.file, r.declarations] as const))('%s keeps the standard property', (_file, declarations) => {
    for (const targets of [undefined, BASELINE]) {
      expect(minify(declarations, targets)).toMatch(/[{;]backdrop-filter:/)
    }
  })
})
