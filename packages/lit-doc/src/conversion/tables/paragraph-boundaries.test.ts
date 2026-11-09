import { expect, it } from 'vitest'
import { tableBoundaryDocument } from '../../testing/tables/boundaries'
import { readDocumentSource } from '../../word/document/read'
import { createConversionSource } from '../source/read'
import { createDocxSourcePlan } from '../plan'

it.each(['nested-cell', 'row-end', 'missing', 'definition'] as const)('keeps a rich source after paragraph boundary handling %s', kind => {
  const bytes = tableBoundaryDocument(kind), original = bytes.slice()
  const result = createDocxSourcePlan(bytes)
  expect(result.report.recovery).toBeUndefined()
  const source = createConversionSource(readDocumentSource(bytes, {}), true)
  if (kind === 'missing') {
    expect(source.paragraphFormats.map(format => format.alignment.value)).toEqual([0, 1])
    expect(result.report.diagnostics).toContainEqual(expect.objectContaining({
      code: 'paragraph-properties-defaulted', kind: 'loss', source: 'properties',
    }))
    expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'strict' })).toThrow(expect.objectContaining({ code: 'invalid-paragraph-data' }))
  } else {
    expect(source.tables.map(table => table.rows.map(row => row.cells.length)))
      .toEqual(kind === 'nested-cell' ? [[1], [1]] : kind === 'definition' ? [[2]] : [[1]])
    if (kind === 'definition') expect(result.report.diagnostics).toContainEqual(expect.objectContaining({
      code: 'table-definition-length-compatibility', kind: 'compatibility', source: 'properties',
    }))
  }
  expect(bytes).toEqual(original)
})
