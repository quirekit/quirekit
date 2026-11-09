import { expect, it, vi } from 'vitest'
import { fieldDocument } from '../../../testing/fields/conversion'
import { floatingPictureFixture } from '../../../testing/drawings/pictures'
import { readConversionSource } from '../../../conversion/source/read'
import * as drawingSource from '../read'
import { createFloatingPictureReader } from './document'

it('bounds repeated source-role lookup by unique shapes rather than repeatedly scanning property layers', () => {
  const source = readConversionSource(fieldDocument('A\u0008B\r', { drawings: floatingPictureFixture() }), {})
  let reads = 0
  const original = drawingSource.readDrawingData
  const spy = vi.spyOn(drawingSource, 'readDrawingData').mockImplementation((...args) => {
    const result = original(...args)
    for (const part of result.source.parts) for (const shape of part.shapes) {
      const properties = shape.propertyTables
      Object.defineProperty(shape, 'propertyTables', { get: () => { reads++; return properties } })
    }
    return result
  })
  try {
    const reader = createFloatingPictureReader(source, { data: source.data, word: source.word, reader: source.context.reader,
      limits: source.limits, decodedBytes: 0, errorCode: 'invalid-picture-data', propertyBytes: { remaining: source.limits.maxDrawingPropertyBytes } }, [])
    expect(reader.isTextbox(1)).toBe(false)
    const first = reads
    for (let index = 0; index < 100; index++) expect(reader.isTextbox(1)).toBe(false)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(reads).toBe(first)
  } finally { spy.mockRestore() }
})
