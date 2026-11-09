import { requireDoc } from '../../../errors'
import type { DocReadLimits } from '../../../types'
import type { WordFormattingContext } from '../../formatting/types'
import type { DocCharacterBaseFormat } from '../types'
import { copyCharacterFormat, defaultCharacterFormat } from './defaults'
import type { CharacterStyleResolver } from './types'
import { applyCharacterValue } from './values'

/**
 * Compiles source style layers without flattening them into persistent document properties.
 * @param context - Shared source styles, font defaults and operation budget.
 * @param limits - Inheritance depth ceiling.
 * @returns Bounded source style resolver.
 */
export function createCharacterStyles(context: WordFormattingContext, limits: DocReadLimits): CharacterStyleResolver {
  const { styles, reader, fonts } = context
  requireDoc(fonts, 'invalid-formatting-data', 'Character inspection requires font defaults')
  const chains = new Map<string, readonly number[]>()
  const paragraphs = new Map<number, DocCharacterBaseFormat>()
  const characters = new Map<string, DocCharacterBaseFormat>()

  /**
   * Collects same-kind ancestors with cycle and depth checks before compilation.
   * @param index - Initial source style.
   * @param kind - Paragraph or character style kind.
   * @returns Ancestor-first style slots.
   */
  function ancestry(index: number, kind: 1 | 2): readonly number[] {
    const key = `${kind}:${index}`
    const cached = chains.get(key)
    if (cached) return cached
    const result: number[] = []
    const seen = new Set<number>()
    let current = index
    while (current !== 0xfff) {
      requireDoc(!seen.has(current), 'invalid-formatting-data', 'Cyclic character-property style inheritance')
      requireDoc(result.length < limits.maxFormattingDepth, 'limit-exceeded', 'Character-property style depth exceeded')
      const style = styles[current]
      if (kind === 2 && current === 10 && !style) break
      requireDoc(style?.kind === kind, 'invalid-formatting-data', 'Character properties reference an invalid style kind or slot')
      seen.add(current); result.unshift(current); current = style.parent
    }
    chains.set(key, result)
    return result
  }

  /**
   * Compiles each style layer relative to its parent snapshot, retaining explicit zero/false.
   * @param baseline - Underlying paragraph/default text properties.
   * @param indexes - Ancestor-first source style slots.
   * @returns Independent compiled settings.
   */
  function compile(baseline: DocCharacterBaseFormat, indexes: readonly number[]): DocCharacterBaseFormat {
    let result = copyCharacterFormat(baseline)
    for (const index of indexes) {
      const parent = result
      result = copyCharacterFormat(parent)
      const source = styles[index]!
      const operations = reader.read(source.character, source.kind === 1 ? 'paragraph-character' : 'character')
      reader.consume(operations.length)
      for (const operation of operations) applyCharacterValue(result, parent, operation, context.diagnostics)
    }
    return result
  }

  /**
   * Resolves the paragraph's character UPX independently of its paragraph UPX.
   * @param index - Source paragraph style slot.
   * @returns Immutable cached text settings.
   */
  function paragraph(index: number): DocCharacterBaseFormat {
    let result = paragraphs.get(index)
    if (!result) {
      result = compile(defaultCharacterFormat(index, fonts!), ancestry(index, 1))
      paragraphs.set(index, result)
    }
    return result
  }

  /**
   * Resolves a character style over its underlying paragraph text properties.
   * @param baseline - Immutable paragraph settings.
   * @param index - Source character style slot.
   * @returns Immutable compiled settings.
   */
  function character(baseline: DocCharacterBaseFormat, index: number): DocCharacterBaseFormat {
    const key = `${baseline.paragraphStyleIndex}:${index}`
    let result = characters.get(key)
    if (!result) {
      result = compile(baseline, ancestry(index, 2))
      result.characterStyleIndex = index
      // A document can combine many paragraph and character styles. Bound memoized
      // cross-products independently of the logical-run output allocation ceiling.
      if (characters.size < 4096) characters.set(key, result)
    }
    return result
  }
  return { paragraph, character }
}
