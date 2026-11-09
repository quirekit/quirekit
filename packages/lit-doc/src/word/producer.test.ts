import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { inspectDoc } from '../inspection'

const bytes = readFileSync(new URL('../testing/fixtures/word-mac/chinese-basic.doc', import.meta.url))

it('retains the authored Chinese/Latin Word paragraphs and the final empty paragraph', () => {
  const source = inspectDoc(bytes, { includeTables: true })
  expect(source.text).toBe('QuireKit 旧版 Word 中文样本\r正文：保留中文 English 123。\r\r')
  expect(source.paragraphs?.map(paragraph => [paragraph.start, paragraph.end, paragraph.ending]))
    .toEqual([[0, 22, 'paragraph'], [22, 43, 'paragraph'], [43, 44, 'paragraph']])
  expect(source.tables).toEqual([])
})

it('honors the Word-authored bold switch before the first paragraph marker', () => {
  const source = inspectDoc(bytes, { includeCharacterFormatting: true })
  const runs = source.characterRuns!
  const active = runs.filter(run => run.baseFormat.bold)
  expect(active[0]?.start).toBe(0)
  expect(active.at(-1)?.end).toBe(21)
  expect(active.reduce((length, run) => length + run.end - run.start, 0)).toBe(21)
  expect(active.every(run => run.baseFormat.boldComplex)).toBe(true)
  expect(runs.filter(run => run.end > 21).every(run => run.start >= 21
    && !run.baseFormat.bold && !run.baseFormat.boldComplex)).toBe(true)
})
