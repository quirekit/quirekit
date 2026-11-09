import { requireDoc } from '../../../errors'
import type { PictureReadContext } from '../../pictures/types'
import type { DrawingSourceData } from '../types'
import { readFloatingPictureAssociation } from '../pictures/association'
import { readFloatingPicturePlacement } from '../pictures/placement'
import type { FloatingPictureIndex } from '../pictures/types'
import { readTextShape } from './shape'
import type { SourceFloatingTextbox, TextShapeIdentitySource } from './types'

/** @param index - Unique same-part FSPA-to-shape owner. @param data - Once-read complete drawing source. @param context - Shared source work and allocation budgets. @param linked - Whether the caller will separately validate the complete original chain. @param identity - Optional once-read original identity authority. @returns Ordinary frame and original text identity, without copying or guessing author content. */
export function readFloatingTextbox(index: FloatingPictureIndex, data: DrawingSourceData, context: PictureReadContext, linked = false,
  identity?: TextShapeIdentitySource): SourceFloatingTextbox {
  const shape = index.shape, parent = index.parent
  requireDoc(shape && [1, 202].includes(shape.type) && (shape.flags & ~0xac0) === 0 && (shape.flags & 0xa00) === 0xa00,
    'unsupported-picture', 'Textbox is outside the ordinary non-OLE rectangle path')
  requireDoc(parent && parent.parentId === null && Boolean(parent.flags & 1) && !shape.childBounds,
    'unsupported-picture', 'Grouped textboxes require their own coordinate projection')
  const source = readTextShape(shape, data, context, (textId, nextShapeId) => {
    requireDoc((textId >>> 16) > 0 && (linked || (textId & 65535) === 0), 'unsupported-picture', 'Linked or missing textbox identity requires its own chain projection')
    requireDoc(nextShapeId !== shape.id || index.anchorReferences === 1,
      'unsupported-picture', 'A self-linked textbox requires one unique original FSPA reference')
  }, identity), properties = source.properties
  const extent = [(index.anchor.bounds[2] - index.anchor.bounds[0]) * 635, (index.anchor.bounds[3] - index.anchor.bounds[1]) * 635] as const
  requireDoc(extent.every(value => value > 0), 'invalid-drawing-data', 'Textbox has no positive creation extent')
  const placement = readFloatingPicturePlacement(index, properties)
  return { ...source.shape, kind: index.part.kind === 'main' ? 'textbox' : 'headerTextbox', position: index.anchor.position, extent, placement,
    staleClientAnchor: readFloatingPictureAssociation(source.children, index.anchorIndex, index.anchorReferences), unprojected: properties.unprojected() }
}
