import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { requireDoc } from '../../errors'
import { projectStoryBlocks } from '../body/story'
import type { NumberingProjection } from '../numbering/types'
import type { PictureDocumentProjection } from '../pictures/types'
import type { StyleProjection } from '../styles/types'
import { officeRelationships, wordPart } from '../xml/parts'
import { wordNamespace } from '../xml/context'
import type { ProjectionContext } from '../xml/types'
import { recoverStorySource } from '../source/policy'
import type { HeaderFooterInput, HeaderFooterProjection } from './types'

/**
 * Completes each story locally before installing references or image relationships.
 * @param input - Verified directory and optional shared content arrays.
 * @param styles - Shared named styles.
 * @param numbering - Complete document-wide numbering graph.
 * @param pictures - Shared image decoding and occurrence budgets.
 * @param context - Shared XML work and explicit loss policy.
 * @returns Successful story parts and section-local reference deltas.
 */
export function projectHeaderFooters(input: HeaderFooterInput, styles: StyleProjection, numbering: NumberingProjection,
  pictures: PictureDocumentProjection, context: ProjectionContext): HeaderFooterProjection {
  const references = new Map<number, DocxXmlElementPlan[]>()
  const result: HeaderFooterProjection = { parts: [], relationships: [], resources: [], references }
  if (!input.directory) return result
  const { directory, content } = input
  const e = context.element
  for (const [index, story] of directory.stories.entries()) {
    if (story.start === story.end) continue
    const key = `doc-${story.kind}-${index}`
    const name = `/word/${story.kind}${index + 1}.xml`
    const media = content ? pictures.forStory(content, name) : null
    let children: DocxXmlElementPlan[]
    try {
      const refusal = input.refusals.get(story.start)
      if (refusal) throw refusal
      requireDoc(content && media, 'invalid-story-data', 'Source story formatting is unavailable')
      children = projectStoryBlocks(content, styles, context, { start: story.start, end: story.contentEnd }, numbering, media)
      result.resources.push(...media.resources)
      result.relationships.push(...media.relationships)
    } catch (error) {
      if (!recoverStorySource(error, context)) throw error
      context.diagnose({ code: 'header-footer-content-unprojected', kind: 'loss', source: `section:${story.section}:${story.kind}:${story.variant}`,
        start: story.start, end: story.end, message: `An explicit blank story replaces unprojectable content (${error.code}: ${error.message}); section inheritance is preserved.` })
      children = [e('p')]
    }
    result.parts.push(wordPart(name, story.kind, e(story.kind === 'header' ? 'hdr' : 'ftr', {}, children)))
    result.relationships.push({ key, sourcePart: '/word/document.xml', relationshipType: `${officeRelationships}${story.kind}`,
      target: name, targetMode: 'internal' })
    const reference = context.xml({ namespaceUri: wordNamespace, prefix: 'w', localName: `${story.kind}Reference`, attributes: [
      { namespaceUri: wordNamespace, prefix: 'w', localName: 'type', value: story.variant },
      { namespaceUri: officeRelationships.slice(0, -1), prefix: 'r', localName: 'id', value: { kind: 'relationship-reference', key } },
    ], children: [] })
    const section = references.get(story.section) ?? []
    section.push(reference)
    references.set(story.section, section)
  }
  // OOXML orders all header references before all footer references. Source PLC
  // order interleaves the two kinds, while each part retains its original identity.
  for (const section of references.values()) section.sort((left, right) => Number(left.localName === 'footerReference') - Number(right.localName === 'footerReference'))
  return result
}
