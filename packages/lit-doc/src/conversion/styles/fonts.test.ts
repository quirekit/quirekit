import { expect, it } from 'vitest'
import { compoundFixture } from '../../testing/compound'
import { noteDocumentStreams } from '../../testing/notes'
import { withFontNamePadding } from '../../testing/fonts/padding'
import { createDocxSourcePlan } from '../plan'

it('projects the original font name and descriptors while reporting bounded zero capacity', () => {
  const streams = noteDocumentStreams('Text\r')
  const normal = createDocxSourcePlan(compoundFixture(streams), { lossPolicy: 'best-effort' })
  const padded = createDocxSourcePlan(compoundFixture(withFontNamePadding(streams, 3)), { lossPolicy: 'best-effort' })
  expect(padded.plan).toEqual(normal.plan)
  expect(padded.report.diagnostics).toContainEqual(expect.objectContaining({ code: 'font-name-zero-padding', kind: 'compatibility', source: 'font:0' }))
  expect(normal.report.diagnostics.some(value => value.code === 'font-name-zero-padding')).toBe(false)
})
