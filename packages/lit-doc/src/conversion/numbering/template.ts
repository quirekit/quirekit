import { requireDoc } from '../../errors'
import type { DocNumberingLevel } from '../../word/numbering/types'

/**
 * Replaces only declared source placeholders, whose offsets count UTF-16 units.
 * @param level - Validated source level and its exact Xst template.
 * @returns OOXML level text, without materializing a document counter.
 */
export function numberingTemplate(level: DocNumberingLevel): string {
  if (level.numberFormat === 255) return ''
  requireDoc(!/%[1-9]/u.test(level.template), 'unsupported-numbering', 'Literal percent-number text requires an unambiguous numbering template representation')
  const offsets = new Set(level.placeholderOffsets.map(value => value - 1))
  let result = ''
  for (let unit = 0; unit < level.template.length; unit++)
    result += offsets.has(unit) ? `%${level.template.charCodeAt(unit) + 1}` : level.template[unit]
  return result
}
