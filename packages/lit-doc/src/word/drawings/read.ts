import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { DocReadDiagnostic } from '../../types'
import type { WordDocumentSource } from '../document/types'
import { readOfficeArtRecord, readOfficeArtRecords } from '../office-art/records'
import type { OfficeArtReadContext, OfficeArtRecord } from '../office-art/types'
import { createPropertyReader } from '../properties/reader'
import type { PropertyReader } from '../properties/types'
import { readDrawingAnchors } from './anchors'
import { drawingPropertyTables } from './properties'
import { readDrawingShapes } from './shapes'
import type { DocDrawingPart, DocDrawingShape, DocDrawingsSource, DrawingReadContext, DrawingSourceData } from './types'

/**
 * Reads the labelled floating drawing source without compiling styles, decoding media or inventing editor anchors.
 * @param source - Validated source locators, original text and stream boundaries.
 * @param reader - Optional existing property-work authority when other source passes were requested.
 * @param diagnostics - Optional sink for bounded compatibility decisions.
 * @returns Complete main/header source graph and separate drawing-group defaults.
 */
export function readDrawingRecords(source: WordDocumentSource, reader?: PropertyReader, diagnostics?: DocReadDiagnostic[]): DocDrawingsSource {
  return readDrawingData(source, reader, diagnostics).source
}

/**
 * Shares the source parser's exact records with the later admitted media consumer.
 * @param source - Private document streams and validated FIB.
 * @param reader - Existing document property-work authority.
 * @param diagnostics - Compatibility observations from the same parse.
 * @param propertyBytes - Optional document-wide allocation authority shared with inline media.
 * @returns Original source graph and its private media/shape record identities.
 */
export function readDrawingData(source: WordDocumentSource, reader?: PropertyReader, diagnostics?: DocReadDiagnostic[],
  propertyBytes?: OfficeArtReadContext['propertyBytes']): DrawingSourceData {
  const { table, header, limits } = source
  const shapeRecords = new Map<DocDrawingShape, OfficeArtRecord>()
  const context: DrawingReadContext = { limits, reader: reader ?? createPropertyReader(undefined, limits),
    errorCode: 'invalid-drawing-data', propertyBytes: propertyBytes ?? { remaining: limits.maxDrawingPropertyBytes }, shapesRead: 0, anchorsRead: 0, shapeRecords }
  const parts: DocDrawingPart[] = [0, 1].map(index => ({ kind: index === 0 ? 'main' : 'header', sourceOrder: null,
    ...readDrawingAnchors(table, header.records[40 + index], header.stories[index === 0 ? 0 : 2]!, context),
    shapes: [], unprojectedRecords: [] }))
  const range = header.records[50]
  if (!range?.length) {
    requireDoc(parts.every(part => part.anchors.length === 0), 'invalid-drawing-data', 'Shape anchors reference a missing OfficeArt group')
    return { source: { scope: 'floating-drawing-source', present: false, defaults: [], mediaCount: 0, mediaDeclaredCount: null, parts, unprojectedRecords: [] }, media: [], shapeRecords }
  }
  const bytes = new ByteView(table, 'invalid-drawing-data').slice(range.offset, range.length)
  const global = readOfficeArtRecord(bytes, 0, context)
  requireDoc(global.type === 0xf000 && global.version === 15 && global.instance === 0,
    'invalid-drawing-data', 'Invalid OfficeArt drawing-group container')
  const children = readOfficeArtRecords(global.data, context), stores = children.filter(child => child.type === 0xf001)
  requireDoc(stores.length <= 1, 'invalid-drawing-data', 'Ambiguous global image-store authority')
  let media: OfficeArtRecord[] = [], mediaDeclaredCount: number | null = null
  if (stores[0]) {
    requireDoc(stores[0].version === 15, 'invalid-drawing-data', 'Invalid global image-store container')
    media = readOfficeArtRecords(stores[0].data, context)
    mediaDeclaredCount = stores[0].instance
    if (media.length !== mediaDeclaredCount) diagnostics?.push({ code: 'drawing-media-count-variant',
      message: 'The original image-store instance count differs from its complete physical record sequence; both counts are retained without truncating or fabricating source slots.' })
  }
  const defaults = drawingPropertyTables(children, context), view = new ByteView(bytes, 'invalid-drawing-data')
  let offset = global.end, order = 0
  while (offset < bytes.length) {
    requireDoc(order < 2, 'invalid-drawing-data', 'Too many labelled OfficeArt document drawings')
    const tag = view.u8(offset++), part = parts[tag]
    requireDoc(tag <= 1 && part?.sourceOrder === null, 'invalid-drawing-data', 'Invalid or repeated drawing document label')
    const record = readOfficeArtRecord(bytes, offset, context)
    requireDoc(record.type === 0xf002, 'invalid-drawing-data', 'Labelled document drawing is not a drawing container')
    Object.assign(part, readDrawingShapes(record, context), { sourceOrder: order++ })
    offset = record.end
  }
  requireDoc(parts.every(part => part.anchors.length === 0 || part.sourceOrder !== null),
    'invalid-drawing-data', 'Shape anchors reference a missing labelled document drawing')
  return { source: { scope: 'floating-drawing-source', present: true, defaults, mediaCount: media.length, mediaDeclaredCount, parts,
    unprojectedRecords: children.filter(child => ![0xf001, 0xf00b, 0xf121, 0xf122].includes(child.type)).map(child => child.type) }, media, shapeRecords }
}
