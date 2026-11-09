import { requireDoc } from '../../../errors'
import type { DocReadLimits } from '../../../types'
import type { WordFormattingContext } from '../../formatting/types'
import { applyParagraphProperties } from './apply'
import { copyParagraphFormat, defaultParagraphFormat } from './defaults'
import type { ParagraphStyleResolver, ParagraphStyleValue } from './types'

/**
 * Shares canonical paragraph-style compilation between inspection and conversion.
 * @param context - Source style slots and shared property work budget.
 * @param limits - Cycle and inheritance-depth limits.
 * @param includeNumbering - Whether references are captured during the same style traversal.
 * @returns Memoized immutable paragraph-style resolver.
 */
export function createParagraphStyles(context: WordFormattingContext, limits: DocReadLimits, includeNumbering = false): ParagraphStyleResolver {
  const { styles, reader } = context
  const cache = new Map<number, ParagraphStyleValue>()

  /**
   * Compiles ancestors before a child and never treats style zero as absence.
   * @param index - Referenced paragraph style slot.
   * @param active - Current inheritance path for cycle/depth checks.
   * @returns Cached immutable base settings and total inheritance depth.
   */
  function resolve(index: number, active: ReadonlySet<number>): ParagraphStyleValue {
    requireDoc(!active.has(index), 'invalid-formatting-data', 'Cyclic paragraph style inheritance')
    requireDoc(active.size < limits.maxFormattingDepth, 'limit-exceeded', 'Paragraph style depth exceeded')
    const cached = cache.get(index)
    if (cached) return cached
    const style = styles[index]
    requireDoc(style?.kind === 1, 'invalid-formatting-data', 'Paragraph style refers to an empty, missing or wrong-type definition')
    const path = new Set(active); path.add(index)
    const parent = style.parent === 0xfff ? undefined : resolve(style.parent, path)
    const depth = (parent?.depth ?? 0) + 1
    requireDoc(depth <= limits.maxFormattingDepth, 'limit-exceeded', 'Paragraph style depth exceeded')
    const format = parent ? copyParagraphFormat(parent.format) : defaultParagraphFormat(index)
    format.styleIndex = index
    const numbering = includeNumbering ? { rawIndex: parent?.numbering?.rawIndex ?? 0, rawLevel: parent?.numbering?.rawLevel ?? 0 } : undefined
    applyParagraphProperties(format, reader.read(style.paragraph, 'paragraph'), reader, undefined, numbering)
    const result = { format, depth, ...(numbering ? { numbering } : {}) }; cache.set(index, result)
    return result
  }

  return { resolve: index => resolve(index, new Set()).format, resolveNumbering: index => resolve(index, new Set()).numbering }
}
