import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import { readOfficeArtRecords } from '../office-art/records'
import type { OfficeArtRecord } from '../office-art/types'
import { drawingPropertyTables } from './properties'
import type { DocDrawingShape, DrawingReadContext } from './types'

/** @param record - Optional group/child coordinate record. @returns Original signed rectangle or no coordinate authority. */
function rectangle(record: OfficeArtRecord | undefined): readonly [number, number, number, number] | null {
  if (!record) return null
  requireDoc(record.data.length === 16, 'invalid-drawing-data', 'Invalid OfficeArt group or child rectangle size')
  const view = new ByteView(record.data, 'invalid-drawing-data')
  return [view.u32(0) | 0, view.u32(4) | 0, view.u32(8) | 0, view.u32(12) | 0]
}

/** @param record - Bounded shape container. @param parentId - Original owning group. @param context - Shared work and shape counters. @returns Complete source shape without compiling geometry or defaults. */
function readShape(record: OfficeArtRecord, parentId: number | null, context: DrawingReadContext): DocDrawingShape {
  requireDoc(record.version === 15 && record.instance === 0, 'invalid-drawing-data', 'Invalid OfficeArt shape container header')
  requireDoc(context.shapesRead < context.limits.maxDrawings, 'limit-exceeded', 'Drawing shape count limit exceeded')
  context.shapesRead++
  const children = readOfficeArtRecords(record.data, context), sources = children.filter(child => child.type === 0xf00a)
  requireDoc(sources.length === 1 && sources[0]!.version === 2 && sources[0]!.data.length === 8,
    'invalid-drawing-data', 'Drawing shape requires one complete FSP record')
  const source = sources[0]!, view = new ByteView(source.data, 'invalid-drawing-data')
  const groups = children.filter(child => child.type === 0xf009), anchors = children.filter(child => child.type === 0xf00f)
  requireDoc(groups.length <= 1 && anchors.length <= 1, 'invalid-drawing-data', 'Ambiguous drawing coordinate authority')
  const result: DocDrawingShape = { id: view.u32(0), type: source.instance, flags: view.u32(4), parentId,
    groupBounds: rectangle(groups[0]), childBounds: rectangle(anchors[0]), propertyTables: drawingPropertyTables(children, context),
    unprojectedRecords: children.filter(child => ![0xf00a, 0xf009, 0xf00f, 0xf00b, 0xf121, 0xf122].includes(child.type)).map(child => child.type) }
  context.shapeRecords?.set(result, record)
  return result
}

/**
 * Walks known shape/group containers without flattening child coordinates or looking for byte magic.
 * @param record - Complete drawing or nested group container.
 * @param context - Shared work, shape and allocation counters.
 * @returns Shape preorder and uninterpreted container record types.
 */
export function readDrawingShapes(record: OfficeArtRecord, context: DrawingReadContext): { shapes: DocDrawingShape[], unprojectedRecords: number[] } {
  const shapes: DocDrawingShape[] = [], unprojectedRecords: number[] = []
  /** @param container - Known drawing/group wrapper. @param parentId - Owning group outside the wrapper. @param depth - Current bounded container depth. */
  function walk(container: OfficeArtRecord, parentId: number | null, depth: number): void {
    requireDoc(depth <= context.limits.maxDrawingDepth, 'limit-exceeded', 'Drawing container depth limit exceeded')
    requireDoc(container.version === 15 && container.instance === 0, 'invalid-drawing-data', 'Invalid drawing or group container header')
    const children = readOfficeArtRecords(container.data, context)
    requireDoc(container.type !== 0xf003 || children[0]?.type === 0xf004,
      'invalid-drawing-data', 'Drawing group has no first group shape')
    let groupId = parentId, first = true
    for (const child of children) {
      if (child.type === 0xf004) {
        requireDoc(depth + 1 <= context.limits.maxDrawingDepth, 'limit-exceeded', 'Drawing shape container depth limit exceeded')
        const shape = readShape(child, groupId, context)
        shapes.push(shape)
        // The first shape defines the group's coordinate authority. Its own
        // parent remains the outer group; later siblings consume this group.
        if (container.type === 0xf003 && first) {
          requireDoc(shape.flags & 1, 'invalid-drawing-data', 'First group shape is missing its group flag')
          groupId = shape.id; first = false
        }
      } else if (child.type === 0xf003) walk(child, groupId, depth + 1)
      else unprojectedRecords.push(child.type)
    }
  }
  walk(record, null, 1)
  return { shapes, unprojectedRecords }
}
