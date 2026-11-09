import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { OfficeArtProperty, OfficeArtReadContext, OfficeArtRecord } from './types'
import { officeArtArrayProperties } from './arrays'

/**
 * Resolves the physical complex extent, keeping an array's original declared operand unchanged.
 * @param view - Complete fixed and complex table payload.
 * @param offset - First byte of this complex value.
 * @param id - Format property number.
 * @param declared - Original byte operand.
 * @returns Physical byte count, including an excluded array header when required.
 */
function complexExtent(view: ByteView, offset: number, id: number, declared: number): number {
  if (declared === 0 || !officeArtArrayProperties.has(id)) return declared
  view.check(offset, 6)
  const signed = view.u16(offset + 4) << 16 >> 16
  const width = signed < 0 ? -signed >>> 2 : signed
  return view.u16(offset) * width === declared ? declared + 6 : declared
}

/**
 * Reads physical property storage without flattening global/default/shape authority or interpreting geometry.
 * @param record - Complete primary, secondary or tertiary property table.
 * @param context - Shared work and complex-allocation budgets.
 * @param inlineBlipRoles - Only inline PICF roles use encounter-order file blocks instead of complex bytes.
 * @returns Complete source properties in original table order.
 */
export function readOfficeArtProperties(record: OfficeArtRecord, context: OfficeArtReadContext,
  inlineBlipRoles?: ReadonlySet<number>): OfficeArtProperty[] {
  requireDoc(record.version === 3, context.errorCode, 'Invalid OfficeArt property table version')
  context.reader.consume(record.instance)
  const view = new ByteView(record.data, context.errorCode), result: OfficeArtProperty[] = []
  let offset = record.instance * 6
  view.check(0, offset)
  for (let index = 0; index < record.instance; index++) {
    const flags = view.u16(index * 6), id = flags & 0x3fff, value = view.u32(index * 6 + 2)
    const property: OfficeArtProperty = { id, flags, value }
    if (flags & 0x8000 && !inlineBlipRoles?.has(id)) {
      const length = complexExtent(view, offset, id, value)
      view.check(offset, length)
      requireDoc(length <= context.propertyBytes.remaining, 'limit-exceeded', 'OfficeArt complex property byte limit exceeded')
      context.propertyBytes.remaining -= length
      property.complex = view.slice(offset, length).slice()
      offset += length
    }
    result.push(property)
  }
  requireDoc(offset === record.data.length, context.errorCode, 'OfficeArt property table has unclaimed bytes')
  return result
}
