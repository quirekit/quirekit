import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { DocReadError } from '../../errors'
import { createCharacterStyles } from '../../word/characters/formatting/styles'
import { readNumberingRecords } from '../../word/numbering/records'
import type { ParagraphNumberingState } from '../../word/numbering/types'
import type { ConversionSource } from '../source/types'
import type { ProjectionContext } from '../xml/types'
import { projectNumberingLevel, projectNumberingOverride } from './level'
import { prepareNumberingLevels } from './preflight'
import { numberingReference, referencedInstances, styleNumberingReference } from './references'
import type { NumberingLevelContext, NumberingProjection } from './types'

const sourceRefusals = new Set(['invalid-numbering-data', 'unsupported-numbering', 'unsupported-formatting', 'invalid-formatting-data'])

/**
 * Installs a complete optional graph; best-effort source refusals cannot leave dangling references.
 * @param source - Canonical document and existing source budgets.
 * @param context - Loss policy, bounded XML construction and diagnostic owner.
 * @param stories - Additional canonical stories sharing this document graph.
 * @returns Complete numbering part and the matching paragraph/style delta producers.
 */
export function projectNumbering(source: ConversionSource, context: ProjectionContext, stories: readonly ConversionSource[] = []): NumberingProjection {
  try { return compileNumbering(source, context, [source, ...stories]) } catch (error) {
    // Only this optional source graph is recoverable. Core reads have already
    // succeeded; resource limits and unexpected exceptions always escape.
    if (!(error instanceof DocReadError) || !sourceRefusals.has(error.code) || context.report.lossPolicy !== 'best-effort') throw error
    context.diagnose({ code: 'numbering-graph-unprojected', kind: 'loss', source: 'numbering',
      message: `The complete optional numbering graph is omitted (${error.code}: ${error.message}); no numbering part or references are installed.` })
    return { root: null, handled: false, paragraph: () => [], style: () => [] }
  }
}

/**
 * Constructs private candidate topology before the caller can attach any source reference.
 * @param source - Validated main document with its captured reference provenance.
 * @param context - Common XML and report budget.
 * @param stories - All source stories in this document.
 * @returns Atomic candidate part and reference closures.
 */
function compileNumbering(source: ConversionSource, context: ProjectionContext, stories: readonly ConversionSource[]): NumberingProjection {
  const records = readNumberingRecords(source.table, source.header, source.limits)
  const styleStates = new Map<number, ParagraphNumberingState>()
  source.context.styles.forEach((style, index) => {
    if (style?.kind === 1) styleStates.set(index, source.paragraphStyles.resolveNumbering(index)!)
  })
  // The old-style sentinel names an ANLD authority, never an LFO slot. Actual
  // story references still require a complete modern graph; only style output
  // can isolate that unprojected authority with a diagnosed cancellation.
  const modernStyles = [...styleStates.values()].filter(state => state.rawIndex !== 0x7ff)
  const needed = new Set(referencedInstances([...stories.flatMap(story => story.paragraphNumbering), ...modernStyles], records))
  const definitions = new Set([...needed].map(index => records.instances[index - 1]!.definitionIndex))
  const e = context.element
  const levelContext: NumberingLevelContext = { source, xml: context, characters: createCharacterStyles(source.context, source.limits), levels: new Map() }
  prepareNumberingLevels(records, needed, levelContext)
  const children: DocxXmlElementPlan[] = []
  // Keep source graph identity independent of formatting equality. Two concrete
  // instances sharing one definition must still point at that same abstract ID.
  for (const index of definitions) {
    const definition = records.definitions[index]!
    const authority = `numbering:definition:${index}`
    const levels = definition.levels.map(level => projectNumberingLevel(level, definition, `${authority}:level:${level.index}`, levelContext))
    children.push(e('abstractNum', { abstractNumId: index }, [
      e('nsid', { val: (definition.sourceId >>> 0).toString(16).padStart(8, '0').toUpperCase() }),
      e('multiLevelType', { val: definition.simple ? 'singleLevel' : definition.hybrid ? 'hybridMultilevel' : 'multilevel' }), ...levels,
    ]))
    if (definition.autoNumbered || definition.htmlFlags || !definition.hybrid && definition.templateCode)
      context.diagnose({ code: 'numbering-definition-metadata-unprojected', kind: 'loss', source: authority,
        message: 'Automatic LISTNUM field behavior, HTML flags and legacy template UI metadata are not projected.' })
  }
  const users = new Map<number, number>()
  for (const index of needed) {
    const instance = records.instances[index - 1]!
    users.set(instance.definitionIndex, (users.get(instance.definitionIndex) ?? 0) + 1)
    const definition = records.definitions[instance.definitionIndex]!
    const overrides = instance.overrides.flatMap(override => projectNumberingOverride(override, definition,
      `numbering:instance:${index}:level:${override.level}`, levelContext) ?? [])
    children.push(e('num', { numId: index }, [e('abstractNumId', { val: instance.definitionIndex }), ...overrides]))
    if (instance.htmlFlags) context.diagnose({ code: 'numbering-instance-metadata-unprojected', kind: 'loss', source: `numbering:instance:${index}`,
      message: 'Legacy instance HTML metadata is not projected.' })
  }
  if ([...users.values()].some(count => count > 1)) context.diagnose({ code: 'numbering-shared-counter-host-limit', kind: 'host-limit', source: 'numbering',
    message: 'Shared abstract-list identity is retained in OOXML; Classic does not yet reproduce every shared-instance counter and override sequence.' })
  for (const story of stories) story.paragraphNumbering.forEach((state, index) => {
    if (!state.rawIndex || state.rawIndex === 0xf801 || state.rawLevel === 12) return
    const instance = records.instances[state.rawIndex - 1]!
    const definition = records.definitions[instance.definitionIndex]!
    const level = instance.overrides.find(override => override.level === state.rawLevel)?.formatting ?? definition.levels[state.rawLevel]!
    const levelFields = levelContext.levels.get(level)!.properties.paragraphFields
    if ([...story.paragraphFields[index]!].some(field => levelFields.has(field))) context.diagnose({
      code: 'numbering-paragraph-precedence-unverified', kind: 'approximation', source: 'paragraph',
      start: story.paragraphs[index]!.start, end: story.paragraphs[index]!.end,
      message: 'List-level and direct paragraph fields overlap. Their separate OOXML layers are retained; legacy producer precedence requires independent verification.' })
    const linkedStyle = definition.styleIndexes[state.rawLevel]
    if (linkedStyle !== 0xfff && linkedStyle !== story.paragraphFormats[index]!.styleIndex) context.diagnose({
      code: 'numbering-style-association-unverified', kind: 'approximation', source: 'paragraph',
      start: story.paragraphs[index]!.start, end: story.paragraphs[index]!.end,
      message: 'The list-level style association differs from the paragraph style; both source identities are retained without applying a heading preset.' })
  })
  if (definitions.size < records.definitions.length || needed.size < records.instances.length) context.diagnose({
    code: 'numbering-unused-records-omitted', kind: 'compatibility', source: 'numbering',
    message: 'Unused source list definitions and instances are omitted; all active paragraph and paragraph-style references retain their original graph identities.' })
  return { root: children.length ? e('numbering', {}, children) : null, handled: true,
    paragraph: (index, story = source) => numberingReference(story.paragraphNumbering[index]!, context),
    style: index => styleNumberingReference(styleStates.get(index)!, index, context) }
}
