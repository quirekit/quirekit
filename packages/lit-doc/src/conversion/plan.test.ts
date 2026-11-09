import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { createDocxSourcePlan } from './plan'
import { DocConversionError } from './errors'

const bytes = new Uint8Array(readFileSync(new URL('../testing/fixtures/word-mac/chinese-basic.doc', import.meta.url)))

/** @param root - Typed XML root. @param name - Local Word element. @returns Descendants including the root. */
function descendants(root: DocxXmlElementPlan, name: string): DocxXmlElementPlan[] {
  return [...(root.localName === name ? [root] : []), ...root.children.flatMap(child => typeof child === 'string' ? [] : descendants(child, name))]
}

/** @param element - Typed XML node. @param name - Local attribute. @returns Attribute value. */
function attr(element: DocxXmlElementPlan, name: string) { return element.attributes.find(value => value.localName === name)?.value }

describe('DOC typed OOXML source projection', () => {
  it('projects the authored Chinese content, three paragraphs and source bold extent', () => {
    const { plan, report } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
    const document = plan.parts.find(part => part.name === '/word/document.xml')!.root!
    expect(descendants(document, 'p')).toHaveLength(3)
    expect(descendants(document, 't').map(element => element.children.join('')).join('')).toBe('QuireKit 旧版 Word 中文样本正文：保留中文 English 123。')
    expect(descendants(document, 'r').filter(run => descendants(run, 'b').some(element => attr(element, 'val') === '1'))
      .flatMap(run => descendants(run, 't')).reduce((count, element) => count + element.children.join('').length, 0)).toBe(21)
    expect(descendants(document, 'b').map(element => attr(element, 'val'))).toContain('1')
    expect(report.diagnostics.some(diagnostic => diagnostic.code === 'style-control-metadata-unprojected')).toBe(true)
    expect(report.source).toMatchObject({ codeUnits: 44, paragraphs: 3, tables: 0, fonts: 6, sections: 1 })
    expect(plan.relationships.some(relationship => relationship.sourcePart === '/' && relationship.target === '/word/document.xml')).toBe(true)
    const fontTable = plan.parts.find(part => part.name === '/word/fontTable.xml')!.root!
    expect(descendants(fontTable, 'font').map(element => attr(element, 'name'))).toEqual(['Times New Roman', 'Symbol', 'Arial', 'DengXian', '等线 Light', 'Cambria Math'])
  })

  it('rejects declared loss in strict mode with a located report rather than silently switching routes', () => {
    let failure: unknown
    try { createDocxSourcePlan(bytes, { lossPolicy: 'strict' }) } catch (error) { failure = error }
    expect(failure).toBeInstanceOf(DocConversionError)
    expect((failure as DocConversionError).report.lossy).toBe(true)
    expect((failure as DocConversionError).report.diagnostics.some(diagnostic => diagnostic.kind === 'loss')).toBe(true)
  })

  it('checks output budgets independently of source parsing and retains the caller buffer', () => {
    const snapshot = bytes.slice()
    expect(() => createDocxSourcePlan(bytes, { lossPolicy: 'best-effort', outputLimits: { maxXmlNodes: 1 } })).toThrow(/XML node limit/)
    expect(bytes).toEqual(snapshot)
  })
})
