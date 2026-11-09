import { ByteView } from '../../../binary/bytes'
import { requireDoc } from '../../../errors'
import { compileOfficeArtProperties } from '../../office-art/effective'
import { readOfficeArtRecords } from '../../office-art/records'
import type { PictureReadContext } from '../../pictures/types'
import type { DocDrawingShape, DrawingSourceData } from '../types'
import type { TextShapeIdentitySource } from './types'

/** @param shape - Actual source shape. @param data - Immutable original records and defaults. @param context - Shared source budgets. @returns Original text identity without requiring unrelated shape appearance to be supported. */
export function readTextShapeIdentity(shape: DocDrawingShape, data: DrawingSourceData, context: PictureReadContext): TextShapeIdentitySource {
  const record = data.shapeRecords.get(shape)
  requireDoc(record, 'invalid-drawing-data', 'Textbox has no original shape record')
  const children = readOfficeArtRecords(record.data, { ...context, errorCode: 'invalid-drawing-data' })
  const clients = children.filter(child => child.type === 0xf00d)
  requireDoc(clients.length <= 1 && (!clients[0] || clients[0].data.length === 4), 'invalid-drawing-data', 'Ambiguous or truncated ClientTextbox record')
  requireDoc(children.filter(child => child.type === 0xf011).every(child => child.data.length === 4), 'invalid-drawing-data', 'Invalid textbox Word client data')
  const properties = compileOfficeArtProperties([...data.source.defaults, ...shape.propertyTables].flatMap(table => table.properties), context.reader)
  const propertyId = properties.property(128)
  requireDoc(!propertyId || propertyId.flags === 128, 'invalid-drawing-data', 'Textbox identifier is not an ordinary scalar')
  const localId = propertyId?.value ?? 0, clientId = clients[0] ? new ByteView(clients[0].data, 'invalid-drawing-data').u32(0) : 0
  requireDoc(!(localId && clientId && localId !== clientId), 'invalid-drawing-data', 'Textbox identifier authorities disagree')
  return { textId: localId || clientId, nextShapeId: properties.scalar(138, 0) >>> 0, properties, children }
}
