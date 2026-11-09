import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { SourceFloatingTextbox } from '../../word/drawings/textboxes/types'
import type { ProjectionContext } from '../xml/types'
import { floatingDrawingAnchor } from '../drawings/anchor'
import { drawingNamespaces } from '../drawings/xml'
import { textboxShape } from './shape'
import type { TextboxChainLink } from './chains/types'

/** @param box - Complete original ordinary frame. @param id - Unique drawing identity. @param blocks - Already admitted author content, absent for a chain continuation. @param context - Bounded namespace-aware output. @param link - Validated source-chain role, absent for a single frame. @returns Ordinary anchored text frame, using the same shape serializer as grouped frames. */
export function textboxDrawing(box: SourceFloatingTextbox, id: number, blocks: DocxXmlElementPlan[] | undefined, context: ProjectionContext,
  link?: TextboxChainLink): DocxXmlElementPlan {
  const shape = textboxShape(box, blocks, context, [0, 0], undefined, link)
  return floatingDrawingAnchor({ id, name: 'doc-' + box.kind + '-' + box.shapeId, extent: box.extent, placement: box.placement,
    lockAspect: box.lockAspect, graphicNamespace: drawingNamespaces.wps, children: [shape] }, context)
}
