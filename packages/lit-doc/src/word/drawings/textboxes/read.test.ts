import { expect, it } from 'vitest'
import { textboxDocument } from '../../../testing/textboxes/conversion'
import { readConversionSource } from '../../../conversion/source/read'
import { readDrawingData } from '../read'
import { readFloatingTextbox } from './read'

it('refuses self-linked frame aliases before using a matching ClientAnchor to choose one of multiple FSPAs', () => {
  const source = readConversionSource(textboxDocument([[138, 1026]]), {}), data = readDrawingData(source, source.context.reader, [])
  const part = data.source.parts[0]!, shape = part.shapes.find(shape => shape.id === 1026)!, parent = part.shapes.find(shape => shape.id === 1024)!
  const context = { data: source.data, word: source.word, reader: source.context.reader, limits: source.limits, decodedBytes: 0,
    errorCode: 'invalid-picture-data' as const, propertyBytes: { remaining: source.limits.maxDrawingPropertyBytes } }
  expect(() => readFloatingTextbox({ part, shape, parent, anchor: part.anchors[0]!, anchorIndex: 0, anchorReferences: 2, rank: 1 }, data, context))
    .toThrow(expect.objectContaining({ code: 'unsupported-picture', message: expect.stringContaining('unique original FSPA') }))
})
