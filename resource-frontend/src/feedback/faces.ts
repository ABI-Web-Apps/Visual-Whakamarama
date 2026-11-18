import type { Rating } from '@/feedback/types'

/**
 * The five faces, drawn on a 32x32 grid around a head at (16,16) r 13: the
 * feedback form's radio group (RatingFaces) and the inbox's entries both
 * draw from here, so a note looks the same where it was given and where it
 * is read.
 */
export interface FaceDrawing { mouth: string, extra?: string[], eyes: 'dots' | 'smile', fillMouth?: boolean }

export const FACES: Record<Rating, FaceDrawing> = {
  1: { mouth: 'M10.5 22.5c1.5-2.4 3.4-3.5 5.5-3.5s4 1.1 5.5 3.5', extra: ['M9.6 10.6l3.2 1.6', 'M22.4 10.6l-3.2 1.6'], eyes: 'dots' },
  2: { mouth: 'M11.5 21.5c1.3-1.4 2.8-2 4.5-2s3.2.6 4.5 2', eyes: 'dots' },
  3: { mouth: 'M11.5 20.5h9', eyes: 'dots' },
  4: { mouth: 'M11 19c1.3 1.8 3 2.7 5 2.7s3.7-.9 5-2.7', eyes: 'dots' },
  5: { mouth: 'M10 18.2h12c0 3.6-2.7 6.2-6 6.2s-6-2.6-6-6.2z', eyes: 'smile', fillMouth: true },
}
