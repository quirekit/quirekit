import { DocReadError, requireDoc } from '../../../errors'
import type { DocReadDiagnostic } from '../../../types'
import type { WordDocumentSource } from '../../document/types'
import { readPictureMedia } from '../../pictures/media'
import { readPictureReference } from '../../pictures/reference'
import type { PictureReadContext, SourcePictureFrame } from '../../pictures/types'
import { readDrawingData } from '../read'
import type { DocDrawingPart, DocDrawingShape, DrawingSourceData } from '../types'
import { readFloatingGroup } from '../groups/read'
import type { DrawingGroupIndex } from '../groups/types'
import { readFloatingPicture } from './read'
import type { FloatingPictureIndex, FloatingPictureReader } from './types'
import { readFloatingTextbox } from '../textboxes/read'
import { createTextboxChainReader } from '../textboxes/chains/read'
import type { TextboxChainReader } from '../textboxes/chains/types'
import type { PropertyOperation } from '../../properties/types'

/**
 * Keeps one complete source graph, private CP index and bounded media cache across every reachable story.
 * @param source - One document's private immutable streams.
 * @param context - Record, property-allocation and decoded-media budgets shared with inline pictures.
 * @param diagnostics - Compatibility observations from the same original drawing parse.
 * @returns Lazy ordinary drawing readers with no target XML or resource registration.
 */
export function createFloatingPictureReader(source: WordDocumentSource, context: PictureReadContext,
  diagnostics: DocReadDiagnostic[]): FloatingPictureReader {
  let data: DrawingSourceData | DocReadError | undefined
  const positions = new Map<number, FloatingPictureIndex>(), decoded = new Map<number, Pick<SourcePictureFrame, 'bytes' | 'mime'> | DocReadError>()
  const textboxShapes = new Set<DocDrawingShape>()
  const groupIndices = new WeakMap<DocDrawingPart, DrawingGroupIndex>()
  let textChains: TextboxChainReader | undefined

  /** @returns Complete once-read original source and its CP/shape association. */
  function graph(): DrawingSourceData {
    if (!data) {
      try {
        data = readDrawingData(source, context.reader, diagnostics, context.propertyBytes)
        for (const part of data.source.parts) {
          context.reader.consume(part.anchors.length * 2 + part.shapes.length)
          const shapes = new Map<number, DocDrawingShape | null>(), ranks = new Map<DocDrawingShape, number>()
          const references = new Map<number, number>()
          const children = new Map<number, DocDrawingShape[]>()
          for (const anchor of part.anchors) references.set(anchor.shapeId, (references.get(anchor.shapeId) ?? 0) + 1)
          part.shapes.forEach((shape, index) => {
            shapes.set(shape.id, shapes.has(shape.id) ? null : shape); ranks.set(shape, index)
            if (shape.parentId !== null) {
              const siblings = children.get(shape.parentId) ?? []; siblings.push(shape); children.set(shape.parentId, siblings)
            }
            // Original role depends on immutable shape facts. Classify each
            // shape once so repeated FSPA aliases cannot rescan large properties.
            if (shape.type === 202 || shape.unprojectedRecords.includes(0xf00d)
              || shape.propertyTables.some(table => table.properties.some(property => property.id === 128 && property.value !== 0))) textboxShapes.add(shape)
          })
          groupIndices.set(part, { shapes, children, anchors: references })
          part.anchors.forEach((anchor, anchorIndex) => {
            const shape = shapes.get(anchor.shapeId) ?? null
            const parent = shape?.parentId === null || !shape ? null : shapes.get(shape.parentId) ?? null
            positions.set(anchor.position, { part, anchor, anchorIndex, anchorReferences: references.get(anchor.shapeId)!, shape, parent, rank: shape ? ranks.get(shape)! : 0 })
          })
        }
      } catch (error) { if (!(error instanceof DocReadError)) throw error; data = error }
    }
    if (data instanceof DocReadError) throw data
    return data
  }

  /** @param index - Original one-based global media slot. @returns Once-decoded original bytes and MIME identity. */
  function media(index: number): Pick<SourcePictureFrame, 'bytes' | 'mime'> {
    let value = decoded.get(index)
    if (!value) {
      try { value = readPictureMedia(graph().media[index - 1]!, context) }
      catch (error) { if (!(error instanceof DocReadError)) throw error; value = error }
      decoded.set(index, value)
    }
    if (value instanceof DocReadError) throw value
    return value
  }
  /** @param position - Actual displayed source CP. @param special - Resolved source character role. @param operations - Original source operations. @returns Unique ordinary drawing owner in the correct actual document part. */
  function index(position: number, special: boolean, operations: readonly PropertyOperation[]): FloatingPictureIndex {
    const role = readPictureReference(operations, context.reader)
    requireDoc(special && !role.binary && !role.object && !role.ole,
      'unsupported-picture', 'Floating picture character lacks ordinary special-character ownership')
    graph(); const index = positions.get(position)
    requireDoc(index, 'unsupported-picture', 'Floating source character has no original main/header shape anchor')
    const story = source.header.stories[index.part.kind === 'main' ? 0 : 2]!
    requireDoc(position >= story.start && position < story.end, 'unsupported-picture', 'Floating anchor is not an actual character in its original document part')
    return index
  }
  return {
    isGroup(position) { graph(); return Boolean((positions.get(position)?.shape?.flags ?? 0) & 1) },
    readGroup(position, special, operations) {
      const selected = index(position, special, operations)
      return readFloatingGroup(selected, graph(), context, media, groupIndices.get(selected.part)!)
    },
    isTextbox(position) {
      graph(); const shape = positions.get(position)?.shape
      return Boolean(shape && textboxShapes.has(shape))
    },
    readTextbox(position, special, operations) { return readFloatingTextbox(index(position, special, operations), graph(), context, true) },
    readTextboxChain(box) { textChains ??= createTextboxChainReader(graph(), context); return textChains.read(box) },
    read(position, special, operations) { return readFloatingPicture(index(position, special, operations), graph(), context, media) },
  }
}
