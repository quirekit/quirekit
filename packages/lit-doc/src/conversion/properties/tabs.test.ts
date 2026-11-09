import { expect, it } from 'vitest'
import { createProjectionContext } from '../xml/context'
import { paragraphTabs } from './tabs'

/** @returns Fresh output authority for exact tab projection assertions. */
function context() {
  return createProjectionContext({ lossPolicy: 'best-effort' }, { codeUnits: 0, paragraphs: 0, characterRuns: 0, tables: 0, styles: 0, fonts: 0, sections: 0 })
}

it('emits only actual local writes and retains the future deletion-range boundary', () => {
  const owner = context()
  const addition = { position: 2160, alignment: 2 as const, leader: 2 as const }
  const result = paragraphTabs({ stops: [{ position: 1440, alignment: 1, leader: 0 }, addition],
    changes: [{ position: 720, value: null }, { position: 2160, value: addition }], rangeDeletion: true }, owner, 'paragraph')
  expect(result[0]!.children.map(child => typeof child === 'string' ? child : Object.fromEntries(child.attributes.map(attribute => [attribute.localName, attribute.value]))))
    .toEqual([{ pos: '720', val: 'clear' }, { pos: '2160', val: 'right', leader: 'hyphen' }])
  expect(owner.report.diagnostics.map(item => item.code)).toEqual(['tab-deletion-range-approximated'])
})

it('projects source leader aliases and list tabs without using the shifted POI display helper', () => {
  const owner = context()
  const stops = [{ position: 720, alignment: 6 as const, leader: 4 as const }, { position: 1440, alignment: 0 as const, leader: 7 as const }]
  const result = paragraphTabs({ stops, changes: stops.map(value => ({ position: value.position, value })), rangeDeletion: false }, owner, 'numbering')
  expect(result[0]!.children.map(child => typeof child === 'string' ? child : Object.fromEntries(child.attributes.map(attribute => [attribute.localName, attribute.value]))))
    .toEqual([{ pos: '720', val: 'num', leader: 'underscore' }, { pos: '1440', val: 'left', leader: 'none' }])
  expect(owner.report.lossy).toBe(false)
})
