import { requireDoc } from '../../errors'
import type { DocNumberingRecords, DocParagraphNumbering, ParagraphNumberingState } from './types'

/**
 * Associates an inherited raw reference without evaluating the list counter.
 * @param state - Final paragraph reference after direct and ending-piece properties.
 * @param records - Independently validated source definitions and instances.
 * @returns Explicit no-list, active-level or skipped-paragraph source reference.
 */
export function resolveParagraphNumbering(state: ParagraphNumberingState, records: DocNumberingRecords): DocParagraphNumbering {
  const { rawIndex, rawLevel } = state
  if (rawIndex === 0 || rawIndex === 0xf801) {
    return { rawIndex, rawLevel, instanceIndex: null, level: null, keepLogicalIndentation: false }
  }
  requireDoc(rawIndex >= 1 && rawIndex <= 0x7fe || rawIndex >= 0xf802 && rawIndex <= 0xffff,
    'invalid-numbering-data', 'Invalid paragraph list reference')
  const keepLogicalIndentation = rawIndex >= 0xf802
  const instanceIndex = keepLogicalIndentation ? 0x10000 - rawIndex : rawIndex
  const instance = records.instances[instanceIndex - 1]
  requireDoc(instance?.index === instanceIndex, 'invalid-numbering-data', 'Paragraph refers to a missing numbering instance')
  const definition = records.definitions[instance.definitionIndex]
  requireDoc(definition && (rawLevel === 12 || rawLevel <= 8 && !!definition.levels[rawLevel]),
    'invalid-numbering-data', 'Paragraph refers to a missing numbering level')
  return { rawIndex, rawLevel, instanceIndex, level: rawLevel, keepLogicalIndentation }
}
