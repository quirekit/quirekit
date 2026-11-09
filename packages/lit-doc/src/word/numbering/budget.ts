import { requireDoc } from '../../errors'
import type { DocReadLimits } from '../../types'
import type { NumberingBudget } from './types'

/**
 * Shares work limits between global definitions and complete instance overrides.
 * @param limits - Validated per-inspection resource ceilings.
 * @returns Per-read allocation counters, with no caller-global mutable state.
 */
export function createNumberingBudget(limits: DocReadLimits): NumberingBudget {
  let levels = 0
  let units = 0
  return {
    /** Consumes one source level before allocation. */
    consumeLevel() {
      requireDoc(++levels <= limits.maxNumberingLevels, 'limit-exceeded', 'Numbering level limit exceeded')
    },
    /**
     * Reserves template units before decoding.
     * @param count - UTF-16 units declared by the source Xst.
     */
    consumeText(count) {
      requireDoc(count <= limits.maxNumberingTextCodeUnits - units, 'limit-exceeded', 'Numbering template limit exceeded')
      units += count
    },
  }
}
