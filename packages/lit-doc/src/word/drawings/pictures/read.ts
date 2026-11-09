import { requireDoc } from '../../../errors'
import type { PictureReadContext, SourcePictureFrame } from '../../pictures/types'
import type { DrawingSourceData } from '../types'
import { readFloatingPicturePlacement } from './placement'
import type { FloatingPictureIndex, SourceFloatingPicture } from './types'
import { readFloatingPictureAssociation } from './association'
import { readPictureShape } from './shape'

/**
 * Reads one ordinary picture's complete source tuple before any target resource is registered.
 * @param index - Original part, unique shape and exact FSPA position.
 * @param data - Complete source graph and private original records.
 * @param context - Shared record/property/media budgets.
 * @param media - Once-decoded source store loader.
 * @returns Source bytes, original occurrence geometry and effective placement.
 */
export function readFloatingPicture(index: FloatingPictureIndex, data: DrawingSourceData, context: PictureReadContext,
  media: (index: number) => Pick<SourcePictureFrame, 'bytes' | 'mime'>): SourceFloatingPicture {
  const shape = index.shape
  requireDoc(shape && shape.type === 75 && (shape.flags & ~0xac0) === 0 && (shape.flags & 0xa00) === 0xa00,
    'unsupported-picture', 'Floating anchor is outside the ordinary non-OLE picture-frame path')
  const parent = index.parent
  requireDoc(parent && parent.parentId === null && Boolean(parent.flags & 1) && !shape.childBounds,
    'unsupported-picture', 'Nested/group-transformed pictures require their own geometry lifecycle')
  const source = readPictureShape(shape, data, context, media,
    index.anchor.bounds[2] - index.anchor.bounds[0], index.anchor.bounds[3] - index.anchor.bounds[1])
  const staleClientAnchor = readFloatingPictureAssociation(source.children, index.anchorIndex, index.anchorReferences)
  const placement = readFloatingPicturePlacement(index, source.properties)
  return { mediaIndex: source.mediaIndex, picture: source.load(), placement, staleClientAnchor }
}
