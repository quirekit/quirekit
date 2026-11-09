import { requireDoc } from '../../errors'
import type { DocNumberingLevel, DocNumberingRecords } from '../../word/numbering/types'
import { numberingFormat } from './format'
import { readNumberingPropertyValues } from './property-values'
import { numberingTemplate } from './template'
import type { NumberingLevelContext } from './types'

/**
 * Completes all recoverable source validation before graph XML can claim retention.
 * @param records - Independently bounded source definitions and concrete instances.
 * @param instances - Actual paragraph and paragraph-style users.
 * @param context - Shared interpreters, budgets and private semantic cache.
 */
export function prepareNumberingLevels(records: DocNumberingRecords, instances: ReadonlySet<number>, context: NumberingLevelContext): void {
  const levels = new Map<number, DocNumberingLevel[]>()
  for (const index of instances) {
    const instance = records.instances[index - 1]!
    const selected = levels.get(instance.definitionIndex) ?? [...records.definitions[instance.definitionIndex]!.levels]
    for (const override of instance.overrides) if (override.formatting) selected.push(override.formatting)
    levels.set(instance.definitionIndex, selected)
  }
  for (const [definitionIndex, selected] of levels) {
    const definition = records.definitions[definitionIndex]!
    for (const level of selected) {
      const linked = definition.styleIndexes[level.index]!
      const styleIndex = linked === 0xfff ? 0 : linked
      requireDoc(context.source.context.styles[styleIndex]?.kind === 1, 'invalid-numbering-data', 'Numbering level links to an invalid paragraph style')
      context.levels.set(level, { format: numberingFormat(level.numberFormat), text: numberingTemplate(level),
        properties: readNumberingPropertyValues(level, styleIndex, context) })
    }
  }
}
