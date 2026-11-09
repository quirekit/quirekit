import { requireDoc } from '../../errors'
import type { DocTableCell } from '../../word/tables/types'
import type { StoryProjectionRange } from '../body/types'
import { findSourceInterval } from '../source/lookup'
import type { ConversionSource } from '../source/types'
import type { ProjectionContext } from '../xml/types'
import { conversionFieldIndex, fieldParagraphCells } from './source'
import { resourceFieldType } from './resources'
import type { FieldProjection, FieldProjectionFrame } from './types'

/**
 * Preserves source markers through the existing OOXML field lifecycle.
 * @param source - Once-interpreted source values and document-wide work budgets.
 * @param range - Exact actual Story, distinct from its aggregate source document part.
 * @param context - Bounded XML and explicit loss-report owner.
 * @returns Ordered field producer with independent pairing and instruction state.
 */
export function createFieldProjection(source: ConversionSource, range: StoryProjectionRange, context: ProjectionContext): FieldProjection {
  const index = conversionFieldIndex(source, range.start, range.end)
  const cells = fieldParagraphCells(source)
  const frames: FieldProjectionFrame[] = [], handledRuns = new Set<number>()
  let instructionDepth = 0
  let omittedInstructionDepth = 0
  let paragraph = -1
  let cell: DocTableCell | undefined

  /** @param position - Actual marker CP. @param code - Original control kind. @returns Complete typed marker after source validation. */
  function project(position: number, code: 19 | 20 | 21) {
    const runIndex = findSourceInterval(source.runs, position)
    const run = source.runs[runIndex]!
    requireDoc(run?.start <= position && position < run.end, 'invalid-field-data', 'Field control has no source character authority')
    if (!run.baseFormat.special) context.diagnose({ code: 'field-control-flag-missing', kind: 'compatibility', source: 'field', start: position, end: position + 1,
      message: 'A source field control lacks CFSpec; its explicit control and balanced field structure identify the marker.' })
    handledRuns.add(runIndex)
    // Read source flags before emitting a begin marker. Private caches never
    // enter a visible result; indexed and raw-text work have separate ceilings.
    if (code === 19) {
      requireDoc(source.fieldState.projected.remaining > 0 && frames.length < source.limits.maxFieldDepth,
        'limit-exceeded', 'Field count or nesting limit exceeded')
      source.fieldState.projected.remaining--
      const entry = index.begins.get(position)
      requireDoc(!entry || entry.end <= range.end, 'unsupported-field', 'Indexed field crosses an independently owned Story')
      requireDoc(!entry?.flags.privateResult || entry.separator === null || entry.separator + 1 === entry.end - 1,
        'unsupported-field', 'Private field results require hidden-content preservation')
      if (entry) {
        const flags = entry.flags
        if (flags.privateResult) context.diagnose({ code: 'field-private-state-unprojected', kind: 'loss', source: 'field', start: position, end: entry.end,
          message: 'This private field has no cached data; its empty result shape is retained but the private state requires a dedicated field-data owner.' })
        if (flags.differ || flags.zombieEmbed || flags.resultsDirty || flags.resultsEdited) context.diagnose({
          code: 'field-state-unprojected', kind: 'loss', source: 'field', start: position, end: entry.end,
          message: `DOC field display/OLE/edit flags 0x${(flags.raw & 15).toString(16)} have no admitted OOXML mapping; they are not interpreted as dirty.` })
        if (flags.nested !== (frames.length > 0)) context.diagnose({ code: 'field-nesting-flag-mismatch', kind: 'compatibility', source: 'field', start: position, end: entry.end,
          message: 'Source fNested disagrees with observed text nesting; actual paired controls define the output hierarchy.' })
      } else context.diagnose({ code: 'field-index-absent', kind: 'compatibility', source: 'field', start: position, end: position + 1,
        message: 'Source field controls have no indexed state record; text structure is retained without synthesizing source flags.' })
      const resource = resourceFieldType(source.storage.text, position, entry?.separator ?? range.end)
      const preserveStructure = resource === undefined && omittedInstructionDepth === 0
      const omitWholeField = !preserveStructure && instructionDepth > 0
      if (resource) context.diagnose({ code: resource === 'SHAPE' ? 'legacy-shape-field-normalized' : 'field-resource-unprojected',
        kind: 'loss', source: 'field', start: position, end: entry?.end ?? position + 1,
        message: resource === 'SHAPE'
          ? 'Legacy SHAPE field markers and instruction are omitted; displayed drawings retain their independently editable object and text owners.'
          : `${resource} requires a binary field-data/object owner; its markers and instruction are omitted while displayed results retain their ordinary content/resource admission.` })
      frames.push({ start: position, separator: null, entry, cell, preserveStructure, omitWholeField })
      instructionDepth++
      if (!preserveStructure) omittedInstructionDepth++
      return preserveStructure ? context.element('fldChar', { fldCharType: 'begin', ...(entry ? { fldLock: entry.flags.locked ? '1' : '0' } : {}) }) : undefined
    }
    const frame = frames[frames.length - 1]
    requireDoc(frame && (code !== 20 || frame.separator === null), 'invalid-field-data', 'Invalid source field-token order')
    requireDoc(frame.cell === cell, 'unsupported-field', 'Field controls cannot pair across cell ownership boundaries')
    // Only this frame changes instruction depth. An inner cached result still
    // belongs to an instruction carrier while any enclosing code region is open.
    if (code === 20) {
      requireDoc((!frame.entry || frame.entry.separator === position) && (!index.separators.has(position) || index.separators.get(position) === frame.entry),
        'invalid-field-data', 'Observed field separator disagrees with its indexed begin')
      frame.separator = position
      instructionDepth--
      if (!frame.preserveStructure && !frame.omitWholeField) omittedInstructionDepth--
    } else {
      requireDoc((!frame.entry || frame.entry.end === position + 1) && (!index.ends.has(position) || index.ends.get(position) === frame.entry),
        'invalid-field-data', 'Observed field end disagrees with its indexed begin')
      if (frame.entry && frame.entry.flags.hasSeparator !== (frame.separator !== null)) context.diagnose({
        code: 'field-separator-flag-mismatch', kind: 'compatibility', source: 'field', start: frame.start, end: position + 1,
        message: 'Source fHasSep disagrees with actual paired controls; the observed separator defines result presence.' })
      frames.pop()
      if (frame.separator === null) instructionDepth--
      if (!frame.preserveStructure && (frame.separator === null || frame.omitWholeField)) omittedInstructionDepth--
    }
    return frame.preserveStructure ? context.element('fldChar', { fldCharType: code === 20 ? 'separate' : 'end' }) : undefined
  }

  /** @param index - Canonical paragraph slot. Enforces the existing codec's single-parent instruction boundary. */
  function enterParagraph(index: number): void {
    requireDoc(paragraph === index || instructionDepth === 0, 'unsupported-field', 'Source field instructions cross paragraph boundaries')
    paragraph = index
    cell = cells.get(index)
  }

  /** Checks complete closure before an actual Story can install its output graph. */
  function finish(): void { requireDoc(frames.length === 0 && instructionDepth === 0 && omittedInstructionDepth === 0, 'invalid-field-data', 'Unclosed source complex field') }

  return { handledRuns,
    /** @returns Whether an open field owns this source boundary. */
    get inField() { return frames.length > 0 },
    /** @returns Whether any active ancestor still owns an instruction region. */
    get inInstruction() { return instructionDepth > 0 },
    /** @returns Whether a resource owner suppresses the current instruction region. */
    get omitInstruction() { return omittedInstructionDepth > 0 }, project, enterParagraph, finish }
}
