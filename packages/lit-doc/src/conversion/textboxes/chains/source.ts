import { requireDoc } from '../../../errors'
import type { SourceTextboxChain } from '../../../word/drawings/textboxes/types'
import { readPictureReference } from '../../../word/pictures/reference'
import { findSourceInterval } from '../../source/lookup'
import type { ConversionSource } from '../../source/types'

/** @param chain - Complete original same-part frame graph. @param source - Actual Story's resolved character and paragraph authorities. @returns Original run identities, after proving every cached frame will be visited in the same ordinary paragraph. */
export function validateTextboxChainControls(chain: SourceTextboxChain, source: ConversionSource): number[] {
  const first = chain.frames[0]!, paragraph = source.paragraphs[findSourceInterval(source.paragraphs, first.position)]
  requireDoc(paragraph && first.position >= paragraph.start && first.position < paragraph.end,
    'unsupported-picture', 'Textbox chain has no complete paragraph in the current source Story')
  requireDoc(!/[\u0013\u0014\u0015]/u.test(source.storage.text.slice(paragraph.start, paragraph.end)),
    'unsupported-picture', 'Textbox chains in source fields require separate displayed-control ownership')
  source.context.reader.consume(chain.frames.length)
  return chain.frames.map(frame => {
    requireDoc(frame.position >= paragraph.start && frame.position < paragraph.end && source.storage.text.charCodeAt(frame.position) === 8,
      'unsupported-picture', 'Textbox chain frames must have actual controls in the same complete source paragraph')
    const index = findSourceInterval(source.runs, frame.position), run = source.runs[index]
    requireDoc(run && run.start <= frame.position && frame.position < run.end && run.baseFormat.special,
      'unsupported-picture', 'Textbox chain frame lacks original special-character ownership')
    const role = readPictureReference(source.runOperations[index]!, source.context.reader)
    requireDoc(!role.binary && !role.object && !role.ole, 'unsupported-picture', 'Textbox chain frame is binary data or an embedded object')
    return index
  })
}
