import { expect, it } from 'vitest'
import { resolveLimits } from '../../binary/limits'
import { operation as op } from '../../testing/formatting'
import type { DocReadDiagnostic } from '../../types'
import { createPropertyReader } from './reader'

it('keeps direct, paragraph-character and character-style caches separate while bounding compatibility diagnostics', () => {
  const diagnostics: DocReadDiagnostic[] = [], reader = createPropertyReader(undefined, resolveLimits({}), diagnostics)
  const bytes = Uint8Array.from([...op(0x2a0c, 7), ...op(0x286f, 1), ...op(0x0835, 1)])
  const direct = reader.read(bytes), paragraph = reader.read(bytes, 'paragraph-character'), character = reader.read(bytes, 'character')
  expect(direct.map(item => item.opcode)).toEqual([0x2a0c, 0x286f, 0x0835])
  expect(paragraph).toEqual(direct)
  expect(character.map(item => item.opcode)).toEqual([0x286f, 0x0835])
  expect(reader.read(bytes, 'character')).toBe(character)
  expect(reader.read(bytes, 'paragraph-character')).toBe(paragraph)
  reader.read(bytes.slice(), 'character'); reader.read(bytes.slice(), 'paragraph-character')
  expect(diagnostics.map(item => item.code).sort()).toEqual([
    'character-style-highlight-ignored', 'legacy-paragraph-style-highlight', 'legacy-style-script-hint',
  ])
  expect(() => reader.read(bytes, 'paragraph')).toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
})

it.each(['character', 'paragraph-character'] as const)('rejects unrelated forbidden operations, invalid values and truncation in %s', style => {
  for (const bytes of [op(0x085a, 1), op(0x4a30, 15, 0), op(0x2a33, 0), op(0x286f, 3), op(0x2a0c, 17), [0x0c, 0x2a]])
    expect(() => createPropertyReader(undefined, resolveLimits({})).read(Uint8Array.from(bytes), style))
      .toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
})

it('charges ignored style highlights before allocation and does not reuse another context cache', () => {
  const bytes = Uint8Array.from(op(0x2a0c, 0))
  const reader = createPropertyReader(undefined, resolveLimits({ limits: { maxPropertyOperations: 1 } }))
  expect(reader.read(bytes, 'character')).toEqual([])
  expect(() => reader.read(bytes, 'paragraph-character')).toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})
