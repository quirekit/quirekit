import { requireDoc } from '../../../errors'
import type { DocParagraphBaseFormat, DocReadLimits } from '../../../types'
import { readPieceParagraphProperties } from '../../properties/piece'
import type { WordFormattingContext } from '../../formatting/types'
import type { WordTextStorage } from '../../types'
import type { ParagraphSourceRecord } from '../types'
import { applyParagraphProperties } from './apply'
import { copyParagraphFormat } from './defaults'
import { createParagraphStyles } from './styles'
import type { ParagraphPropertyKey, ParagraphStyleResolver } from './types'
import type { ParagraphNumberingState } from '../../numbering/types'

/**
 * Resolves paragraph base settings while keeping list/table and character semantics outside the claim.
 * @param storage - Text pieces and CLX property groups.
 * @param paragraphs - Main-story boundaries and ending-marker property ownership.
 * @param context - Shared stylesheet and formatting work budget.
 * @param limits - Per-inspection operation and depth budgets.
 * @param traces - Optional direct-field provenance sinks in paragraph order.
 * @param numberingStates - Optional output sink for references captured in the same traversal.
 * @param resolvedStyles - Optional shared resolver retaining style-local reference provenance.
 * @returns Independent derived base settings in logical paragraph order.
 */
export function readParagraphFormats(storage: WordTextStorage, paragraphs: readonly ParagraphSourceRecord[],
  context: WordFormattingContext, limits: DocReadLimits, traces?: readonly Set<ParagraphPropertyKey>[],
  numberingStates?: ParagraphNumberingState[], resolvedStyles?: ParagraphStyleResolver): readonly DocParagraphBaseFormat[] {
  const { reader } = context
  const styles = resolvedStyles ?? createParagraphStyles(context, limits, numberingStates !== undefined)

  // Derived styles are copied before the direct and ending-piece layers. Public
  // settings must never mutate a cached ancestor or another paragraph's result.
  return paragraphs.map((paragraph, index) => {
    const bytes = paragraph.formatting.properties
    if (bytes[0] === 0x46 && bytes[1] === 0x66) {
      const canonical = paragraph.formatting.styleIndex === 0 && bytes.length === 6
      requireDoc(context.recoverProperties || canonical,
        'invalid-formatting-data', 'Indirect PAPX must be the sole direct operation with style zero')
      if (!canonical && !context.diagnostics.some(item => item.code === 'indirect-property-compatibility')) context.diagnostics.push({
        code: 'indirect-property-compatibility', message: 'A noncanonical indirect PAPX retains its actual source style index and bounded local property bytes.',
      })
    }
    const format = copyParagraphFormat(styles.resolve(paragraph.formatting.styleIndex))
    const inherited = numberingStates ? styles.resolveNumbering(paragraph.formatting.styleIndex) : undefined
    const numbering = inherited ? { rawIndex: inherited.rawIndex, rawLevel: inherited.rawLevel } : undefined
    applyParagraphProperties(format, reader.read(bytes), reader, traces?.[index], numbering, styles)
    applyParagraphProperties(format, readPieceParagraphProperties(paragraph.propertyModifier, storage, reader), reader, traces?.[index], numbering, styles)
    if (numbering) numberingStates!.push(numbering)
    return format
  })
}
