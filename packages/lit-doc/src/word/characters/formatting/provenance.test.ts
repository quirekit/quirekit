import { describe, expect, it } from 'vitest'
import { resolveLimits } from '../../../binary/limits'
import { createPropertyReader } from '../../properties/reader'
import { applyCharacterLayers } from './apply'
import { defaultCharacterFormat } from './defaults'
import type { CharacterPropertyKey, CharacterStyleResolver, CharacterToggleModes } from './types'

/** @param opcode - Source property. @param bytes - Exact operand. @returns Bounded operation. */
function op(opcode: number, ...bytes: number[]) { return { opcode, operand: Uint8Array.of(...bytes) } }

const baseline = defaultCharacterFormat(0, { ascii: 0, other: 0, eastAsia: 0, complex: null })
const styles: CharacterStyleResolver = {
  paragraph: () => baseline,
  character: (paragraph, index) => ({ ...paragraph, characterStyleIndex: index, bold: true }),
}

describe('direct character field provenance', () => {
  it('records explicit false and zero even when equal to the inherited values', () => {
    const fields = new Set<CharacterPropertyKey>()
    const result = applyCharacterLayers(baseline, [[op(0x0835, 0), op(0x4a4f, 0, 0)]], styles,
      createPropertyReader(undefined, resolveLimits({})), fields)
    expect(result.bold).toBe(false)
    expect(result.fontIndexes.ascii).toBe(0)
    expect([...fields]).toEqual(['bold', 'font:ascii'])
  })

  it('drops superseded direct fields at resets and retains the normative preserved fields', () => {
    const fields = new Set<CharacterPropertyKey>()
    const result = applyCharacterLayers(baseline, [[op(0x0835, 1), op(0x2a0c, 7), op(0x085a, 1),
      op(0x4a30, 5, 0), op(0x2a33, 0), op(0x4a43, 20, 0)]], styles,
    createPropertyReader(undefined, resolveLimits({})), fields)
    expect(result).toMatchObject({ bold: false, highlight: 7, rightToLeft: true, characterStyleIndex: 10 })
    expect([...fields].sort()).toEqual(['fontSizeHalfPoints', 'highlight', 'rightToLeft'])
  })
  it('retains the last relative-toggle identity and clears only superseded modes at resets', () => {
    const fields = new Set<CharacterPropertyKey>(); const modes: CharacterToggleModes = new Map()
    const result = applyCharacterLayers(baseline, [[op(0x0835, 1), op(0x0835, 0x80), op(0x085a, 1), op(0x2a33, 0), op(0x0836, 0x81)]],
      styles, createPropertyReader(undefined, resolveLimits({})), fields, modes)
    expect(result).toMatchObject({ bold: false, italic: true, rightToLeft: true })
    expect([...modes]).toEqual([['rightToLeft', 1], ['italic', 0x81]])
    expect([...fields]).toEqual(['rightToLeft', 'italic'])
  })

  it.each([0, 1, 2, 255].flatMap(hint => [0x4a30, 0x2a33].map(reset => ({ hint, reset }))))
  ('retains script hint $hint and its direct provenance across reset $reset', ({ hint, reset }) => {
    const fields = new Set<CharacterPropertyKey>()
    const operation = reset === 0x4a30 ? op(reset, 5, 0) : op(reset, 0)
    const result = applyCharacterLayers(baseline, [[op(0x286f, hint), op(0x4a43, 40, 0), operation]],
      styles, createPropertyReader(undefined, resolveLimits({})), fields)
    expect(result.scriptHint).toBe(hint)
    expect(result.fontSizeHalfPoints).toBe(20)
    expect(result.characterStyleIndex).toBe(reset === 0x4a30 ? 5 : 10)
    expect([...fields]).toEqual(['scriptHint'])
  })

  it('lets a later hint replace the retained value without manufacturing a direct hint from defaults', () => {
    const fields = new Set<CharacterPropertyKey>()
    const reader = createPropertyReader(undefined, resolveLimits({}))
    expect(applyCharacterLayers(baseline, [[op(0x2a33, 0)]], styles, reader, fields).scriptHint).toBe(0)
    expect(fields.has('scriptHint')).toBe(false)
    const result = applyCharacterLayers(baseline, [[op(0x286f, 2), op(0x4a30, 5, 0)],
      [op(0x286f, 1), op(0x2a33, 0), op(0x286f, 255)]], styles, reader, fields)
    expect(result.scriptHint).toBe(255)
    expect([...fields]).toEqual(['scriptHint'])
  })

})
