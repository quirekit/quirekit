import { expect, it } from 'vitest'
import { inspectDoc } from '../../inspection'
import { compoundFixture } from '../../testing/compound'
import { drawingAnchors, drawingShape, drawingStreams, labelledDrawing } from '../../testing/drawings/streams'
import { artRecord, pictureBytes, pictureProperties } from '../../testing/pictures/records'

const global = artRecord(0xf000, 0, 15, pictureProperties([[4, 0]], 0xf122))

it('reads exact source layers and header CPs from their labels rather than their physical order', () => {
  const bytes = compoundFixture(drawingStreams(pictureBytes(global, labelledDrawing(1), labelledDrawing(0)),
    drawingAnchors(), drawingAnchors([0], 1125)))
  const before = bytes.slice(), inspection = inspectDoc(bytes, { includeDrawings: true }), result = inspection.drawings!
  expect(result).toMatchObject({ scope: 'floating-drawing-source', present: true, mediaCount: 0,
    defaults: [{ kind: 'tertiary', properties: [{ id: 4, flags: 4, value: 0 }] }] })
  expect(result.parts.map(part => [part.kind, part.sourceOrder, part.terminalCp])).toEqual([['main', 1, 0xffffffff], ['header', 0, 0xffffffff]])
  expect(result.parts[0]!.anchors).toEqual([{ position: 0, shapeId: 1025, bounds: [-100, 200, 900, 1200], flags: 65535, textboxCount: 0xffffffff }])
  expect(result.parts[1]!.anchors[0]!.position).toBe(2)
  expect(result.parts[0]!.shapes.map(shape => [shape.id, shape.parentId, shape.type, shape.flags])).toEqual([[1024, null, 0, 5], [1025, 1024, 75, 0xa00]])
  const properties = result.parts[1]!.shapes[1]!.propertyTables
  expect(properties[0]!.properties[0]!.complex).toHaveLength(30)
  expect(properties[1]!.properties.map(property => [property.id, property.value])).toEqual([[0x391, 1], [0x392, 4]])
  expect(inspection.paragraphs).toBeUndefined(); expect(inspection.characterRuns).toBeUndefined()
  expect(inspectDoc(bytes).drawings).toBeUndefined(); expect(bytes).toEqual(before)
})

it('distinguishes no group, an existing empty group and an empty anchor PLC', () => {
  expect(inspectDoc(compoundFixture(drawingStreams()), { includeDrawings: true }).drawings).toMatchObject({ present: false, defaults: [], parts: [
    { anchors: [], terminalCp: null }, { anchors: [], terminalCp: null }] })
  const bytes = compoundFixture(drawingStreams(artRecord(0xf000, 0, 15, new Uint8Array()), drawingAnchors([], 0, 0)))
  expect(inspectDoc(bytes, { includeDrawings: true }).drawings).toMatchObject({ present: true, parts: [
    { anchors: [], terminalCp: 0 }, { anchors: [], terminalCp: null }] })
})

it('retains a stale declared media count without truncating or inventing physical source slots', () => {
  const store = artRecord(0xf001, 2, 15, artRecord(0xf007, 6, 2, new Uint8Array(36)))
  const bytes = compoundFixture(drawingStreams(artRecord(0xf000, 0, 15, store)))
  const result = inspectDoc(bytes, { includeDrawings: true })
  expect(result.drawings).toMatchObject({ present: true, mediaCount: 1, mediaDeclaredCount: 2 })
  expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'drawing-media-count-variant' }))
})

it('keeps nested group ownership instead of flattening its local coordinate space', () => {
  const nested = artRecord(0xf003, 0, 15, pictureBytes(drawingShape(2000, true), drawingShape(2001)))
  const bytes = compoundFixture(drawingStreams(pictureBytes(global, labelledDrawing(0, nested))))
  const shapes = inspectDoc(bytes, { includeDrawings: true }).drawings!.parts[0]!.shapes
  expect(shapes.map(shape => [shape.id, shape.parentId])).toEqual([[1024, null], [1025, 1024], [2000, 1024], [2001, 2000]])
})

it('rejects a group without a first group shape and counts shape wrappers in the depth limit', () => {
  const malformed = pictureBytes(global, Uint8Array.of(0), artRecord(0xf002, 0, 15, artRecord(0xf003, 0, 15, drawingShape(1025))))
  expect(() => inspectDoc(compoundFixture(drawingStreams(malformed)), { includeDrawings: true }))
    .toThrow(expect.objectContaining({ code: 'invalid-drawing-data' }))
  const bytes = compoundFixture(drawingStreams(pictureBytes(global, labelledDrawing(0))))
  expect(() => inspectDoc(bytes, { includeDrawings: true, limits: { maxDrawingDepth: 2 } }))
    .toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})

it.each(['label', 'duplicate', 'terminal', 'anchors', 'truncated', 'missing'] as const)('refuses malformed source %s rather than returning a partial graph', kind => {
  let content = pictureBytes(global, labelledDrawing(0)), anchors = drawingAnchors()
  if (kind === 'label') content = pictureBytes(global, labelledDrawing(2))
  if (kind === 'duplicate') content = pictureBytes(content, labelledDrawing(0))
  if (kind === 'terminal') anchors = drawingAnchors([0], 1025, 0)
  if (kind === 'anchors') anchors = drawingAnchors([0, 0])
  if (kind === 'truncated') content = content.subarray(0, content.length - 1)
  const bytes = compoundFixture(drawingStreams(kind === 'missing' ? undefined : content, anchors))
  expect(() => inspectDoc(bytes, { includeDrawings: true })).toThrow(expect.objectContaining({ code: 'invalid-drawing-data' }))
})

it.each([{ maxDrawings: 1 }, { maxDrawingDepth: 1 }, { maxDrawingPropertyBytes: 29 }, { maxPropertyOperations: 2 }])('enforces shared work/allocation limits %j', limits => {
  const bytes = compoundFixture(drawingStreams(pictureBytes(global, labelledDrawing(0), labelledDrawing(1))))
  expect(() => inspectDoc(bytes, { includeDrawings: true, limits })).toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})

it('rejects non-boolean opt-in values and unsafe policy limits', () => {
  const bytes = compoundFixture(drawingStreams())
  expect(() => inspectDoc(bytes, { includeDrawings: 'yes' as unknown as boolean })).toThrow(expect.objectContaining({ code: 'invalid-input' }))
  expect(() => inspectDoc(bytes, { includeDrawings: true, limits: { maxDrawingDepth: 257 } })).toThrow(expect.objectContaining({ code: 'invalid-input' }))
})
