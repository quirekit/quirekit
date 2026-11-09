import { requireDoc } from '../../../errors'
import { compileOfficeArtProperties } from '../../office-art/effective'
import { readOfficeArtRecords } from '../../office-art/records'
import { pictureText } from '../../pictures/properties'
import type { PictureReadContext, SourcePictureFrame } from '../../pictures/types'
import type { DocDrawingShape, DrawingSourceData } from '../types'
import type { PictureShapeSource } from './types'

/** @param shape - Original ordinary non-OLE picture leaf. @param data - Shared immutable graph/media authority. @param context - Record/property/media budgets. @param media - Once-decoded source store loader. @param width - Creation width in physical twips, resolved from the actual owner. @param height - Creation height in physical twips. @returns Original media and shape-local fields without inventing placement or source association. */
export function readPictureShape(shape: DocDrawingShape, data: DrawingSourceData, context: PictureReadContext,
  media: (index: number) => Pick<SourcePictureFrame, 'bytes' | 'mime'>, width: number, height: number): PictureShapeSource {
  requireDoc(shape.type === 75 && (shape.flags & ~0xac2) === 0 && (shape.flags & 0xa00) === 0xa00,
    'unsupported-picture', 'Floating anchor is outside the ordinary non-OLE picture-frame path')
  const record = data.shapeRecords.get(shape)
  requireDoc(record, 'invalid-drawing-data', 'Floating shape has no original record authority')
  const children = readOfficeArtRecords(record.data, { ...context, errorCode: 'invalid-drawing-data' })
  requireDoc(children.filter(child => child.type === 0xf011).every(child => child.data.length === 4),
    'invalid-drawing-data', 'Invalid Word drawing client data extent')
  requireDoc(!children.some(child => child.type === 0xf00d), 'unsupported-picture', 'Picture textbox content requires a separate owner')
  const properties = compileOfficeArtProperties([...data.source.defaults, ...shape.propertyTables].flatMap(table => table.properties), context.reader)
  const display = properties.property(260), mediaIndex = properties.scalar(260, 0)
  requireDoc(display && (display.flags & 0xc000) === 0x4000 && mediaIndex > 0 && mediaIndex <= data.media.length,
    'unsupported-picture', 'Floating picture requires one valid original global display-media slot')
  requireDoc(width > 0 && height > 0, 'invalid-picture-data', 'Floating picture has no positive creation rectangle')
  const crop = [properties.scalar(258, 0), properties.scalar(256, 0), properties.scalar(259, 0), properties.scalar(257, 0)] as const
  requireDoc(crop[0] + crop[2] < 65536 && crop[1] + crop[3] < 65536, 'invalid-picture-data', 'Floating picture crop has no visible source area')
  return { mediaIndex, properties, children,
    /** @returns Original media and metadata, decoded only after actual caller placement admission. */
    load() { return { initialWidth: width, initialHeight: height, scaleX: 1000, scaleY: 1000, crop,
      rotation: properties.scalar(4, 0), flipX: Boolean(shape.flags & 0x40), flipY: Boolean(shape.flags & 0x80),
      lockAspect: properties.flag(127, 7, false), name: pictureText(properties.property(896)), description: pictureText(properties.property(897)),
      ...media(mediaIndex), unprojected: properties.unprojected(),
      unprojectedRecords: shape.unprojectedRecords.filter(type => type !== 0xf010 && type !== 0xf011), hasBorders: false } },
  }
}
