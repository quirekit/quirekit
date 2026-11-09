import { requireDoc } from '../../errors'
import type { PictureProjectionOwner } from '../pictures/types'

/** @param owner - Shared document counters. @returns A bounded id outside the existing standalone picture and textbox ranges. */
export function nextGroupDrawingId(owner: PictureProjectionOwner): number {
  const limits = owner.reader.limits
  requireDoc(++owner.groupCount <= limits.maxDrawings, 'limit-exceeded', 'Grouped drawing occurrence limit exceeded')
  return limits.maxPictures + limits.maxDrawings + owner.groupCount
}
