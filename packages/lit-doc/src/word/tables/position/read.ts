import { ByteView } from '../../../binary/bytes'
import { requireDoc } from '../../../errors'
import type { PropertyOperation, PropertyReader } from '../../properties/types'
import { tableBoolean } from '../formatting/values'
import type { DocTableHorizontalPosition, DocTablePosition, DocTableVerticalPosition } from './types'

export const tablePositionOpcodes = new Set([0x360d, 0x940e, 0x940f, 0x9410, 0x9411, 0x941e, 0x941f, 0x3465])
export const paragraphFrameOpcodes = new Set([0x261b, 0x8418, 0x8419, 0x841a, 0x442b, 0x442c,
  0x2423, 0x842e, 0x842f, 0x2430, 0x2462, 0x443a])
const horizontalAlignments = new Map<number, DocTableHorizontalPosition>([
  [0, { alignment: 'left' }], [-4, { alignment: 'center' }], [-8, { alignment: 'right' }],
  [-12, { alignment: 'inside' }], [-16, { alignment: 'outside' }],
])
const verticalAlignments = new Map<number, DocTableVerticalPosition>([
  [0, { alignment: 'inline' }], [-4, { alignment: 'top' }], [-8, { alignment: 'center' }],
  [-12, { alignment: 'bottom' }], [-16, { alignment: 'inside' }], [-20, { alignment: 'outside' }],
])

/**
 * Resolves one complete table-local tuple before table identity or XML allocation.
 * @param operations - Source row's ordered properties, after indirect expansion.
 * @param reader - Shared document property-work budget.
 * @returns A normalized active tuple, or no absolute placement for source defaults.
 */
export function readTablePosition(operations: readonly PropertyOperation[], reader: PropertyReader): DocTablePosition | undefined {
  let anchors: number | undefined
  let horizontal = 0
  let vertical = 0
  let allowOverlap = true
  const distances = { leftFromText: 0, rightFromText: 0, topFromText: 0, bottomFromText: 0 }
  reader.consume(operations.length)
  for (const { opcode, operand } of operations) {
    if (!tablePositionOpcodes.has(opcode)) continue
    const value = new ByteView(operand, 'invalid-table-data')
    if (opcode === 0x360d) anchors = value.u8(0) & 0xf0
    else if (opcode === 0x940e) horizontal = encodedDistance(value.u16(0))
    else if (opcode === 0x940f) vertical = encodedDistance(value.u16(0))
    else if (opcode === 0x3465) allowOverlap = !tableBoolean(value.u8(0))
    else {
      const distance = value.u16(0)
      requireDoc(distance <= 31680, 'invalid-table-data', 'Table text clearance exceeds its valid range')
      if (opcode === 0x9410) distances.leftFromText = distance
      if (opcode === 0x941e) distances.rightFromText = distance
      if (opcode === 0x9411) distances.topFromText = distance
      if (opcode === 0x941f) distances.bottomFromText = distance
    }
  }
  const defaultPlacement = horizontal === 0 && vertical === 0 && Object.values(distances).every(value => value === 0)
  const defaultValues = defaultPlacement && allowOverlap
  if (anchors === undefined && defaultPlacement) {
    requireDoc(allowOverlap, 'unsupported-table', 'Standalone inline-table overlap metadata requires a separate projection')
    return undefined
  }
  // None anchors carry no absolute coordinate system. Admit the complete empty
  // reset only; mixed None axes or retained nondefault positions need separate evidence.
  const horizontalAnchor = (anchors ?? 0) >>> 6
  const verticalAnchor = ((anchors ?? 0) >>> 4) & 3
  if (horizontalAnchor === 3 || verticalAnchor === 3) {
    requireDoc(horizontalAnchor === 3 && verticalAnchor === 3 && defaultValues,
      'unsupported-table', 'Mixed or nonempty None table anchors require separate interpretation')
    return undefined
  }
  return {
    horizontalAnchor: (['column', 'margin', 'page'] as const)[horizontalAnchor]!,
    verticalAnchor: (['margin', 'page', 'paragraph'] as const)[verticalAnchor]!,
    horizontal: { ...(horizontalAlignments.get(horizontal) ?? { offset: horizontal - 1 }) },
    vertical: { ...(verticalAlignments.get(vertical) ?? { offset: vertical - 1 }) },
    ...distances, allowOverlap,
  }
}

/** @param raw - Stored signed plus-one word, also containing alignment sentinels. @returns Bounded encoded value before sentinel interpretation. */
function encodedDistance(raw: number): number {
  const value = raw >= 0x8000 ? raw - 0x10000 : raw
  requireDoc(value >= -31679 && value <= 31681, 'invalid-table-data', 'Encoded table position exceeds its valid range')
  return value
}
