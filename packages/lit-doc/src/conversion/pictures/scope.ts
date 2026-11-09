import type { DocxRelationshipPlan, DocxResourcePlan } from '@quirekit/lit-docx-contract'
import { DocReadError, requireDoc } from '../../errors'
import { readPictureReference } from '../../word/pictures/reference'
import type { SourcePictureFrame } from '../../word/pictures/types'
import type { FloatingPicturePlacement } from '../../word/drawings/pictures/types'
import type { ConversionSource } from '../source/types'
import { withSourceRange } from '../xml/location'
import { pictureDrawing } from './drawing'
import { preparePictureMedia } from './media'
import { nextGroupDrawingId } from '../groups/identity'
import { projectDrawingGroup } from '../groups/projection'
import type { PictureProjection, PictureProjectionOwner } from './types'
import type { TextboxProjectionResult } from '../textboxes/types'
import { recoverStorySource } from '../source/policy'
import { projectTextboxChain } from '../textboxes/chains/projection'

/**
 * Owns atomic per-Story image graph registration while retaining document-wide media budgets and identities.
 * @param owner - Once-created document readers, counters and output policy.
 * @param source - This Story's original resolved character operations.
 * @param sourcePart - Exact OPC owner of emitted image relationships.
 * @param grouped - Whether contained media uses the new group identity range.
 * @returns Disposable media graph and ordinary inline/floating source callbacks.
 */
export function createPictureScope(owner: PictureProjectionOwner, source: ConversionSource, sourcePart: string, grouped = false): PictureProjection {
  const resources: DocxResourcePlan[] = [], relationships: DocxRelationshipPlan[] = [], registered = new Set<string>(), handledRuns = new Set<number>()
  const registeredRelationships = new Set<string>()
  const linkedFrames = new Map<number, ReturnType<PictureProjection['projectFloating']>>()
  const { context } = owner
  /** @param result - Complete disposable drawing graph. Only successful drawings install reachable resources. */
  function install(result: Pick<TextboxProjectionResult, 'resources' | 'relationships'>): void {
    for (const resource of result.resources) if (!registered.has(resource.key)) { resources.push(resource); registered.add(resource.key) }
    for (const relationship of result.relationships) if (!registeredRelationships.has(relationship.key)) {
      relationships.push(relationship); registeredRelationships.add(relationship.key)
    }
  }
  /** @param position - Exact original CP. @param runIndex - Resolved character owner. @param floating - Source anchor family. @returns Complete validated drawing or explicit known refusal. */
  function project(position: number, runIndex: number, floating: boolean) {
    if (floating && linkedFrames.has(position)) return linkedFrames.get(position)
    const located = withSourceRange(context, position, position + 1)
    let picture: SourcePictureFrame, resourceKey: string, placement: FloatingPicturePlacement | undefined
    let textbox = false, group = false, id = 0
    try {
      if (floating && owner.floating.isGroup(position)) {
        group = true
        // Retain the historical standalone media ordinal, while actual media
        // work and all new group identities have their own bounded counters.
        owner.count++
        const frame = owner.floating.readGroup(position, source.runs[runIndex]!.baseFormat.special, source.runOperations[runIndex]!)
        const result = projectDrawingGroup(frame, owner, sourcePart, content => createPictureScope(owner, content, sourcePart, true), located)
        install(result); handledRuns.add(runIndex)
        return result.drawing
      }
      if (floating && owner.floating.isTextbox(position)) {
        textbox = true
        requireDoc(++owner.textboxAttempts <= source.limits.maxDrawings, 'limit-exceeded', 'Textbox occurrence limit exceeded')
        owner.textboxCount++
        requireDoc(owner.textboxes, 'unsupported-picture', 'Textbox rich content owner is unavailable')
        const frame = owner.floating.readTextbox(position, source.runs[runIndex]!.baseFormat.special, source.runOperations[runIndex]!)
        const chain = owner.floating.readTextboxChain(frame)
        if (chain) {
          const result = projectTextboxChain(chain, source, owner, content => createPictureScope(owner, content, sourcePart))
          for (const [cp, drawing] of result.drawings) linkedFrames.set(cp, drawing)
          for (const index of result.runs) handledRuns.add(index)
          install(result)
          return linkedFrames.get(position)
        }
        const result = owner.textboxes.project(frame, source.limits.maxPictures + owner.textboxCount,
          content => createPictureScope(owner, content, sourcePart))
        // Only complete author content makes this frame reachable. Its inline
        // image relationships belong to the containing OPC part, not a new part.
        install(result)
        handledRuns.add(runIndex)
        if (frame.staleClientAnchor) located.diagnose({ code: 'drawing-client-anchor-variant', kind: 'compatibility', source: 'textbox',
          message: 'A later textbox retains a zero ClientAnchor; its unique same-part CP/FSPA-to-shape association supplies the original position.' })
        return result.drawing
      }
      requireDoc(++owner.pictureAttempts <= source.limits.maxPictures, 'limit-exceeded', 'Picture occurrence limit exceeded')
      const ordinal = grouped ? 0 : ++owner.count
      id = grouped || ordinal > source.limits.maxPictures ? nextGroupDrawingId(owner) : ordinal
      if (floating) {
        const result = owner.floating.read(position, source.runs[runIndex]!.baseFormat.special, source.runOperations[runIndex]!)
        picture = result.picture; placement = result.placement; resourceKey = `doc-floating-picture-${result.mediaIndex}`
        if (result.staleClientAnchor) located.diagnose({ code: 'drawing-client-anchor-variant', kind: 'compatibility', source: 'picture',
          message: 'A later picture retains a zero ClientAnchor; its unique same-part CP/FSPA-to-shape association supplies the original position.' })
      } else {
        const reference = readPictureReference(source.runOperations[runIndex]!, owner.reader.reader)
        requireDoc(source.runs[runIndex]!.baseFormat.special && reference.offset !== null,
          'unsupported-picture', 'Picture anchor lacks a special-character locator')
        requireDoc(!reference.binary && !reference.object && !reference.ole,
          'unsupported-picture', 'Binary field data and embedded object previews require separate owners')
        picture = owner.inline(reference.offset); resourceKey = `doc-picture-${reference.offset}`
      }
    } catch (error) {
      if (!(error instanceof DocReadError) || !(['invalid-picture-data', 'unsupported-picture', 'invalid-drawing-data'].includes(error.code)
        || (textbox || group) && recoverStorySource(error, context))
        || context.report.lossPolicy !== 'best-effort') throw error
      located.diagnose({ code: group ? 'floating-group-unprojected' : textbox ? 'floating-textbox-unprojected' : floating ? 'floating-picture-unprojected' : 'picture-unprojected', kind: 'loss', source: group ? 'drawing-group' : textbox ? 'textbox' : 'picture',
        message: `${group ? 'Floating group' : textbox ? 'Floating textbox' : floating ? 'Floating drawing' : 'Inline picture'} is omitted (${error.code}: ${error.message}).` })
      return undefined
    } finally {
      for (; owner.emittedCompatibility < owner.compatibility.length; owner.emittedCompatibility++)
        context.diagnose({ ...owner.compatibility[owner.emittedCompatibility]!, kind: 'compatibility', source: 'office-art' })
    }
    // Media, occurrence geometry and target XML must all be valid before a
    // relationship becomes reachable. Occurrence byte work remains separate from
    // once-decoded shared resources, including across different Story parts.
    const media = preparePictureMedia(owner, picture, resourceKey, sourcePart, located)
    if (placement && ['tight', 'through'].includes(placement.wrap)) located.diagnose({ code: 'floating-picture-wrap-approximated', kind: 'approximation', source: 'picture',
      message: 'Source tight/through wrapping is explicitly approximated as square; the image codec does not yet retain the original contour through fresh LitAST and Classic export.' })
    const drawing = pictureDrawing(picture, media.geometry, media.relationship.key, id, located, placement)
    install({ resources: [media.resource], relationships: [media.relationship] })
    handledRuns.add(runIndex)
    return drawing
  }
  return { resources, relationships, handledRuns,
    project: (position, index) => project(position, index, false),
    projectFloating: (position, index) => project(position, index, true) }
}
