import { requireDoc } from '../../errors'
import type { DocReadLimits } from '../../types'
import type { WordHeader } from '../types'
import { createNumberingBudget } from './budget'
import { readNumberingDefinitions } from './definitions'
import { readNumberingInstances } from './instances'
import type { DocNumberingRecords } from './types'

/**
 * Reads global numbering records independently of paragraph and marker evaluation.
 * @param table - Complete Table stream selected by the source FIB.
 * @param header - Validated source locators and story bounds.
 * @param limits - Per-inspection resource ceilings.
 * @returns Source definitions and instances; caller bytes remain unchanged.
 */
export function readNumberingRecords(table: Uint8Array, header: WordHeader, limits: DocReadLimits): DocNumberingRecords {
  const definitionsRange = header.records[73]
  const instancesRange = header.records[74]
  requireDoc(definitionsRange && instancesRange, 'invalid-numbering-data', 'Missing numbering FIB locators')
  const budget = createNumberingBudget(limits)
  const { definitions, end } = readNumberingDefinitions(table, definitionsRange, limits, budget)
  if (definitionsRange.length && instancesRange.length) {
    requireDoc(end <= instancesRange.offset || instancesRange.offset + instancesRange.length <= definitionsRange.offset,
      'invalid-numbering-data', 'Numbering definitions and instances overlap')
  }
  const main = header.stories.find(story => story.kind === 'main')!
  return { definitions, instances: readNumberingInstances(table, instancesRange, definitions, main.end, limits, budget) }
}
