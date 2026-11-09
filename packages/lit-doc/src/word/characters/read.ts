import { requireDoc } from '../../errors'
import type { DocParagraphBaseFormat, DocReadLimits } from '../../types'
import type { WordFormattingContext } from '../formatting/types'
import type { ParagraphSourceRecord } from '../paragraphs/types'
import { readPieceCharacterProperties } from '../properties/piece'
import type { PropertyOperation } from '../properties/types'
import type { WordHeader, WordTextStorage } from '../types'
import { applyCharacterLayers } from './formatting/apply'
import { createCharacterStyles } from './formatting/styles'
import { defaultCharacterFormat } from './formatting/defaults'
import type { CharacterPropertyKey, CharacterToggleModes } from './formatting/types'
import { validateCharacterFormat } from './formatting/values'
import { readCharacterSources } from './source'
import type { CharacterSourceRecord, DocCharacterRun } from './types'

/**
 * Inspects main-story character settings without creating editor marks or dropping controls.
 * @param word - WordDocument stream.
 * @param table - Selected Table stream.
 * @param header - Validated source locators.
 * @param storage - Logical text and piece properties.
 * @param paragraphs - Source paragraph ending authorities.
 * @param context - Shared stylesheet and formatting work budget.
 * @param limits - Run, page, depth and work ceilings.
 * @param operationLayers - Optional source-ordered direct operations for review metadata.
 * @param paragraphFormats - Optional already resolved final paragraph style authorities.
 * @returns Independent source runs with explicitly scoped base settings.
 */
export function readCharacterFormats(word: Uint8Array, table: Uint8Array, header: WordHeader, storage: WordTextStorage,
  paragraphs: readonly ParagraphSourceRecord[], context: WordFormattingContext, limits: DocReadLimits,
  operationLayers?: (readonly PropertyOperation[])[], paragraphFormats?: readonly DocParagraphBaseFormat[]): readonly DocCharacterRun[] {
  return resolveCharacterFormats(readCharacterSources(word, table, header, storage, paragraphs, limits, undefined, context.diagnostics), storage, paragraphs, context, limits,
    undefined, undefined, operationLayers, paragraphFormats)
}

/**
 * Resolves existing source spans so conversion can retain provenance without reparsing CHPX pages.
 * @param sources - Complete main-story character sources in logical order.
 * @param storage - Original piece modifiers.
 * @param paragraphs - Paragraph style authorities.
 * @param context - Shared source styles and property budget.
 * @param limits - Style ancestry bounds.
 * @param traces - Optional per-span direct-field provenance sinks.
 * @param toggleModes - Optional surviving relative-toggle metadata per span.
 * @param operationLayers - Optional sink retaining the same ordered direct operations for source object ownership.
 * @param paragraphFormats - Optional already resolved final paragraph style authorities.
 * @returns Derived source settings aligned one-to-one with the supplied spans.
 */
export function resolveCharacterFormats(sources: readonly CharacterSourceRecord[], storage: WordTextStorage,
  paragraphs: readonly ParagraphSourceRecord[], context: WordFormattingContext, limits: DocReadLimits, traces?: readonly Set<CharacterPropertyKey>[], toggleModes?: readonly CharacterToggleModes[], operationLayers?: (readonly PropertyOperation[])[],
  paragraphFormats?: readonly DocParagraphBaseFormat[]): readonly DocCharacterRun[] {
  requireDoc(!paragraphFormats || paragraphFormats.length === paragraphs.length, 'invalid-formatting-data', 'Final paragraph formats must cover every source paragraph')
  const styles = createCharacterStyles(context, limits)
  const majority = { defaults: defaultCharacterFormat(0, context.fonts!), fontName: context.fontName }
  return sources.map((run, index) => {
    const paragraph = paragraphs[run.paragraphIndex]!
    // PAPX/piece replacement chooses paragraph inheritance before CHPX is
    // interpreted; its original source index remains a separate raw fact.
    const baseline = styles.paragraph(paragraphFormats?.[run.paragraphIndex]?.styleIndex ?? paragraph.formatting.styleIndex)
    const layers = [context.reader.read(run.formatting.properties), readPieceCharacterProperties(run.propertyModifier, storage, context.reader)]
    operationLayers?.push(layers.flat())
    const baseFormat = applyCharacterLayers(baseline, layers, styles, context.reader, traces?.[index], toggleModes?.[index], context.diagnostics, majority)
    validateCharacterFormat(baseFormat)
    return { start: run.start, end: run.end, baseFormat }
  })
}
