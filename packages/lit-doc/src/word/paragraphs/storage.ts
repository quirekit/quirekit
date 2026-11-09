import type { DocReadDiagnostic, DocReadLimits } from '../../types'
import type { WordHeader } from '../types'
import { readFormattingIndex } from '../properties/storage'
import { readParagraphPage } from './page'
import type { ParagraphPropertyIndex, ParagraphPropertyRecord } from './types'

/**
 * Builds a bounded physical index with lazy, per-page parsing and no paragraph normalization.
 * @param word - WordDocument stream.
 * @param table - Selected Table stream.
 * @param header - Validated FIB and property-index locator.
 * @param limits - Index/page allocation ceilings.
 * @param recoveryDiagnostics - Enables bounded absent-record defaults with explicit conversion loss.
 * @returns Lookup retaining source property payloads for future interpretation.
 */
export function readParagraphPropertyIndex(word: Uint8Array, table: Uint8Array, header: WordHeader,
  limits: DocReadLimits, recoveryDiagnostics?: DocReadDiagnostic[]): ParagraphPropertyIndex {
  const index = readFormattingIndex(word, table, header, limits, {
    field: 13, label: 'Paragraph', code: 'invalid-paragraph-data', readPage: readParagraphPage,
  })

  /**
   * Resolves the ending marker through the index and its cached source page.
   * @param byteOffset - Marker FC in WordDocument.
   * @param width - Complete encoded character width.
   * @returns Bounded source property record.
   */
  function locate(byteOffset: number, width: number): ParagraphPropertyRecord {
    if (!recoveryDiagnostics) return index.locate(byteOffset, width).record
    const match = index.find(byteOffset, width)
    if (match) return match.record
    // Only absence reaches this point. A bad page or a character split across a
    // physical boundary still throws before defaults can acquire any authority.
    if (!recoveryDiagnostics.some(diagnostic => diagnostic.code === 'paragraph-properties-defaulted')) recoveryDiagnostics.push({
      code: 'paragraph-properties-defaulted', message: 'A validated paragraph mark has no covering PAPX; style zero and empty direct properties were used for that paragraph.',
    })
    return { byteStart: byteOffset, byteEnd: byteOffset + width, styleIndex: 0, properties: new Uint8Array(0), defaulted: true }
  }
  return { locate }
}
