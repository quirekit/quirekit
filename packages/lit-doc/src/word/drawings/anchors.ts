import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { DocStoryRange } from '../../types'
import type { WordRecordRange } from '../types'
import type { DocDrawingAnchor, DrawingReadContext } from './types'

/**
 * Reads actual anchors independently of their undefined terminal PLC value and source shape availability.
 * @param table - FIB-selected Table bytes.
 * @param range - Part-specific PLC locator.
 * @param story - Original part's common source interval.
 * @param context - Shared count/work authority across main and header parts.
 * @returns Complete anchors and untouched terminal operand.
 */
export function readDrawingAnchors(table: Uint8Array, range: WordRecordRange | undefined, story: DocStoryRange,
  context: DrawingReadContext): { anchors: DocDrawingAnchor[], terminalCp: number | null } {
  if (!range?.length) return { anchors: [], terminalCp: null }
  requireDoc(range.length >= 4 && (range.length - 4) % 30 === 0, 'invalid-drawing-data', 'Invalid shape-anchor PLC extent')
  const count = (range.length - 4) / 30
  requireDoc(count <= context.limits.maxDrawings - context.anchorsRead, 'limit-exceeded', 'Drawing anchor count limit exceeded')
  context.reader.consume(count); context.anchorsRead += count
  const view = new ByteView(new ByteView(table, 'invalid-drawing-data').slice(range.offset, range.length), 'invalid-drawing-data')
  const anchors: DocDrawingAnchor[] = []
  for (let index = 0; index < count; index++) {
    const cp = view.u32(index * 4), previous = index > 0 ? view.u32((index - 1) * 4) : -1
    requireDoc(cp <= story.end - story.start && cp > previous, 'invalid-drawing-data', 'Invalid or repeated shape-anchor CP')
    const offset = (count + 1) * 4 + index * 26
    anchors.push({ position: story.start + cp, shapeId: view.u32(offset),
      bounds: [view.u32(offset + 4) | 0, view.u32(offset + 8) | 0, view.u32(offset + 12) | 0, view.u32(offset + 16) | 0],
      flags: view.u16(offset + 20), textboxCount: view.u32(offset + 22) })
  }
  const terminalCp = view.u32(count * 4)
  requireDoc(count === 0 || terminalCp > view.u32((count - 1) * 4), 'invalid-drawing-data', 'Invalid terminal shape-anchor PLC operand')
  return { anchors, terminalCp }
}
