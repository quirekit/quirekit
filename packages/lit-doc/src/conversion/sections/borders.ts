import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { PropertyOperation } from '../../word/properties/types'
import { colorRefValue, palette } from '../properties/values'
import type { ProjectionContext } from '../xml/types'

const sides = ['top', 'left', 'bottom', 'right'] as const
const lineStyles: ReadonlyMap<number, string> = new Map([
  [0, 'none'], [1, 'single'], [3, 'double'], [6, 'dotted'], [7, 'dashed'], [8, 'dotDash'], [9, 'dotDotDash'],
  [10, 'triple'], [11, 'thinThickSmallGap'], [12, 'thickThinSmallGap'], [13, 'thinThickThinSmallGap'],
  [14, 'thinThickMediumGap'], [15, 'thickThinMediumGap'], [16, 'thinThickThinMediumGap'],
  [17, 'thinThickLargeGap'], [18, 'thickThinLargeGap'], [19, 'thinThickThinLargeGap'],
  [20, 'wave'], [21, 'doubleWave'], [22, 'dashSmallGap'], [23, 'dashDotStroked'], [24, 'threeDEmboss'],
  [25, 'threeDEngrave'], [26, 'outset'], [27, 'inset'],
])

/** @param opcode - Complete section opcode. @returns Whether the page-border projector owns this operation. */
export function isSectionPageBorderOperation(opcode: number): boolean {
  return opcode === 0x522f || opcode >= 0x702b && opcode <= 0x702e || opcode >= 0xd234 && opcode <= 0xd237
}

/**
 * Keeps generation precedence separate from source order, retaining the section's own coordinates.
 * @param operations - Independently budgeted SEPX operations.
 * @param context - Existing bounded XML and diagnostic owner.
 * @param source - Located source section.
 * @returns Ordinary page borders, or no element when only inert group settings exist.
 */
export function projectSectionPageBorders(operations: readonly PropertyOperation[], context: ProjectionContext,
  source: string): DocxXmlElementPlan | undefined {
  const older = new Map<number, PropertyOperation>(), newer = new Map<number, PropertyOperation>()
  let group = 0
  // Collect each generation independently: newer RGB BRCs override palette BRCs even if stored first.
  for (const operation of operations) {
    if (!isSectionPageBorderOperation(operation.opcode)) continue
    const view = new ByteView(operation.operand, 'invalid-formatting-data')
    if (operation.opcode === 0x522f) {
      requireDoc(operation.operand.length === 2, 'invalid-formatting-data', 'Invalid page-border group length')
      group = view.u16(0)
      requireDoc((group & 7) <= 2 && (group >>> 3 & 3) <= 1 && (group >>> 5 & 7) <= 1 && group >>> 8 === 0,
        'invalid-formatting-data', 'Invalid page-border group settings')
    } else if (operation.opcode < 0xd234) {
      requireDoc(operation.operand.length === 4, 'invalid-formatting-data', 'Invalid old page-border record length')
      older.set(operation.opcode - 0x702b, operation)
    } else {
      requireDoc(operation.operand.length === 9 && view.u8(0) === 8, 'invalid-formatting-data', 'Invalid page-border record length')
      newer.set(operation.opcode - 0xd234, operation)
    }
  }
  const children: DocxXmlElementPlan[] = []
  for (const [index, side] of sides.entries()) {
    const operation = newer.get(index) ?? older.get(index)
    if (!operation) continue
    children.push(context.element(side, borderAttributes(operation)))
  }
  if (!children.length) return undefined
  context.diagnose({ code: 'page-borders-host-limit', kind: 'host-limit', source,
    message: 'Section page borders survive LitAST and Classic editing/export; Classic does not yet render or author them.' })
  return context.element('pgBorders', { display: ['allPages', 'firstPage', 'notFirstPage'][group & 7]!,
    zOrder: group & 8 ? 'back' : 'front', offsetFrom: group & 32 ? 'page' : 'text' }, children)
}

/**
 * Decodes only the effective border; source reserved bits do not become drawing effects.
 * @param operation - Effective old palette or new RGB border record.
 * @returns Exact ordinary OOXML border fields, retaining automatic color.
 */
function borderAttributes(operation: PropertyOperation): Record<string, string | number> {
  const view = new ByteView(operation.operand, 'invalid-formatting-data'), modern = operation.opcode >= 0xd234
  const offset = modern ? 5 : 0, width = view.u8(offset), style = view.u8(offset + 1)
  requireDoc(lineStyles.has(style), 'unsupported-formatting', 'Unsupported page-border style')
  requireDoc(modern || style <= 25, 'invalid-formatting-data', 'Invalid old page-border style')
  requireDoc(width <= 96, 'unsupported-formatting', 'Unsupported page-border width')
  const flags = view.u8(modern ? 7 : 3)
  let color: string
  if (modern) {
    requireDoc(view.u8(4) === 0 || view.u8(4) === 255, 'invalid-formatting-data', 'Invalid page-border automatic color')
    color = colorRefValue(view.u32(1))
  } else {
    requireDoc(view.u8(2) <= 16, 'invalid-formatting-data', 'Invalid page-border palette color')
    color = palette[view.u8(2)]!
  }
  return { val: lineStyles.get(style)!, sz: Math.max(2, width), space: flags & 31, color,
    shadow: flags & 32 ? '1' : '0', frame: flags & 64 ? '1' : '0' }
}
