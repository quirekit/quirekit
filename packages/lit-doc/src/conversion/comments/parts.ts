import { officeRelationships, wordPart } from '../xml/parts'
import type { ProjectionContext } from '../xml/types'
import { commentParagraphId } from './content'
import type { CommentProjection, PendingCommentOutput } from './types'

/**
 * Installs only whole admitted threads and their message-local resources.
 * @param outputs - Complete messages in original directory order.
 * @param result - Output graph owner, finalized once after main-flow projection.
 * @param context - Shared bounded namespace-aware XML authority.
 */
export function installCommentParts(outputs: readonly PendingCommentOutput[], result: CommentProjection, context: ProjectionContext): void {
  if (!outputs.length) return
  result.parts.push(wordPart('/word/comments.xml', 'comments', context.element('comments', {}, outputs.map(output => output.element))))
  result.relationships.push({ key: 'comments', sourcePart: '/word/document.xml', relationshipType: `${officeRelationships}comments`,
    target: '/word/comments.xml', targetMode: 'internal' })
  for (const output of outputs) {
    result.relationships.push(...output.media.relationships)
    result.resources.push(...output.media.resources)
  }
  if (!outputs.some(output => output.source.extra?.parentIndex !== null && output.source.extra?.parentIndex !== undefined)) return
  const namespaceUri = 'http://schemas.microsoft.com/office/word/2012/wordml'
  const root = context.xml({ namespaceUri, prefix: 'w15', localName: 'commentsEx', attributes: [], children: outputs.map(output => {
    const parent = output.source.extra?.parentIndex
    return context.xml({ namespaceUri, prefix: 'w15', localName: 'commentEx', children: [], attributes: [
      { namespaceUri, prefix: 'w15', localName: 'paraId', value: commentParagraphId(output.source.index) },
      ...(parent === null || parent === undefined ? [] : [{ namespaceUri, prefix: 'w15', localName: 'paraIdParent', value: commentParagraphId(parent) }]),
      { namespaceUri, prefix: 'w15', localName: 'done', value: '0' },
    ] })
  }) })
  result.parts.push(wordPart('/word/commentsExtended.xml', 'commentsExtended', root))
  result.relationships.push({ key: 'commentsExtended', sourcePart: '/word/document.xml',
    relationshipType: 'http://schemas.microsoft.com/office/2011/relationships/commentsExtended',
    target: '/word/commentsExtended.xml', targetMode: 'internal' })
}
