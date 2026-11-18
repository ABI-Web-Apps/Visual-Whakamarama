import { NEUTRAL_COLOR, findingColour } from '@/myMri/findingColour'

/** Names for the finding colours the report and viewer use. */
const COLOUR_NAMES: Record<string, string> = {
  '#ff7043': 'orange',
  '#42a5f5': 'blue',
  [NEUTRAL_COLOR]: 'grey',
}

const FALLBACK_COLOUR = 'this colour'

export interface FindingColour { label: string, color: string | null }

/**
 * The findings record calls each marked area "Finding N"; the patient's
 * summary PDF calls it "Area N". Shown as the summary names it, so the colour
 * key, the page and the report agree. Any other label is left as it is.
 */
export function areaLabel(label: string): string {
  return label.replace(/^Finding(?=\s|$)/, 'Area')
}

/**
 * "orange is Area 1, blue is Area 2", built from the findings' own
 * colours. Each is named as it is drawn, so a finding with no usable colour
 * is the neutral grey here as well as in the legend and the 3D view.
 */
export function colourSentence(findings: FindingColour[]): string {
  return findings
    .map(f => `${COLOUR_NAMES[findingColour(f.color).toLowerCase()] ?? FALLBACK_COLOUR} is ${f.label}`)
    .join(', ')
}

/** The session's loading line, with the backend's progress once it reports any. */
export function sessionProgressText(progress: number, total: number): string {
  return total > 0 ? `${MY_MRI_COPY.loading} (${progress} of ${total})` : MY_MRI_COPY.loading
}

export const MY_MRI_COPY = {
  /** The sidebar group the patient pages sit in, above each page's title. */
  eyebrow: 'MY RESULTS',
  title: 'My Report',
  loading: 'Loading your scan…',
  tryAgain: 'Try again',
  viewerHeading: 'MRI',
  viewerLabel: 'Your MRI scan',
  /** Screen-reader help for the viewer, per view. */
  viewerHint: 'Drag to turn the view, right-drag to move it, scroll to zoom.',
  /** The 3D view's gestures on a phone or tablet (the trackball's touch gestures). */
  viewerHintTouch: 'Drag to turn the view, pinch to zoom, drag with two fingers to move it.',
  viewerSliceHint: 'Ctrl + scroll: change slice',
  /** A phone or tablet has no Ctrl and no wheel: one finger drags through the slices. */
  viewerSliceHintTouch: 'Drag up or down: change slice',
  viewerViewsLabel: 'View',
  /** `short` is the label when the control bar is too narrow for the full one. */
  viewerViews: [
    { view: '3d', label: '3D', short: '3D', title: 'All three slices together' },
    { view: 'axial', label: 'Axial', short: 'Ax', title: 'One slice at a time, across your body' },
    { view: 'coronal', label: 'Coronal', short: 'Cor', title: 'One slice at a time, from the front' },
    { view: 'sagittal', label: 'Sagittal', short: 'Sag', title: 'One slice at a time, from the side' },
  ],
  viewerLegendLabel: 'Colour key',
  viewerNoMask: 'No marked areas for this scan.',
  viewerErrors: {
    scan: 'Your scan could not be loaded.',
    orientation: 'Your scan could not be shown, because its orientation could not be read.',
    mask: 'The marked areas could not be loaded.',
    stalled: 'Your scan took too long to load.',
    viewer: 'The 3D view could not start on this device.',
  },
  reportHeading: 'Report',
  reportLoading: 'Loading your report…',
  reportTitle: 'Your MRI summary',
  reportNone: 'No report is available for this scan.',
  /** Hands the PDF to the device's own viewer: every page, pinch zoom. */
  reportOpen: 'Open',
  reportDownload: 'Download',
  reportPageLabel: (n: number, total: number) => `Page ${n} of ${total}`,
  reportPageFailed: (n: number) => `Page ${n} could not be shown.`,
  panelHeading: 'WHAT YOU\'RE SEEING',
  intro: 'This is your breast MRI, opened on the slice through the area your clinician marked. Choose 3D in the bar under the scan to see three slices together, one in each direction.',
  markedAreas: 'The coloured shapes are the areas your clinician marked.',
  colourMatch: (sentence: string) => `Each colour matches an area in your report: ${sentence}.`,
  controlsLead: 'Scroll or pinch to zoom in any view. In 3D, drag to turn the view; right-drag, or drag with two fingers, to move it.',
  controlsReset: 'Reset view',
  controlsTail: 'puts it back, and Fullscreen fills the screen with it.',
  views: 'Axial, Coronal and Sagittal show one slice at a time: across your body, from the front and from the side. To move through the slices, hold Ctrl while you scroll, or on a phone or tablet drag up or down with one finger.',
  reportNote: 'Your report summary is beside your scan. Drag the bar between them to give either more room. If anything is unclear, ask your care team.',
} as const
