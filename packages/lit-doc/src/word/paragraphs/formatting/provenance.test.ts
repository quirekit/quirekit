import { expect, it } from 'vitest'
import { resolveLimits } from '../../../binary/limits'
import { createPropertyReader } from '../../properties/reader'
import { applyParagraphProperties } from './apply'
import { defaultParagraphFormat } from './defaults'
import type { ParagraphPropertyKey } from './types'

it('retains paragraph direct-field presence independently of equal inherited defaults', () => {
  const fields = new Set<ParagraphPropertyKey>()
  const format = defaultParagraphFormat(0)
  applyParagraphProperties(format, [
    { opcode: 0x2405, operand: Uint8Array.of(0) },
    { opcode: 0x840f, operand: Uint8Array.of(0, 0) },
    { opcode: 0xa413, operand: Uint8Array.of(0, 0) },
  ], createPropertyReader(undefined, resolveLimits({})), fields)
  expect([...fields]).toEqual(['keepLines', 'leftIndent', 'spacingBeforeTwips'])
  expect(format).toMatchObject({ keepLines: false, leftIndent: { twips: 0 }, spacingBeforeTwips: 0 })
})
