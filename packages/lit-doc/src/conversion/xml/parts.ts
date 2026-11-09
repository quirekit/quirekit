import type { DocxPackagePartPlan, DocxXmlElementPlan } from '@quirekit/lit-docx-contract'

export const officeRelationships = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/'

/**
 * Registers a typed WordprocessingML part for the central package writer.
 * @param name - Absolute OPC part path.
 * @param type - WordprocessingML content type suffix.
 * @param root - Namespace-aware typed XML root.
 * @returns Complete part request without serialized XML.
 */
export function wordPart(name: string, type: string, root: DocxXmlElementPlan): DocxPackagePartPlan {
  return { name, contentType: `application/vnd.openxmlformats-officedocument.wordprocessingml.${type}+xml`, root }
}
