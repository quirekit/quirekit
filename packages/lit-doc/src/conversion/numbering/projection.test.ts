import { readFileSync } from 'node:fs'
import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { describe, expect, it } from 'vitest'
import { createDocxSourcePlan } from '../plan'

/** @param root - Typed Word XML. @param name - Local element name. @returns All matching descendants. */
function nodes(root: DocxXmlElementPlan, name: string): DocxXmlElementPlan[] {
  return [...(root.localName === name ? [root] : []), ...root.children.flatMap(child => typeof child === 'string' ? [] : nodes(child, name))]
}

/** @param node - Typed XML element. @param name - Local attribute. @returns Stored attribute value. */
function attribute(node: DocxXmlElementPlan, name: string) { return node.attributes.find(value => value.localName === name)?.value }

describe('source DOC numbering graph projection', () => {
  for (const [directory, name, start, definition] of [
    ['word-mac-numbering', 'numbered-basic', 1, 0], ['word-mac-zero-start', 'numbered-zero-start', 0, 1],
  ] as const) it(`preserves the native Word ${start}-start graph and actual paragraph references`, () => {
    const bytes = new Uint8Array(readFileSync(new URL(`../../testing/fixtures/${directory}/${name}.doc`, import.meta.url)))
    const { plan, report } = createDocxSourcePlan(bytes, { lossPolicy: 'best-effort' })
    expect(report.diagnostics.filter(value => value.code === 'numbering-graph-unprojected')).toEqual([])
    const numbering = plan.parts.find(part => part.name === '/word/numbering.xml')?.root
    expect(numbering, 'numbering part must be installed with its references').toBeDefined()
    const abstract = nodes(numbering!, 'abstractNum')
    expect(abstract).toHaveLength(1)
    expect(attribute(abstract[0]!, 'abstractNumId')).toBe(String(definition))
    expect(nodes(abstract[0]!, 'lvl')).toHaveLength(9)
    const first = nodes(abstract[0]!, 'lvl')[0]!
    expect(attribute(nodes(first, 'start')[0]!, 'val')).toBe(String(start))
    expect(attribute(nodes(first, 'numFmt')[0]!, 'val')).toBe('decimal')
    expect(attribute(nodes(first, 'lvlText')[0]!, 'val')).toBe('%1.')
    expect(attribute(nodes(first, 'suff')[0]!, 'val')).toBe('tab')
    expect(attribute(nodes(numbering!, 'num')[0]!, 'numId')).toBe('1')
    expect(attribute(nodes(nodes(numbering!, 'num')[0]!, 'abstractNumId')[0]!, 'val')).toBe(String(definition))
    const document = plan.parts.find(part => part.name === '/word/document.xml')!.root!
    expect(nodes(document, 'numPr').map(node => nodes(node, 'numId').map(value => attribute(value, 'val')))).toEqual([['1'], ['1'], ['1']])
    expect(plan.relationships.filter(value => value.target === '/word/numbering.xml')).toHaveLength(1)
    expect(nodes(document, 't').map(node => node.children.join('')).join('')).not.toMatch(/^[0123]\. /)
  })
})
