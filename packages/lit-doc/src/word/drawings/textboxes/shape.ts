import { requireDoc } from '../../../errors'
import type { PictureReadContext } from '../../pictures/types'
import type { DocDrawingShape, DrawingSourceData } from '../types'
import { readTextboxPaint } from './appearance'
import { readTextShapeIdentity } from './identity'
import type { TextShapeIdentitySource, TextShapeSource, ValidateTextShapeIdentity } from './types'

/** @param shape - Original ordinary text-capable shape, with its real parent retained. @param data - Shared immutable drawing graph. @param context - Common record/property budgets. @param validateIdentity - Optional caller-specific ownership admission. @param identity - Optional once-read original identity, never fabricated by a placement adapter. @returns Shape-local values without inventing page placement or source text ownership. */
export function readTextShape(shape: DocDrawingShape, data: DrawingSourceData, context: PictureReadContext, validateIdentity?: ValidateTextShapeIdentity,
  identity?: TextShapeIdentitySource): TextShapeSource {
  requireDoc([1, 202].includes(shape.type) && (shape.flags & ~0xac2) === 0 && (shape.flags & 0xa00) === 0xa00,
    'unsupported-picture', 'Textbox is outside the ordinary non-OLE rectangle path')
  const { textId, nextShapeId, properties, children } = identity ?? readTextShapeIdentity(shape, data, context)
  validateIdentity?.(textId, nextShapeId)
  requireDoc(properties.scalar(136, 0) === 0 && properties.scalar(137, 0) === 0 && properties.scalar(139, 0) === 0,
    'unsupported-picture', 'Non-horizontal textbox text requires its own lifecycle')
  const insets = [properties.scalar(129, 91440), properties.scalar(130, 45720), properties.scalar(131, 91440), properties.scalar(132, 45720)] as const
  requireDoc(insets.every(value => value >= 0 && value <= 0x132f540), 'invalid-drawing-data', 'Textbox inset is outside its original range')
  const anchor = properties.scalar(135, 0), wrap = properties.scalar(133, 0)
  requireDoc(anchor >= 0 && anchor <= 2 && [0, 1, 2].includes(wrap) && !properties.flag(191, 3, false),
    'unsupported-picture', 'Textbox needs unsupported text anchoring, wrapping or automatic margins')
  const lineWidth = properties.scalar(459, 9525)
  requireDoc(lineWidth >= 0, 'invalid-drawing-data', 'Textbox line width is negative')
  const value = { shapeId: shape.id, textId, nextShapeId,
    textbox: shape.type === 202, rotation: properties.scalar(4, 0), flipX: Boolean(shape.flags & 0x40), flipY: Boolean(shape.flags & 0x80),
    lockAspect: properties.flag(127, 7, false), insets, verticalAlignment: (['t', 'ctr', 'b'] as const)[anchor]!,
    wrapInside: wrap !== 2, fitShape: properties.flag(191, 1, false), fill: readTextboxPaint(properties, true), stroke: readTextboxPaint(properties, false), lineWidth,
    unprojectedRecords: shape.unprojectedRecords.filter(type => ![0xf00d, 0xf010, 0xf011].includes(type)), unprojected: properties.unprojected() }
  return { shape: value, properties, children }
}
