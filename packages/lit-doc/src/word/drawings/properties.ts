import { readOfficeArtProperties } from '../office-art/properties'
import type { OfficeArtRecord } from '../office-art/types'
import type { DocDrawingPropertyTable, DrawingReadContext } from './types'

/** @param records - Original children of one global or shape container. @param context - Shared work/allocation authority. @returns Distinct original property layers in physical order. */
export function drawingPropertyTables(records: readonly OfficeArtRecord[], context: DrawingReadContext): DocDrawingPropertyTable[] {
  return records.flatMap(record => {
    const kind = record.type === 0xf00b ? 'primary' : record.type === 0xf121 ? 'secondary' : record.type === 0xf122 ? 'tertiary' : null
    return kind ? [{ kind, properties: readOfficeArtProperties(record, context) }] : []
  })
}
