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
