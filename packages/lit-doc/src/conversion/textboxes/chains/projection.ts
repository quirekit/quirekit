import { requireDoc } from '../../../errors'
import type { SourceTextboxChain } from '../../../word/drawings/textboxes/types'
import type { ConversionSource } from '../../source/types'
import type { PictureProjection, PictureProjectionOwner } from '../../pictures/types'
import { withSourceRange } from '../../xml/location'
import { textboxDrawing } from '../drawing'
import { validateTextboxChainControls } from './source'
import type { TextboxChainProjectionResult } from './types'

/** @param chain - Complete original shape/FSPA graph. @param source - Current projected Story. @param owner - Shared budgets, identity counters and author ownership. @param pictures - Disposable author-media scope factory. @returns Entire staged chain; failure exposes no partial frame, text claim or resource graph. */
export function projectTextboxChain(chain: SourceTextboxChain, source: ConversionSource, owner: PictureProjectionOwner,
  pictures: (content: ConversionSource) => PictureProjection): TextboxChainProjectionResult {
  const runs = validateTextboxChainControls(chain, source), root = chain.frames[0]!
  // The dispatcher already charged its current occurrence. Remaining source
  // frames are charged once before any author content or target XML is built.
  owner.textboxAttempts += chain.frames.length - 1
  requireDoc(owner.textboxAttempts <= source.limits.maxDrawings, 'limit-exceeded', 'Textbox occurrence limit exceeded')
  requireDoc(owner.textboxes, 'unsupported-picture', 'Textbox rich content owner is unavailable')
  const content = owner.textboxes.prepareChain(chain, pictures), drawings = new Map<number, ReturnType<typeof textboxDrawing>>()
  const firstOrdinal = owner.textboxCount
  chain.frames.forEach((frame, sequence) => {
    const located = withSourceRange(owner.context, frame.position, frame.position + 1)
    const id = source.limits.maxPictures + (sequence === 0 ? firstOrdinal : ++owner.textboxCount)
    const drawing = textboxDrawing(frame, id, sequence === 0 ? content.blocks : undefined, located, { id: root.textId >>> 16, sequence })
    drawings.set(frame.position, drawing)
  })
  content.commit()
  for (const frame of chain.frames) if (frame.staleClientAnchor) withSourceRange(owner.context, frame.position, frame.position + 1).diagnose({
    code: 'drawing-client-anchor-variant', kind: 'compatibility', source: 'textbox',
    message: 'A later textbox retains a zero ClientAnchor; its unique same-part CP/FSPA-to-shape association supplies the original position.' })
  return { drawings, runs, resources: content.resources, relationships: content.relationships }
}
