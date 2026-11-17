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
 * "orange is Finding 1, blue is Finding 2", built from the findings' own
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
  viewerSliceHint: 'Ctrl + scroll: change slice',
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
  reportTitle: 'Your MRI report',
  reportNoFindings: 'No report is available for this scan.',
  reportOpen: 'Open report',
  reportDownload: 'Download',
  panelHeading: 'WHAT YOU\'RE SEEING',
  intro: 'This is your breast MRI, opened on the slice through the area your clinician marked. Choose 3D in the bar under the scan to see three slices together, one in each direction.',
  markedAreas: 'The coloured shapes are the areas your clinician marked.',
  colourMatch: (sentence: string) => `Each colour matches a finding in your report: ${sentence}.`,
  controlsLead: 'Scroll to zoom in any view. In 3D, drag to turn the view and right-drag to move it.',
  controlsReset: 'Reset view',
  controlsTail: 'puts it back, and Fullscreen fills the screen with it.',
  views: 'Axial, Coronal and Sagittal show one slice at a time: across your body, from the front and from the side. Hold Ctrl while you scroll to move through the slices.',
  reportNote: 'Your report is beside your scan. A dash (—) means that item has not been recorded. Drag the bar between them to give either more room. If anything is unclear, ask your clinician.',
} as const
