import type { DocxXmlChildPlan, DocxXmlElementPlan } from '@quirekit/lit-docx-contract'

/**
 * Removes both markers of refused pairs after all Story boundary owners have run.
 * @param nodes - Complete already-budgeted typed Story children.
 * @param omitted - Decimal source pair identities whose boundaries were not both admitted.
 * @returns Atomic output, preserving all unrelated text, properties and relationships.
 */
export function omitBookmarkPairs(nodes: readonly DocxXmlElementPlan[], omitted: ReadonlySet<string>): DocxXmlElementPlan[] {
  return nodes.flatMap(node => {
    if ((node.localName === 'bookmarkStart' || node.localName === 'bookmarkEnd')
      && omitted.has(String(node.attributes.find(attribute => attribute.localName === 'id')?.value))) return []
    return [{ ...node, children: node.children.flatMap<DocxXmlChildPlan>(child => typeof child === 'string' ? [child] : omitBookmarkPairs([child], omitted)) }]
  })
}
