import { flushPromises } from '@vue/test-utils'
import { afterEach, vi } from 'vitest'

/**
 * What the patient pages' tests share: a fetch that answers like the backend
 * (the tool-config stream, then the findings), stubs for the layout and the
 * viewer, and unmounting after each test so no request outlives it.
 */

const enc = new TextEncoder()

export const completeStream = () => new Response(new ReadableStream<Uint8Array>({
  start(c) {
    c.enqueue(enc.encode(['event: complete', 'data: {"assay":"a-1","cases":["sub-1"]}', '', ''].join('\n')))
    c.close()
  },
}), { status: 200 })

export const jsonRes = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })

export const noFindings = () => jsonRes(404, { detail: { code: 'no_findings', summary: 'none' } })

export const sessionError = () => jsonRes(400, { detail: { step: 'minio', summary: 'Dataset missing', detail: 'x' } })

/** Route fetch by URL: tool-config streams, findings answers with `findings`. */
export function stubBackend(findings: () => Response, toolConfig: () => Response = completeStream) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) =>
    url.includes('tool-config') ? toolConfig() : findings()))
}

export const DefaultLayoutStub = {
  props: ['stageLabel', 'squareStage'],
  template: `
    <div>
      <div class="heading-slot"><slot name="heading" /></div>
      <div class="stage-slot"><slot name="stage" /></div>
      <div class="content-slot"><slot name="content" /></div>
    </div>
  `,
}

/** The viewer's own scene is covered by useMyMriScene.test.ts; here it only reports. */
export const MyMriViewerStub = {
  name: 'MyMriViewer',
  props: ['mri', 'mask', 'findings', 'initialView'],
  emits: ['retry'],
  template: '<div data-slot="my-mri-viewer" />',
}

const mounted: { unmount: () => void }[] = []

export const track = <T extends { unmount: () => void }>(w: T): T => { mounted.push(w); return w }

afterEach(async () => {
  // Unmount first so any in-flight request is aborted, then let it settle.
  mounted.splice(0).forEach(w => w.unmount())
  await flushPromises()
  vi.unstubAllGlobals()
})
