/**
 * My Images: the patient's own anatomy, mammogram and MRI, in the same three
 * views as the examples. Only the MRI exists in the data today; the other two
 * hold their place and point at an example instead.
 */
export const MY_IMAGES_COPY = {
  eyebrow: 'MY IMAGES',
  title: 'Your images',
  stageLabel: 'Your anatomy, mammogram and MRI',
  anatomy: 'Anatomy',
  mammogram: 'Mammogram',
  mri: 'MRI',
  anatomyMissing: 'Your anatomy model is not available yet.',
  mammogramMissing: 'Your mammogram is not available yet.',
  seeExample: 'See an example',
  open: 'Open',
  panelHeading: 'WHAT YOU\'RE SEEING',
  intro: 'These are your own images, in the same three views as the examples: anatomy, mammogram and MRI.',
  missing: 'Your anatomy model and your mammogram are not available yet. Until they are, See an example shows what each view looks like.',
  mriNote: 'Your MRI is shown in 3D, with the areas your clinician marked in colour. Open it to see one slice at a time beside the 3D view.',
} as const

/**
 * My Images › MRI (/my-images/mri): the annotator's reading layout for a
 * patient -- the current slice, the previous MRI beside it, and the 3D view.
 * There is no previous MRI in the data; its column holds the place.
 */
export const MY_IMAGES_MRI_COPY = {
  back: 'My Images',
  eyebrow: 'MY IMAGES',
  title: 'Your MRI',
  stageLabel: 'Your current MRI, previous MRI and 3D view',
  current: 'Current MRI',
  previous: 'Previous MRI',
  threeD: '3D',
  previousMissing: 'No earlier MRI on file.',
  panelHeading: 'WHAT YOU\'RE SEEING',
  currentNote: 'Current MRI is your latest scan, one slice at a time, opened on the slice through the area your clinician marked. Scroll to move through the slices; hold Ctrl while you scroll to zoom.',
  previousNote: 'Previous MRI is where an earlier scan would sit beside it, for comparison. There is none on file.',
  threeDNote: 'The 3D view shows where the marked areas sit in your breast. Drag to turn it, right-drag to move it, and scroll to zoom.',
  resetNote: 'Reset puts a view back how it opened.',
} as const
