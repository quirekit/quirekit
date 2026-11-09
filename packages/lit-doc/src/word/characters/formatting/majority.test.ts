import { expect, it } from 'vitest'
import { resolveLimits } from '../../../binary/limits'
import { createPropertyReader } from '../../properties/reader'
import type { PropertyOperation } from '../../properties/types'
import type { DocCharacterBaseFormat } from '../types'
import { applyCharacterLayers } from './apply'
import { copyCharacterFormat, defaultCharacterFormat } from './defaults'
import type { CharacterPropertyKey, CharacterStyleResolver, CharacterToggleModes } from './types'

/** @param opcode - Source property. @param operand - Exact bounded operand. @returns Independently supplied operation. */
function op(opcode: number, ...operand: number[]): PropertyOperation { return { opcode, operand: Uint8Array.of(...operand) } }
/** @param operations - Ordered comparison properties. @returns Counted original selector, not a computed expected value. */
function majority(...operations: PropertyOperation[]): PropertyOperation {
  const bytes = operations.flatMap(operation => [operation.opcode & 255, operation.opcode >>> 8, ...operation.operand])
  return op(0xca47, bytes.length, ...bytes)
}

const defaults = defaultCharacterFormat(0, { ascii: 0, other: 0, eastAsia: 0, complex: null })

/** @param operations - Ordered source direct/piece changes. @param edits - Independent paragraph style values. @param fontName - Optional source name authority. @param maxPropertyOperations - Shared parse/application ceiling. @returns Completed settings plus their surviving direct provenance. */
function run(operations: PropertyOperation[], edits: Partial<DocCharacterBaseFormat> = {}, fontName?: (index: number) => string, maxPropertyOperations?: number) {
  const paragraph = { ...copyCharacterFormat(defaults), ...edits }
  const styles: CharacterStyleResolver = { paragraph: () => paragraph,
    character: (base, index) => ({ ...copyCharacterFormat(base), characterStyleIndex: index, italic: true }) }
  const fields = new Set<CharacterPropertyKey>(), modes: CharacterToggleModes = new Map()
  const limits = resolveLimits(maxPropertyOperations === undefined ? {} : { limits: { maxPropertyOperations } })
  const value = applyCharacterLayers(paragraph, [operations], styles, createPropertyReader(undefined, limits),
    fields, modes, [], { defaults, fontName })
  return { value, fields: [...fields], modes: [...modes], paragraph }
}

it('resets only matching current values to the paragraph style and removes obsolete inverse provenance', () => {
  const result = run([op(0x0835, 0x81), op(0x4a43, 28, 0), op(0x486d, 9, 4),
    majority(op(0x4a43, 28, 0), op(0x486d, 25, 4))], { bold: true, fontSizeHalfPoints: 28, language: 0x419 })
  expect(result.value).toMatchObject({ bold: true, fontSizeHalfPoints: 28, language: 0x409 })
  expect(result.fields).toEqual(['language']); expect(result.modes).toEqual([])
})

it('uses selector defaults rather than paragraph inheritance and allows later source writes', () => {
  const result = run([op(0x0835, 0), majority(), op(0x0836, 0)], { bold: true, italic: true })
  expect(result.value).toMatchObject({ bold: true, italic: false })
  // The later explicit italic clear must override the selection, independently
  // of the paragraph's true value and the earlier default selector.
  expect(result.value.italic).toBe(false)
  expect(result.fields).toEqual(['italic'])
})

it('ignores semantic resetting for a nondefault character style while still validating its selector', () => {
  const result = run([op(0x4a30, 15, 0), op(0x0835, 0), majority()], { bold: true })
  expect(result.value).toMatchObject({ characterStyleIndex: 15, bold: false, italic: true })
  expect(result.fields).toEqual(['bold'])
  expect(() => run([op(0x4a30, 15, 0), majority(op(0x0835, 2))])).toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
})

it('keeps the true/true noProof exception and its direct toggle identity', () => {
  const result = run([op(0x0875, 1), majority(op(0x0875, 1))])
  expect(result.value.noProof).toBe(true); expect(result.fields).toEqual(['noProof']); expect(result.modes).toEqual([['noProof', 1]])
  expect(run([op(0x0875, 0), majority()], { noProof: true }).value.noProof).toBe(true)
})

it.each(['Times New Roman', 'TIMES NEW ROMAN', 'Source Face'])('uses the declared East Asian target font %s for the exact exception', name => {
  const calls: number[] = []
  const result = run([op(0x4a50, 1, 0), majority(op(0x4a50, 1, 0))], {}, index => { calls.push(index); return name })
  expect(calls).toEqual([0])
  expect(result.value.fontIndexes.eastAsia).toBe(name.toLowerCase() === 'times new roman' ? 1 : 0)
  expect(result.fields.includes('font:eastAsia')).toBe(name.toLowerCase() === 'times new roman')
})

it('keeps font queries lazy and refuses a needed but unavailable source font name', () => {
  expect(run([majority()], {}, () => { throw new Error('Unexpected name query') }).value.fontIndexes.eastAsia).toBe(0)
  expect(() => run([op(0x4a50, 1, 0), majority(op(0x4a50, 1, 0))])).toThrow(expect.objectContaining({ code: 'unsupported-formatting' }))
})

it('compares palette and COLORREF by color while distinguishing automatic from black', () => {
  const red = { encoding: 'colorref' as const, value: 255 }
  expect(run([op(0x2a42, 2), majority(op(0x6870, 0, 0, 255, 0))], { color: red }).value.color).toEqual(red)
  expect(run([op(0x2a42, 1), majority(op(0x2a42, 0))], { color: red }).value.color).toEqual({ encoding: 'palette', value: 1 })
})

it('retains fields outside the normative selection instead of applying a whole clear', () => {
  const result = run([op(0x2a0c, 7), op(0x085a, 1), op(0x286f, 2), op(0x4852, 90, 0), op(0x484b, 20, 0), majority()])
  expect(result.value).toMatchObject({ highlight: 7, rightToLeft: true, scriptHint: 2, scalePercent: 90, kerningHalfPoints: 20 })
  expect(result.fields).toEqual(['highlight', 'rightToLeft', 'scriptHint', 'scalePercent', 'kerningHalfPoints'])
})

it.each([majority(op(0x4a61, 24, 0)), majority(op(0x4a5e, 1, 0)), majority(op(0x2859, 1)),
  majority(op(0x4a30, 15, 0)), majority(op(0x2a33, 0)), majority(majority()), majority(op(0x2405, 1))].map(operation => ({ operation })))(
  'keeps unresolved automatic comparisons and unsupported compound selectors refused: %j', ({ operation }) => {
    expect(() => run([operation])).toThrow(expect.objectContaining({ code: 'unsupported-formatting' }))
  })

it('keeps prior unmodeled text effects outside the majority closure', () => {
  expect(() => run([op(0x2859, 1), majority()])).toThrow(expect.objectContaining({ code: 'unsupported-formatting' }))
})

it.each([op(0xca47), op(0xca47, 1), op(0xca47, 0, 0), op(0xca47, 1, 0x35)].map(operation => ({ operation })))(
  'rejects an inconsistent or truncated selector: %j', ({ operation }) => {
    expect(() => run([operation])).toThrow(expect.objectContaining({ code: 'invalid-formatting-data' }))
  })

it('charges selector parsing/application and does not mutate paragraph or caller bytes', () => {
  const operation = majority(op(0x0835, 0)), before = operation.operand.slice()
  const result = run([op(0x0835, 0), operation], { bold: true })
  expect(result.paragraph.bold).toBe(true); expect(operation.operand).toEqual(before)
  expect(() => run([operation], {}, undefined, 1)).toThrow(expect.objectContaining({ code: 'limit-exceeded' }))
})
