import type { DocInspection } from '../types'
import type { DocDrawingAnchor, DocDrawingPart, DocDrawingPropertyTable, DocDrawingShape } from '../word/drawings/types'
import type { OfficeArtProperty } from '../word/office-art/types'
import { officeArtArrayProperties } from '../word/office-art/arrays'

/** @param value - Untrusted numeric source field. @param maximum - Exact source range ceiling. @returns Whether the field is a nonnegative bounded integer. */
function unsigned(value: unknown, maximum = 0xffffffff): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= maximum
}

/** @param value - Candidate signed source rectangle. @returns Whether all four coordinates retain exact signed 32-bit values. */
function rectangle(value: unknown): boolean {
  return value === null || Array.isArray(value) && value.length === 4
    && value.every(axis => Number.isSafeInteger(axis) && axis >= -0x80000000 && axis <= 0x7fffffff)
}

/** @param value - Original uninterpreted record codes. @returns Whether the complete numeric vector is present. */
function records(value: unknown): boolean { return Array.isArray(value) && value.every(type => unsigned(type, 0xffff)) }

/** @param value - Complete property-layer vector. @returns Whether every original flag, scalar and physical complex value is present. */
function propertyTables(value: readonly DocDrawingPropertyTable[]): boolean {
  return Array.isArray(value) && value.every((table: DocDrawingPropertyTable) => table && ['primary', 'secondary', 'tertiary'].includes(table.kind)
    && Array.isArray(table.properties) && table.properties.every((property: OfficeArtProperty) => property && unsigned(property.flags, 0xffff)
      && unsigned(property.value) && property.id === (property.flags & 0x3fff)
      && (property.flags & 0x8000 ? property.complex instanceof Uint8Array
        && (property.complex.length === property.value || officeArtArrayProperties.has(property.id)
          && property.value > 0 && property.complex.length === property.value + 6)
        : property.complex === undefined)))
}

/**
 * Validates the complete requested floating drawing graph instead of accepting an older partial Worker result.
 * @param result - Source result received from an owned Worker before exposing it to the caller.
 * @returns Whether all requested parts, source layers, coordinates and group links are structurally complete.
 */
export function validWorkerDrawings(result: DocInspection): boolean {
  const source = result.drawings
  if (source?.scope !== 'floating-drawing-source' || typeof source.present !== 'boolean'
    || !unsigned(source.mediaCount) || !(source.mediaDeclaredCount === null || unsigned(source.mediaDeclaredCount, 0xfff))
    || source.mediaCount > 0 && source.mediaDeclaredCount === null || !propertyTables(source.defaults) || !records(source.unprojectedRecords)
    || !Array.isArray(source.parts) || source.parts.length !== 2) return false
  const orders: number[] = []
  const valid = source.parts.every((part: DocDrawingPart, index: number) => {
    const story = result.stories?.[index === 0 ? 0 : 2]
    if (!part || part.kind !== (index === 0 ? 'main' : 'header') || !story || !Array.isArray(part.anchors)
      || !Array.isArray(part.shapes) || !records(part.unprojectedRecords)
      || !(part.terminalCp === null || unsigned(part.terminalCp))) return false
    if (part.sourceOrder !== null) {
      if (!unsigned(part.sourceOrder, 1)) return false
      orders.push(part.sourceOrder)
    } else if (part.shapes.length > 0 || part.anchors.length > 0) return false
    const ids = new Set<number>()
    return part.anchors.every((anchor: DocDrawingAnchor, slot: number) => anchor && unsigned(anchor.position) && unsigned(anchor.shapeId)
      && anchor.position >= story.start && anchor.position <= story.end && unsigned(anchor.flags, 0xffff)
      && anchor.bounds !== null && rectangle(anchor.bounds) && unsigned(anchor.textboxCount)
      && (slot === 0 || anchor.position > part.anchors[slot - 1]!.position)
      && part.terminalCp !== null && part.terminalCp > anchor.position - story.start)
      && part.shapes.every((shape: DocDrawingShape) => {
        if (!shape || !unsigned(shape.id) || !unsigned(shape.type, 0xfff) || !unsigned(shape.flags)
          || !(shape.parentId === null || unsigned(shape.parentId) && ids.has(shape.parentId))
          || !rectangle(shape.groupBounds) || !rectangle(shape.childBounds)
          || !records(shape.unprojectedRecords) || !propertyTables(shape.propertyTables)) return false
        ids.add(shape.id)
        return true
      })
  })
  return valid && orders.every((order, index) => orders.indexOf(order) === index)
    && orders.every(order => order < orders.length)
    && (source.present || orders.length === 0 && source.mediaCount === 0 && source.mediaDeclaredCount === null && source.defaults.length === 0 && source.unprojectedRecords.length === 0)
}
