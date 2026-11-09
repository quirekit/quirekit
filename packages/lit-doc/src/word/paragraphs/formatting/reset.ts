import type { DocParagraphBaseFormat } from '../../../types'
import type { ParagraphNumberingState } from '../../numbering/types'
import { copyParagraphFormat } from './defaults'
import type { ParagraphPropertyKey, ParagraphStyleResolver } from './types'

/**
 * Replaces modeled paragraph inheritance while structural/review state stays with its independent source owners.
 * @param format - Private mutable paragraph settings.
 * @param index - Valid target paragraph style slot.
 * @param styles - Canonical bounded source style resolver.
 * @param fields - Optional current-layer direct provenance.
 * @param numbering - Optional mutable final reference with local provenance.
 */
export function replaceParagraphStyle(format: DocParagraphBaseFormat, index: number, styles: ParagraphStyleResolver,
  fields?: Set<ParagraphPropertyKey>, numbering?: ParagraphNumberingState): void {
  const next = copyParagraphFormat(styles.resolve(index))
  // A style operation resets even an equal style. New direct provenance starts
  // after it; the source heading-index rule is an explicit level assignment.
  fields?.clear()
  if (index >= 1 && index <= 9) { next.outlineLevel = index - 1; fields?.add('outlineLevel') }
  Object.assign(format, next)
  if (numbering) {
    const inherited = styles.resolveNumbering(index)
    numbering.rawIndex = inherited?.rawIndex ?? 0; numbering.rawLevel = inherited?.rawLevel ?? 0
    delete numbering.referenceChanged; delete numbering.levelChanged
  }
}
