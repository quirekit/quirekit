import { expect, it } from 'vitest'
import { inspectDoc } from '../../inspection'
import { majorityDocument } from '../../testing/majority'
import { createDocxSourcePlan } from '../../conversion/plan'

it.each(['direct', 'piece'] as const)('resolves an original %s majority carrier without losing text/mark ownership', carrier => {
  const bytes = majorityDocument(carrier), before = bytes.slice()
  const actual = inspectDoc(bytes, { includeCharacterFormatting: true })
  expect(actual.characterRuns?.map(run => [run.start, run.end, run.baseFormat.bold, run.baseFormat.fontSizeHalfPoints, run.baseFormat.language]))
    .toEqual([[0, 2, carrier === 'piece', 28, 0x409], [2, 3, true, 28, 0x409]])
  const plan = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
  expect(plan.report.diagnostics.some(item => item.code === 'direct-inverse-toggle-approximated')).toBe(carrier === 'direct')
  expect(bytes).toEqual(before)
})

it('retains the proofing exception through actual source inspection and shared plan projection', () => {
  const bytes = majorityDocument('direct', true)
  expect(inspectDoc(bytes, { includeCharacterFormatting: true }).characterRuns?.every(run => run.baseFormat.noProof)).toBe(true)
  const plan = JSON.stringify(createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' }).plan)
  expect(plan).toContain('noProof')
})
