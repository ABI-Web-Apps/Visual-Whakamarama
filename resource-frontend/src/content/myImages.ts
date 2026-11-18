/**
 * My Images: the patient's own anatomy, mammogram and MRI, in the same three
 * views as the examples. Only the MRI exists in the data today; until the
 * other two do, their columns show the Density C example, marked as one.
 */
export const MY_IMAGES_COPY = {
  /** The sidebar group the patient pages sit in, above each page's title. */
  eyebrow: 'MY RESULTS',
  title: 'My Images',
  stageLabel: 'Your anatomy, mammogram and MRI',
  anatomy: 'Anatomy',
  mammogram: 'Mammogram',
  mri: 'MRI',
  /** The badge on a column showing an example rather than the patient's own image. */
  example: 'Example',
  /** The case the examples come from, and what each column says about it. */
  exampleCase: 'density-c',
  anatomyExample: 'Example data from Density C. Your anatomy model is not available yet.',
  mammogramExample: 'Example data from Density C. Your mammogram is not available yet.',
  exampleLink: 'See the case',
  anatomyExampleLabel: 'Example anatomy model, Density C',
  mammogramExampleLabel: 'Example mammogram, Density C',
  open: 'Open',
  mriLabel: 'Your MRI in 3D',
  panelHeading: 'WHAT YOU\'RE SEEING',
  intro: 'These are your images, in the same three views as the examples: anatomy, mammogram and MRI.',
  missing: 'Your anatomy model and your mammogram are not available yet. Until they are, those two columns show example data from Density C (heterogeneously dense), marked Example. They are not your images.',
  mriNote: 'Your MRI is your own scan, shown in 3D with the areas your clinician marked in colour. Open it to see one slice at a time beside the 3D view.',
  resizeNote: 'Drag the bar between two columns to give one more room.',
} as const

/**
 * My Images › MRI (/my-images/mri): the annotator's reading layout for a
 * patient -- the current slice, the previous MRI beside it, and the 3D view.
 * There is no previous MRI in the data; its column holds the place, and can
 * be minimised so the other two share the row.
 */
export const MY_IMAGES_MRI_COPY = {
  back: 'My Images',
  eyebrow: 'MY RESULTS',
  title: 'My MRI',
  stageLabel: 'Your current MRI, previous MRI and 3D view',
  current: 'Current MRI',
  previous: 'Previous MRI',
  threeD: '3D',
  previousMissing: 'No earlier MRI on file.',
  previousCollapse: 'Minimise Previous MRI',
  previousExpand: 'Show Previous MRI',
  currentLabel: 'Your current MRI, one slice at a time',
  threeDLabel: 'Your MRI in 3D',
  panelHeading: 'WHAT YOU\'RE SEEING',
  currentNote: 'Current MRI is your latest scan, one slice at a time, opened on the slice through the area your clinician marked. Scroll to zoom; hold Ctrl while you scroll to move through the slices. On a phone or tablet, pinch to zoom and drag up or down with one finger to move through them.',
  previousNote: 'Previous MRI is where an earlier scan would sit beside it, for comparison. There is none on file: minimise it and the other two share the space.',
  threeDNote: 'The 3D view shows where the marked areas sit in your breast. Drag to turn it; right-drag, or drag with two fingers, to move it; scroll or pinch to zoom.',
  resetNote: 'Under each view, Reset view puts it back how it opened and Fullscreen fills the screen with it. Drag the bar between two columns to give one more room.',
} as const
