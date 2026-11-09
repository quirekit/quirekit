import { ByteView } from '../../binary/bytes'
import { requireDoc } from '../../errors'
import type { DocReadLimits, DocStoryRange } from '../../types'
import type { WordAllocationBudget, WordHeader, WordTextStorage } from '../types'
import type { DocFieldEntry, DocFieldFlags, DocFieldIndex, DocFieldsSource, DocFieldToken } from './types'

const recordIndexes = { main: 16, header: 17, footnote: 18, comment: 19, endnote: 48, textbox: 57, headerTextbox: 59 }

/** @param raw - Original end-state byte. @returns Distinct format-defined flags. */
function readFlags(raw: number): DocFieldFlags {
  return { raw, differ: !!(raw & 1), zombieEmbed: !!(raw & 2), resultsDirty: !!(raw & 4),
    resultsEdited: !!(raw & 8), locked: !!(raw & 16), privateResult: !!(raw & 32),
    nested: !!(raw & 64), hasSeparator: !!(raw & 128) }
}

/**
 * Reads a single part without treating its undefined terminal CP as source content.
 * @param table - FIB-selected table stream.
 * @param header - Validated source locators.
 * @param storage - Immutable concatenated text.
 * @param story - Complete document-part interval.
 * @param limits - Validated field nesting and allocation ceilings.
 * @param budget - Shared remaining field allocations; failed reads retain spent work.
 * @returns Raw tokens and paired indexed ranges for this document part.
 */
export function readFieldIndex(table: Uint8Array, header: WordHeader, storage: WordTextStorage,
  story: DocStoryRange, limits: DocReadLimits, budget: WordAllocationBudget): DocFieldIndex {
  const range = header.records[recordIndexes[story.kind]]!
  if (!range.length) return { ...story, tokens: [], entries: [] }
  const count = (range.length - 4) / 6
  requireDoc(Number.isInteger(count) && count >= 0, 'invalid-field-data', 'Invalid field PLC byte length')
  requireDoc(count <= budget.remaining * 3, 'limit-exceeded', 'Combined field count limit exceeded')
  const stream = new ByteView(table, 'invalid-field-data')
  const data = new ByteView(stream.slice(range.offset, range.length), 'invalid-field-data')
  const tokens: DocFieldToken[] = [], entries: DocFieldEntry[] = []
  const stack: Omit<DocFieldEntry, 'end' | 'flags'>[] = []
  const terminalCp = data.u32(count * 4)
  let previous = -1
  // Only actual marker CPs address text. The final sorted CP may exceed the
  // entire document and must never extend a field's content range.
  for (let index = 0; index < count; index++) {
    const position = data.u32(index * 4), next = data.u32((index + 1) * 4)
    const rawCode = data.u8((count + 1) * 4 + index * 2)
    const code = rawCode & 31
    const value = data.u8((count + 1) * 4 + index * 2 + 1)
    requireDoc(position > previous && next > position && position < story.end - story.start,
      'invalid-field-data', 'Unordered or out-of-part field marker position')
    requireDoc((code === 19 || code === 20 || code === 21) && storage.text.charCodeAt(story.start + position) === code,
      'invalid-field-data', 'Field index does not point to its declared source control')
    tokens.push({ relativePosition: position, nextRelativePosition: next, rawCode, code, value })
    const absolute = story.start + position
    // The index can omit enclosing XE/TC/RD/TA/PRIVATE fields. This stack
    // validates indexed pairing only; it cannot reinterpret the source fNested.
    if (code === 19) {
      requireDoc(budget.remaining > 0 && stack.length < limits.maxFieldDepth,
        'limit-exceeded', 'Field count or nesting limit exceeded')
      budget.remaining--
      stack.push({ start: absolute, separator: null, indexDepth: stack.length + 1, lastParsedType: value })
    } else {
      const frame = stack[stack.length - 1]
      requireDoc(frame, 'invalid-field-data', 'Field separator or end has no indexed begin')
      if (code === 20) {
        requireDoc(frame.separator === null, 'invalid-field-data', 'Field has duplicate indexed separators')
        frame.separator = absolute
      } else {
        stack.pop()
        entries.push({ ...frame, end: absolute + 1, flags: readFlags(value) })
      }
    }
    previous = position
  }
  requireDoc(stack.length === 0, 'invalid-field-data', 'Unclosed indexed field')
  entries.sort((left, right) => left.start - right.start)
  return { ...story, terminalCp, tokens, entries }
}

/**
 * Reads every document part under one allocation budget, without loading formatting.
 * @param table - FIB-selected table stream.
 * @param header - Validated source metadata.
 * @param storage - Immutable concatenated source text.
 * @param limits - Resource ceilings shared by all seven indexes.
 * @returns Complete source field indexes.
 */
export function readFieldRecords(table: Uint8Array, header: WordHeader, storage: WordTextStorage,
  limits: DocReadLimits): DocFieldsSource {
  const budget = { remaining: limits.maxFields }
  return { scope: 'field-index-source',
    indexes: header.stories.map(story => readFieldIndex(table, header, storage, story, limits, budget)) }
}
