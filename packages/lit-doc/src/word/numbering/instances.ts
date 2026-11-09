import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { DocReadLimits } from '../../types'
import type { WordRecordRange } from '../types'
import { readNumberingLevel } from './level'
import type { DocNumberingDefinition, DocNumberingInstance, DocNumberingOverride, NumberingBudget } from './types'

/**
 * Reads source instances and their variable, level-identified overrides.
 * @param table - Complete source Table stream.
 * @param range - Exact instance region including all variable data.
 * @param definitions - Independently read source definitions.
 * @param mainEnd - Exclusive main-story character bound.
 * @param limits - Validated instance allocation ceiling.
 * @param budget - Shared replacement-level and template ceilings.
 * @returns Complete instances; unexplained trailing bytes are rejected.
 */
export function readNumberingInstances(table: Uint8Array, range: WordRecordRange, definitions: readonly DocNumberingDefinition[],
  mainEnd: number, limits: DocReadLimits, budget: NumberingBudget): DocNumberingInstance[] {
  if (!range.length) return []
  const view = new ByteView(new ByteView(table, 'invalid-numbering-data').slice(range.offset, range.length), 'invalid-numbering-data')
  const count = view.u32(0)
  requireDoc(count <= limits.maxNumberingInstances, 'limit-exceeded', 'Numbering instance limit exceeded')
  view.check(4, count * 16)
  const byIdentity = new Map(definitions.map((definition, index) => [definition.sourceId, index]))
  const instances: DocNumberingInstance[] = []
  let end = 4 + count * 16
  for (let index = 0; index < count; index++) {
    const at = 4 + index * 16
    const sourceId = view.u32(at) | 0
    const definitionIndex = byIdentity.get(sourceId)
    requireDoc(definitionIndex !== undefined, 'invalid-numbering-data', 'Numbering instance refers to a missing definition')
    const definition = definitions[definitionIndex]!
    const autoNumberField = view.u8(at + 13)
    requireDoc([0, 0xfc, 0xfd, 0xfe, 0xff].includes(autoNumberField)
      && definition.autoNumbered === (autoNumberField >= 0xfc && autoNumberField <= 0xfe),
    'invalid-numbering-data', 'Inconsistent automatic numbering field')
    const cp = view.u32(end)
    end += 4
    requireDoc(cp === 0xffffffff || cp <= mainEnd, 'invalid-numbering-data', 'Numbering first paragraph CP exceeds main story')
    const overrides: DocNumberingOverride[] = []
    const levels = new Set<number>()
    for (let item = 0; item < view.u8(at + 12); item++) {
      const position = end
      const rawStartAt = view.u32(position) | 0
      const packed = view.u32(position + 4)
      const level = packed & 15
      requireDoc(level <= 8 && level < definition.levels.length, 'invalid-numbering-data', 'Invalid numbering override level')
      requireDoc(!levels.has(level), 'unsupported-numbering', 'Repeated source numbering override level is outside the admitted scope')
      levels.add(level)
      const hasStartOverride = !!(packed & 0x10)
      const hasFormatting = !!(packed & 0x20)
      const startOverride = hasStartOverride && !hasFormatting ? rawStartAt : null
      requireDoc(startOverride === null || startOverride >= 0 && startOverride <= 0x7fff,
        'invalid-numbering-data', 'Invalid numbering start override')
      end += 8
      const replacement = hasFormatting ? readNumberingLevel(view.bytes, end, level, definition.hybrid, budget) : null
      if (replacement) end = replacement.end
      overrides.push({ level, rawStartAt, hasStartOverride, hasFormatting, startOverride,
        formatting: replacement?.level ?? null, htmlFlags: (packed >>> 6) & 255, headerBytes: view.slice(position, 8).slice() })
    }
    instances.push({ index: index + 1, sourceId, definitionIndex, firstParagraphCp: cp === 0xffffffff ? null : cp,
      autoNumberField, htmlFlags: view.u8(at + 14), overrides, headerBytes: view.slice(at, 16).slice() })
  }
  requireDoc(end === range.length, 'invalid-numbering-data', 'Unexplained trailing numbering instance bytes')
  return instances
}
