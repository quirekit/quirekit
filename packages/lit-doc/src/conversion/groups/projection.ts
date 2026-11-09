import type { DocxRelationshipPlan, DocxResourcePlan, DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { requireDoc } from '../../errors'
import type { SourceDrawingGroup, SourceDrawingGroupNode, SourceFloatingGroup } from '../../word/drawings/groups/types'
import { floatingDrawingAnchor } from '../drawings/anchor'
import { createDrawingXml, drawingNamespaces } from '../drawings/xml'
import { preparePictureMedia } from '../pictures/media'
import { pictureShape } from '../pictures/shape'
import type { PictureProjection, PictureProjectionOwner } from '../pictures/types'
import type { ConversionSource } from '../source/types'
import { textboxShape } from '../textboxes/shape'
import type { TextboxContentDraft, TextboxProjectionResult } from '../textboxes/types'
import type { ProjectionContext } from '../xml/types'
import { nextGroupDrawingId } from './identity'

/** @param source - Entire validated original tree. @param owner - Document media and author-content owners. @param sourcePart - Actual enclosing OPC part. @param pictures - Private media scopes for original textbox stories. @param context - Source-located output owner. @returns Whole standard group with atomically committed text ownership and private resources. */
export function projectDrawingGroup(source: SourceFloatingGroup, owner: PictureProjectionOwner, sourcePart: string,
  pictures: (content: ConversionSource) => PictureProjection, context: ProjectionContext): TextboxProjectionResult {
  const e = createDrawingXml(context), resources = new Map<string, DocxResourcePlan>(), relationships = new Map<string, DocxRelationshipPlan>()
  const drafts: TextboxContentDraft[] = [], claims = new Set<string>(), rootId = nextGroupDrawingId(owner)
  let leaves = 0
  /** @param content - Complete prepared graph. Installs only in this disposable group scope. */
  function stage(content: Pick<TextboxProjectionResult, 'resources' | 'relationships'>): void {
    for (const resource of content.resources) resources.set(resource.key, resource)
    for (const relationship of content.relationships) relationships.set(relationship.key, relationship)
  }
  /** @param node - Validated original node. @param root - Whether this group owns the physical anchor. @returns Complete native branch in physical EMU coordinates. */
  function project(node: SourceDrawingGroupNode, root = false): DocxXmlElementPlan {
    const id = root ? rootId : nextGroupDrawingId(owner), frame = node.frame
    if (Object.values(frame).some(value => !Number.isInteger(value))) context.diagnose({ code: 'group-coordinates-rounded', kind: 'approximation', source: 'drawing-group',
      message: 'Original group scaling requires nearest-EMU rounding only at final XML projection.' })
    if (node.kind === 'group') return group(node, id, root)
    requireDoc(++leaves <= 256, 'unsupported-picture', 'Group leaf count exceeds the native simple-group host contract')
    if (node.kind === 'picture') {
      requireDoc(++owner.pictureAttempts <= owner.reader.limits.maxPictures, 'limit-exceeded', 'Picture occurrence limit exceeded')
      const media = preparePictureMedia(owner, node.picture, `doc-floating-picture-${node.mediaIndex}`, sourcePart, context)
      const result = pictureShape(node.picture, media.geometry, media.relationship.key, id, context, [frame.x, frame.y])
      stage({ resources: [media.resource], relationships: [media.relationship] })
      return result
    }
    let blocks: DocxXmlElementPlan[] | undefined
    if (node.box.textId > 0) {
      requireDoc(++owner.textboxAttempts <= owner.reader.limits.maxDrawings, 'limit-exceeded', 'Textbox occurrence limit exceeded')
      requireDoc(owner.textboxes, 'unsupported-picture', 'Textbox rich content owner is unavailable')
      const draft = owner.textboxes.prepare(node.box, pictures)
      requireDoc(!claims.has(draft.key), 'unsupported-picture', 'Group repeats an original author text owner')
      claims.add(draft.key); drafts.push(draft); blocks = draft.blocks; stage(draft)
    } else if (node.box.unprojected.length || node.box.unprojectedRecords.length) {
      context.diagnose({ code: 'textbox-properties-unprojected', kind: 'loss', source: 'textbox',
        message: 'An empty grouped rectangle retains uninterpreted source appearance properties or records.' })
    }
    return textboxShape(node.box, blocks, context, [frame.x, frame.y], { id, name: `doc-${node.box.kind}-${node.box.shapeId}` })
  }
  /** @param node - Complete source group. @param id - Unique native nonvisual identity. @param root - Whether this is the actual anchor owner. @returns Standard group with normalized physical child units. */
  function group(node: SourceDrawingGroup, id: number, root: boolean): DocxXmlElementPlan {
    const frame = node.frame, extent = { cx: Math.round(frame.width), cy: Math.round(frame.height) }
    const children = node.children.map(child => project(child))
    if (node.unprojected.length || node.unprojectedRecords.length) context.diagnose({ code: 'group-properties-unprojected', kind: 'loss', source: 'drawing-group',
      message: `Group ${node.shapeId} properties ${node.unprojected.join(', ')} and records ${node.unprojectedRecords.map(value => `0x${value.toString(16)}`).join(', ')} require additional interpretation.` })
    if (!root && node.lockAspect) context.diagnose({ code: 'nested-group-protection-host-limit', kind: 'host-limit', source: 'drawing-group',
      message: 'Independent editable leaves do not retain an inner group aspect-lock relationship.' })
    return e('wpg', root ? 'wgp' : 'grpSp', {}, [e('wpg', 'cNvPr', { id, name: `doc-group-${node.shapeId}` }), e('wpg', 'cNvGrpSpPr'),
      e('wpg', 'grpSpPr', {}, [e('a', 'xfrm', {}, [e('a', 'off', { x: Math.round(frame.x), y: Math.round(frame.y) }), e('a', 'ext', extent),
        e('a', 'chOff', { x: 0, y: 0 }), e('a', 'chExt', extent)])]), ...children])
  }
  // Every branch, relationship and XML budget must succeed before any original
  // author range becomes claimed. Failed work remains charged to shared limits.
  const graphic = project(source.group, true)
  const drawing = floatingDrawingAnchor({ id: rootId, name: `doc-group-${source.group.shapeId}`, extent: [source.group.frame.width, source.group.frame.height],
    placement: source.placement, lockAspect: source.group.lockAspect, graphicNamespace: drawingNamespaces.wpg, children: [graphic] }, context)
  context.diagnose({ code: 'drawing-group-host-limit', kind: 'host-limit', source: 'drawing-group',
    message: 'The initial DOCX retains the group; LitAST and Classic import its leaves as independently editable objects and fresh export omits the grouping relationship.' })
  if (source.staleClientAnchor) context.diagnose({ code: 'drawing-client-anchor-variant', kind: 'compatibility', source: 'drawing-group',
    message: 'A later group retains a zero ClientAnchor; its unique same-part CP/FSPA-to-shape association supplies the original position.' })
  for (const draft of drafts) draft.commit()
  return { drawing, resources: [...resources.values()], relationships: [...relationships.values()] }
}
