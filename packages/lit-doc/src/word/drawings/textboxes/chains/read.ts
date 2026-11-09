import { DocReadError, requireDoc } from '../../../../errors'
import type { PictureReadContext } from '../../../pictures/types'
import type { DocDrawingPart, DocDrawingShape, DrawingSourceData } from '../../types'
import type { FloatingPictureIndex } from '../../pictures/types'
import { readTextShapeIdentity } from '../identity'
import { readFloatingTextbox } from '../read'
import type { SourceFloatingTextbox, SourceTextboxChain, TextShapeIdentitySource } from '../types'
import type { TextboxChainIndex, TextboxChainReader } from './types'

/** @param data - Complete immutable source graph. @param context - Shared work budgets. @returns Once-indexed graph closure, independent of cached display fragments and author content. */
export function createTextboxChainReader(data: DrawingSourceData, context: PictureReadContext): TextboxChainReader {
  const indices = new WeakMap<DocDrawingPart, TextboxChainIndex>()
  /** @param part - Original same-part shapes and FSPAs. @returns Complete once-built source association. */
  function index(part: DocDrawingPart): TextboxChainIndex {
    const cached = indices.get(part)
    if (cached) return cached
    const identities = new Map<DocDrawingShape, TextShapeIdentitySource>(), slots = new Map<number, DocDrawingShape[]>(), incoming = new Map<number, number>()
    const shapes = new Map<number, DocDrawingShape | null>(), ranks = new Map<DocDrawingShape, number>(), anchors = new Map<number, FloatingPictureIndex | null>()
    let uncertain = false
    context.reader.consume(part.shapes.length + part.anchors.length)
    part.shapes.forEach((shape, rank) => { shapes.set(shape.id, shapes.has(shape.id) ? null : shape); ranks.set(shape, rank) })
    for (const shape of part.shapes) {
      if (shape.type !== 202 && !shape.unprojectedRecords.includes(0xf00d)
        && !shape.propertyTables.some(table => table.properties.some(property => property.id === 128 && property.value !== 0))) continue
      let identity: TextShapeIdentitySource
      try { identity = readTextShapeIdentity(shape, data, context) } catch (error) {
        if (!(error instanceof DocReadError) || !['invalid-drawing-data', 'unsupported-picture'].includes(error.code)) throw error
        uncertain = true; continue
      }
      identities.set(shape, identity)
      if (identity.textId >>> 16) {
        const slot = identity.textId >>> 16, entries = slots.get(slot) ?? []
        entries.push(shape); slots.set(slot, entries)
      }
      if (identity.nextShapeId) incoming.set(identity.nextShapeId, (incoming.get(identity.nextShapeId) ?? 0) + 1)
    }
    part.anchors.forEach((anchor, anchorIndex) => {
      const shape = shapes.get(anchor.shapeId) ?? null, parent = shape?.parentId == null ? null : shapes.get(shape.parentId) ?? null
      anchors.set(anchor.shapeId, anchors.has(anchor.shapeId) ? null : { part, anchor, anchorIndex, anchorReferences: 1, shape, parent, rank: shape ? ranks.get(shape)! : 0 })
    })
    const result = { identities, slots, incoming, anchors, uncertain, chains: new Map<number, SourceTextboxChain | DocReadError>() }
    indices.set(part, result); return result
  }
  return { read(frame) {
    const part = data.source.parts[frame.kind === 'textbox' ? 0 : 1]!, source = index(part), slot = frame.textId >>> 16
    const candidates = source.slots.get(slot) ?? []
    if (candidates.length === 1 && (frame.textId & 65535) === 0 && [0, frame.shapeId].includes(frame.nextShapeId)
      && (source.incoming.get(frame.shapeId) ?? 0) === (frame.nextShapeId === 0 ? 0 : 1)) return undefined
    let chain = source.chains.get(slot)
    if (!chain) {
      try {
        requireDoc(!source.uncertain && candidates.length >= 2, 'unsupported-picture', 'Textbox chain has no complete unambiguous original shape identity graph')
        const ordered = [...candidates].sort((a, b) => (source.identities.get(a)!.textId & 65535) - (source.identities.get(b)!.textId & 65535))
        const frames = ordered.map((shape, sequence) => {
          const identity = source.identities.get(shape)!, anchor = source.anchors.get(shape.id)
          requireDoc((identity.textId & 65535) === sequence && identity.nextShapeId === (ordered[sequence + 1]?.id ?? 0)
            && (source.incoming.get(shape.id) ?? 0) === (sequence === 0 ? 0 : 1), 'unsupported-picture', 'Textbox chain has a missing, duplicate, cyclic or branching original sequence')
          requireDoc(anchor?.shape === shape, 'unsupported-picture', 'Textbox chain requires one unique original same-part shape and FSPA per frame')
          return readFloatingTextbox(anchor, data, context, true, identity)
        })
        chain = { frames }
      } catch (error) { if (!(error instanceof DocReadError)) throw error; chain = error }
      source.chains.set(slot, chain)
    }
    if (chain instanceof DocReadError) throw chain
    const member = chain.frames[frame.textId & 65535]
    requireDoc(member?.shapeId === frame.shapeId && member.position === frame.position,
      'unsupported-picture', 'Textbox occurrence is not a unique member of its original chain')
    return chain
  } }
}
