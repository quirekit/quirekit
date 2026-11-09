import { requireDoc } from '../../errors'
import { projectStoryBlocks } from '../body/story'
import type { NumberingProjection } from '../numbering/types'
import type { StyleProjection } from '../styles/types'
import type { ProjectionContext } from '../xml/types'
import { withSourceRange } from '../xml/location'
import type { SourceTextboxChain } from '../../word/drawings/textboxes/types'
import { textboxDrawing } from './drawing'
import type { TextboxContentDraft, TextboxInput, TextboxProjection } from './types'

/** @param input - Complete independent source parts. @param styles - Shared named-style owner. @param numbering - Shared canonical numbering graph. @param context - Bounded projection/loss owner. @returns Original-identity text projection and complete author-content omission accounting. */
export function createTextboxProjection(input: TextboxInput, styles: StyleProjection, numbering: NumberingProjection,
  context: ProjectionContext): TextboxProjection {
  const claimed = new Set<string>()
  /** @param box - Actual first source shape. @param pictures - Isolated media scope factory. @param chain - Complete original multi-frame graph, absent for a single frame. @returns Prepared original content without an ownership mutation. */
  const prepare = (box: Parameters<TextboxProjection['prepare']>[0], pictures: Parameters<TextboxProjection['prepare']>[1], chain?: SourceTextboxChain): TextboxContentDraft => {
    const part = input.parts.get(box.kind), entry = part?.directory.entries[(box.textId >>> 16) - 1], content = part?.content
    requireDoc(entry && !entry.reusable && entry.shapeId === box.shapeId && content && (box.textId & 65535) === 0 && (chain || entry.data[0] === 1),
      'unsupported-picture', chain ? 'Textbox chain has no exact first-frame source text owner or usable formatting'
        : 'Textbox has no exact single-frame source text owner or usable formatting')
    const selfLinked = box.nextShapeId !== 0 && box.nextShapeId === box.shapeId
    if (chain) requireDoc(chain.frames.length >= 2 && chain.frames[0] === box && part?.owners.get(box.shapeId) === entry.index
      && (entry.data[0] === chain.frames.length || entry.data[0] === 1), 'unsupported-picture', 'Textbox chain count or original first-frame author owner is inconsistent')
    else requireDoc(box.nextShapeId === 0 || selfLinked && part?.owners.get(box.shapeId) === entry.index,
      'unsupported-picture', 'Textbox next-shape operand has no unique single-frame text-chain authority')
    const key = `${box.kind}:${entry.index}`
    requireDoc(!claimed.has(key), 'unsupported-picture', 'Textbox source chain was already claimed by another drawing')
    const story = content.header.stories[box.kind === 'textbox' ? 5 : 6]!
    const start = story.start + entry.start, end = story.start + entry.end - 1
    requireDoc(end > start && content.storage.text.charCodeAt(end) === 13,
      'invalid-story-data', 'Textbox author content has no independent trailing guard')
    requireDoc(!content.storage.text.slice(start, end).includes('\u0008'), 'unsupported-picture', 'Nested floating drawings require their own textbox resource lifecycle')
    const media = pictures(content), located = withSourceRange(context, box.position, box.position + 1)
    const blocks = projectStoryBlocks(content, styles, context, { start, end }, numbering, media)
    return { key, blocks, resources: media.resources, relationships: media.relationships,
      /** Commits only after the caller has built every containing drawing branch. */
      commit() {
        requireDoc(!claimed.has(key), 'unsupported-picture', 'Textbox source chain was already claimed by another drawing')
        if (chain && entry.data[0] === 1) located.diagnose({ code: 'textbox-chain-count-variant', kind: 'compatibility', source: 'textbox',
          message: 'The original textbox descriptor stores count one; a complete unique shape/FSPA graph, consecutive original text sequences and exact next-shape edges establish the actual multi-frame chain.' })
        if (selfLinked && !chain) located.diagnose({ code: 'textbox-self-link-variant', kind: 'compatibility', source: 'textbox',
          message: 'A self next-shape operand is terminal because the unique original text descriptor and FSPA establish one frame with sequence zero.' })
        for (const frame of chain?.frames ?? [box]) {
          const frameContext = frame === box ? located : withSourceRange(context, frame.position, frame.position + 1)
          if (frame.placement.wrap === 'tight' || frame.placement.wrap === 'through') frameContext.diagnose({ code: 'floating-textbox-wrap-approximated', kind: 'approximation', source: 'textbox',
            message: 'Textbox contour wrapping is explicitly approximated as square until its original contour has a native projection.' })
          if (frame.unprojected.length || frame.unprojectedRecords.length) frameContext.diagnose({ code: 'textbox-properties-unprojected', kind: 'loss', source: 'textbox',
            message: `Textbox properties ${frame.unprojected.join(', ')} and records ${frame.unprojectedRecords.map(value => `0x${value.toString(16)}`).join(', ')} require further interpretation.` })
        }
        claimed.add(key)
      },
    }
  }
  return { prepare,
    prepareChain(chain, pictures) { return prepare(chain.frames[0]!, pictures, chain) },
    project(box, id, pictures) {
      const content = prepare(box, pictures), located = withSourceRange(context, box.position, box.position + 1)
      const drawing = textboxDrawing(box, id, content.blocks, located)
      content.commit()
      return { drawing, resources: content.resources, relationships: content.relationships }
    },
    finish() {
      for (const [kind, part] of input.parts) for (const entry of part.directory.entries) {
        if (entry.reusable || claimed.has(`${kind}:${entry.index}`)) continue
        context.diagnose({ code: 'textbox-content-unreferenced', kind: 'loss', source: `story:${kind}`,
          message: 'Original textbox author content has no admitted reachable single-frame drawing owner.' })
      }
    },
  }
}
