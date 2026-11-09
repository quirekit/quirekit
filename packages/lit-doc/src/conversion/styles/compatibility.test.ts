import { expect, it } from 'vitest'
import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { compoundFixture } from '../../testing/compound'
import { withCharacterRecords } from '../../testing/characters'
import { conversionRecords } from '../../testing/conversion'
import { operation as op, withStyleDefinitions } from '../../testing/formatting'
import { withParagraphRecords } from '../../testing/paragraphs'
import { wordStreams } from '../../testing/word'
import { createDocxSourcePlan } from '../plan'

/** @param parent - Exact typed property owner. @param name - Local child name. @returns Direct children, excluding text and unrelated descendants. */
function children(parent: DocxXmlElementPlan, name: string): DocxXmlElementPlan[] {
  return parent.children.filter((value): value is DocxXmlElementPlan => typeof value === 'object' && value.localName === name)
}
/** @param element - Exact typed XML node. @param name - Local attribute name. @returns Original planned scalar. */
function attribute(element: DocxXmlElementPlan, name: string) { return element.attributes.find(item => item.localName === name)?.value }

it('retains style definitions and explicit paragraph clears without exporting ignored character-style highlight', () => {
  const raw = withCharacterRecords(withParagraphRecords(wordStreams([{ units: [65, 66, 13], unicode: false }]), [
    { cuts: [2048, 2051], records: [{ style: 1 }] },
  ]), [{ cuts: [2048, 2051], records: [op(0x4a30, 15, 0)] }])
  const source = withStyleDefinitions(raw, [
    { index: 0, characters: [...op(0x2a0c, 7), ...op(0x286f, 1)] },
    { index: 1, parent: 0, characters: [...op(0x2a0c, 0), ...op(0x286f, 0)] },
    { index: 15, kind: 2, characters: [...op(0x2a0c, 2), ...op(0x286f, 2)] },
  ])
  const { plan, report } = createDocxSourcePlan(compoundFixture(conversionRecords(source, 3)), { lossPolicy: 'best-effort' })
  const root = plan.parts.find(part => part.root?.localName === 'styles')!.root!
  const styles = children(root, 'style'), normal = styles.find(style => attribute(style, 'styleId') === 'Normal')!
  const paragraph = styles.find(style => attribute(style, 'styleId') === 'LegacyStyle1')!
  const character = styles.find(style => attribute(style, 'styleId') === 'LegacyStyle15')!
  expect(attribute(children(children(normal, 'rPr')[0]!, 'highlight')[0]!, 'val')).toBe('yellow')
  expect(attribute(children(paragraph, 'basedOn')[0]!, 'val')).toBe('Normal')
  expect(attribute(children(children(paragraph, 'rPr')[0]!, 'highlight')[0]!, 'val')).toBe('none')
  expect(attribute(children(children(paragraph, 'rPr')[0]!, 'rFonts')[0]!, 'hint')).toBe('default')
  expect(children(children(character, 'rPr')[0]!, 'highlight')).toEqual([])
  expect(attribute(children(children(character, 'rPr')[0]!, 'rFonts')[0]!, 'hint')).toBe('cs')
  for (const code of ['legacy-style-script-hint', 'legacy-paragraph-style-highlight', 'character-style-highlight-ignored'])
    expect(report.diagnostics).toContainEqual(expect.objectContaining({ code, kind: 'compatibility', source: 'styles' }))
})
