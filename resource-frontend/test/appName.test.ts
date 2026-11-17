import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { APP_TITLE } from '../src/navigation/head'

/**
 * The app is called Visual Whakamārama (the GitHub repository was renamed to
 * Visual-Whakamarama). The display name keeps the macron; identifiers are
 * ASCII. "Te Uma" is a separate name that stays.
 */
const FRONTEND = resolve(__dirname, '..')
const REPO = resolve(FRONTEND, '..')

const OLD_NAME = /Breast Educational Resource|Breast Education App|breast-educational-resource|BreastEducationalResource|ber-root/

function readJson(path: string): Record<string, any> {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

describe('app name', () => {
  it('shows as Visual Whakamārama', () => {
    expect(APP_TITLE).toBe('Visual Whakamārama')
  })

  it('is identified as visual-whakamarama to the portal, npm and the assay', () => {
    expect(readJson(join(REPO, 'config.portal.json')).name).toBe('visual-whakamarama')
    expect(readJson(join(FRONTEND, 'package.json')).name).toBe('visual-whakamarama')
    expect(readJson(join(FRONTEND, 'src/assets/tool_config.json')).assay_info.name).toBe('visual-whakamarama')
  })

  it('leaves no trace of the old name in what ships', () => {
    const files = [
      ...filesUnder(join(FRONTEND, 'src')),
      ...filesUnder(join(FRONTEND, 'tooling')),
      join(FRONTEND, 'index.html'),
      join(FRONTEND, 'vite.config.ts'),
      join(REPO, 'config.portal.json'),
      join(REPO, 'resource-backend/docker-compose.yml'),
    ]
    const stale = files.filter(f => OLD_NAME.test(readFileSync(f, 'utf8')))
    expect(stale).toEqual([])
  })
})
