import { describe, expect, it } from 'vitest'
import { TOUR_CHAPTERS, tourSteps } from '../src/content/tour'
import { enabledCases, getCase } from '../src/content/cases'

const LAYOUTS = ['wide', 'narrow'] as const

describe('tour script', () => {
  it('every step with a demo also carries fallback copy', () => {
    // Non-negotiable: on GitHub Pages a 20-30MB volume routinely misses the
    // demo window, and a step with no fallback would have nothing to say.
    for (const layout of LAYOUTS) {
      for (const step of tourSteps(layout)) {
        if (step.demo) expect(step.bodyFallback, `${layout}/${step.id}`).toBeTruthy()
      }
    }
  })

  it('every step with a demo declares which stage it needs', () => {
    for (const layout of LAYOUTS) {
      for (const step of tourSteps(layout)) {
        if (step.demo) expect(step.requiresStage, `${layout}/${step.id}`).toBeTruthy()
      }
    }
  })

  it('every route points at a case that actually ships', () => {
    const slugs = new Set(enabledCases().map(c => c.slug))
    for (const layout of LAYOUTS) {
      for (const step of tourSteps(layout)) {
        if (!step.route) continue
        const [, slug, modality] = step.route.split('/')
        expect(slugs.has(slug!), `${layout}/${step.id}: unknown slug ${slug}`).toBe(true)
        const ids = getCase(slug!)!.modalities.map(m => m.id)
        expect(ids, `${layout}/${step.id}`).toContain(modality)
      }
    }
  })

  it('step ids are unique within a layout', () => {
    for (const layout of LAYOUTS) {
      const ids = tourSteps(layout).map(s => s.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('both layouts cover all four chapters', () => {
    for (const layout of LAYOUTS) {
      const chapters = new Set(tourSteps(layout).map(s => s.chapter))
      expect([...chapters].sort()).toEqual(TOUR_CHAPTERS.map(c => c.id).sort())
    }
  })

  it('steps are grouped by chapter in chapter order, never interleaved', () => {
    const order = TOUR_CHAPTERS.map(c => c.id)
    for (const layout of LAYOUTS) {
      const seen = tourSteps(layout).map(s => order.indexOf(s.chapter))
      expect(seen).toEqual([...seen].sort((a, b) => a - b))
    }
  })

  it('the lesion chapter targets the lightest cancer case', () => {
    // cancer-ductal is 14.7MB; cancer-lobular is 72MB. Measured, not chosen.
    const routes = tourSteps('wide').filter(s => s.route).map(s => s.route)
    expect(routes).toContain('/cancer-ductal/mri')
  })

  it('the first chapter needs no stage at all, so it can start instantly', () => {
    for (const layout of LAYOUTS) {
      const first = tourSteps(layout).filter(s => s.chapter === 'layout')
      expect(first.every(s => !s.demo && !s.requiresStage)).toBe(true)
      expect(first.length).toBeGreaterThanOrEqual(2)
    }
  })

  // B1: `[data-tour="stage-controls"]` lives on every panel's bar. The
  // unscoped selector alone always resolves to the FIRST one in the DOM
  // (the anatomy panel), regardless of which panel is actually focused.
  it('the controls step is scoped to the focused panel before any unscoped fallback', () => {
    const step = tourSteps('wide').find(s => s.id === 'controls')!
    expect(step.target?.[0]).toBe('[data-panel][data-focused="true"] [data-tour="stage-controls"]')
    expect(step.target).toContain('[data-tour="stage-controls"]')
  })

  // B2: case-list opens the (below-xl) case-nav drawer. The step right after
  // it must close the drawer again, or the drawer -- and its scrim -- stays
  // over every later step. That step used to be case-heading; it is now the
  // panels step.
  it('the step after case-list closes the sidebar the case-list step opened', () => {
    for (const layout of LAYOUTS) {
      const steps = tourSteps(layout)
      const next = steps[steps.findIndex(s => s.id === 'case-list') + 1]!
      expect(next.prepare, `${layout}/${next.id}`).toContainEqual({ kind: 'closeSidebar' })
    }
  })
})

describe('the shortened tour (client feedback, November 2026)', () => {
  it('runs these steps, in this order', () => {
    const rest = ['rotate', 'slices', 'controls', 'locate', 'prev-next', 'finish']
    expect(tourSteps('wide').map(s => s.id)).toEqual(['welcome', 'case-list', 'panels-wide', ...rest])
    expect(tourSteps('narrow').map(s => s.id)).toEqual(['welcome', 'case-list', 'panels-narrow', ...rest])
  })

  it('names the slice and controls steps as the client asked', () => {
    const steps = tourSteps('wide')
    expect(steps.find(s => s.id === 'slices')!.title).toBe('Move through the slices')
    expect(steps.find(s => s.id === 'controls')!.title).toBe('Controls')
  })

  it('opens the lesion case and finds the lesion in one step', () => {
    const step = tourSteps('wide').find(s => s.id === 'locate')!
    expect(step.title).toBe('Find the lesion')
    expect(step.route).toBe('/cancer-ductal/mri')
    expect(step.target).toEqual(['[data-tour="locate-lesion"]', '[data-panel="mri"]'])
    expect(step.demo).toEqual({ kind: 'locateLesion', panel: 'mri' })
    expect(step.requiresStage).toBe('mri')
    expect(step.body).toContain('invasive ductal carcinoma')
    expect(step.bodyFallback).toContain('invasive ductal carcinoma')
  })

  // The tour lost four of its steps; a duration written for the old length
  // would be wrong, so the copy names none.
  it('promises no duration it was not timed for', () => {
    const welcome = tourSteps('wide').find(s => s.id === 'welcome')!
    expect(welcome.body).not.toMatch(/\d+[- ]second/)
    expect(welcome.body).toContain('A short tour')
  })
})
