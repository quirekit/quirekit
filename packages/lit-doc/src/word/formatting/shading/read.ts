import { ByteView } from '../../../binary/bytes'
import { requireDoc } from '../../../errors'
import type { PropertyOperation } from '../../properties/types'
import { colorRefValue, palette } from '../color'
import type { DocShading } from './types'

/** @returns Explicit nil, which blocks an inherited paragraph background. */
function nil(): DocShading { return { pattern: 0xffff, foreground: 'auto', background: 'auto' } }

/** @param operation - One bounded legacy or modern shading operation. @returns Validated source semantics, without guessing an OOXML pattern. */
export function readDocShading(operation: PropertyOperation): DocShading {
  const { operand, opcode } = operation
  requireDoc(operand.length === (opcode === 0x442d ? 2 : 11) && (opcode === 0x442d || operand[0] === 10),
    'invalid-formatting-data', 'Invalid paragraph shading operand length')
  const value = new ByteView(opcode === 0x442d ? operand : operand.subarray(1), 'invalid-formatting-data')
  if (opcode === 0x442d) {
    const bits = value.u16(0)
    if (bits === 0xffff) return nil()
    const foreground = bits & 31, background = bits >>> 5 & 31
    requireDoc(foreground <= 16 && background <= 16, 'invalid-formatting-data', 'Invalid paragraph shading palette index')
    return { pattern: bits >>> 10, foreground: palette[foreground]!, background: palette[background]! }
  }
  const foreground = value.u32(0), background = value.u32(4), pattern = value.u16(8)
  for (const color of [foreground, background]) requireDoc(color >>> 24 === 0 || color >>> 24 === 255,
    'invalid-formatting-data', 'Invalid paragraph shading automatic color flag')
  if (pattern === 0xffff || pattern === 0 && foreground === 0xffffffff && background === 0xffffffff) return nil()
  return { pattern, foreground: colorRefValue(foreground), background: colorRefValue(background) }
}

/** @param operations - One source layer, including style-reset boundaries. @returns Segments where complete modern shading supersedes palette compatibility data. */
export function modernShadingSegments(operations: readonly PropertyOperation[]): ReadonlySet<number> {
  const segments = new Set<number>(); let segment = 0
  for (const operation of operations) {
    if (operation.opcode === 0x4600) segment++
    if (operation.opcode === 0xc64d) segments.add(segment)
  }
  return segments
}

/** @param value - Worker structured-clone field. @returns Whether the complete source shading or explicit inherited absence is valid. */
export function validDocShading(value: unknown): value is DocShading | null {
  if (value === null) return true
  if (!value || typeof value !== 'object') return false
  const shading = value as Partial<DocShading>
  return Number.isSafeInteger(shading.pattern) && shading.pattern! >= 0 && shading.pattern! <= 65535
    && typeof shading.foreground === 'string' && /^(?:auto|[0-9A-F]{6})$/u.test(shading.foreground)
    && typeof shading.background === 'string' && /^(?:auto|[0-9A-F]{6})$/u.test(shading.background)
}
