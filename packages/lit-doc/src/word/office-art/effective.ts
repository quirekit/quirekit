import { requireDoc } from '../../errors'
import type { PropertyReader } from '../properties/types'
import type { OfficeArtEffectiveProperties, OfficeArtProperty } from './types'

/**
 * Compiles source-ordered scalar writes while resolving boolean use bits independently.
 * @param properties - Global defaults followed by the occurrence's original layers.
 * @param reader - Shared work budget, including this additional interpretation phase.
 * @returns Effective accessors and explicit unconsumed source field identities.
 */
export function compileOfficeArtProperties(properties: readonly OfficeArtProperty[], reader: PropertyReader): OfficeArtEffectiveProperties {
  reader.consume(properties.length)
  const values = new Map<number, OfficeArtProperty[]>(), used = new Set<number>(), booleanBits = new Map<number, number>()
  for (const property of properties) {
    const writes = values.get(property.id) ?? []
    writes.push(property); values.set(property.id, writes)
  }
  return {
    property(id) { used.add(id); return values.get(id)?.at(-1) },
    scalar(id, fallback) {
      const property = this.property(id)
      requireDoc(!property?.complex, 'invalid-picture-data', 'Scalar drawing property contains complex data')
      return property ? property.value | 0 : fallback
    },
    flag(id, bit, fallback) {
      used.add(id)
      const mask = 2 ** bit
      booleanBits.set(id, (booleanBits.get(id) ?? 0) | mask)
      const writes = values.get(id) ?? []
      reader.consume(writes.length)
      let value = fallback
      for (const property of writes) {
        requireDoc(!property.complex, 'invalid-picture-data', 'Drawing boolean property contains complex data')
        if (property.value & mask * 65536) value = Boolean(property.value & mask)
      }
      return value
    },
    unprojected() {
      return [...values.keys()].filter(id => !used.has(id) || booleanBits.has(id)
        && values.get(id)!.some(property => (property.value >>> 16 & ~booleanBits.get(id)!) !== 0))
    },
  }
}
