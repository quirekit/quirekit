import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import { requireDoc } from '../../errors'
import type { ProjectionContext } from '../xml/types'
import type { ProjectInlinePicture } from '../pictures/types'
import type { ProjectInlineComment, ProjectInlineNote } from './types'
import type { FieldProjection } from '../fields/types'

/**
 * Projects one run's controls without rendering instructions, cell markers or object bytes as text.
 * @param text - Complete original story storage.
 * @param start - First unconsumed source CP.
 * @param end - Exclusive format boundary, which may split a surrogate pair.
 * @param paragraphEnd - Exclusive text CP before the paragraph marker.
 * @param fields - Story-wide marker, instruction and ownership authority.
 * @param context - Located output and loss-report owner.
 * @param picture - Optional owner for displayed source image anchors.
 * @param note - Optional owner for displayed source note controls.
 * @param comment - Optional owner for source comment references or message self markers.
 * @param floating - Optional owner for original floating drawing controls.
 * @returns Typed run children and the next source CP, possibly one unit beyond the format cut.
 */
export function projectInline(text: string, start: number, end: number, paragraphEnd: number, fields: FieldProjection | undefined,
  context: ProjectionContext, picture?: ProjectInlinePicture, note?: ProjectInlineNote, comment?: ProjectInlineComment,
  floating?: ProjectInlinePicture): { children: DocxXmlElementPlan[], next: number } {
  const children: DocxXmlElementPlan[] = []
  let buffer = ''
  let position = start
  /** Flushes a complete XML-safe text segment after control/format boundaries. */
  function flush(): void { if (buffer) { children.push(context.element(fields?.inInstruction ? 'instrText' : 't', {}, [buffer])); buffer = '' } }
  while (position < end && position < paragraphEnd) {
    const cp = position
    const code = text.codePointAt(position)!
    const width = code > 0xffff ? 2 : 1
    position += width
    if (width === 2 && position > end) context.diagnose({ code: 'surrogate-format-boundary-approximated', kind: 'approximation', source: 'character', start: cp, end: position,
      message: 'A source format cut bisects a surrogate pair; the complete scalar uses the first code unit format.' })
    if (code === 19 || code === 20 || code === 21) {
      flush()
      requireDoc(fields, 'invalid-field-data', 'Source field controls require their Story owner')
      const marker = fields.project(cp, code)
      if (marker) children.push(marker)
      continue
    }
    if (fields?.inInstruction) {
      // A child result inside an ancestor's code region remains instrText.
      // Resource owners are not invoked for unsupported instruction controls,
      // so omitted references cannot leave orphan media or note relationships.
      if ([1, 2, 5, 8, 11, 12, 14].includes(code)) {
        flush()
        context.diagnose({ code: 'field-instruction-control-unprojected', kind: 'loss', source: 'field', start: cp, end: cp + 1,
          message: `Instruction control 0x${code.toString(16)} requires a dedicated field resource/control contract and is omitted.` })
      } else if (!fields.omitInstruction) buffer += code === 30 ? '\u2011' : code === 31 ? '\u00ad' : String.fromCodePoint(code)
      continue
    }
    if ([9, 11, 12, 14].includes(code)) {
      flush()
      children.push(code === 9 ? context.element('tab') : context.element('br', { type: code === 11 ? 'textWrapping' : code === 12 ? 'page' : 'column' }))
    } else if (code === 1 && picture) {
      flush()
      const drawing = picture(cp)
      if (drawing) children.push(drawing)
    } else if (code === 8 && floating) {
      flush()
      const drawing = floating(cp)
      if (drawing) children.push(drawing)
    } else if (code === 2 && note) {
      flush()
      const reference = note(cp)
      if (reference) children.push(reference)
      else context.diagnose({ code: 'object-anchor-unprojected', kind: 'loss', source: 'object', start: cp, end: cp + 1,
        message: 'The source note control has no admitted reference or self-marker authority.' })
    } else if (code === 5 && comment) {
      flush()
      const reference = comment(cp, fields?.inField ?? false)
      if (reference) children.push(reference)
      else if (reference === undefined) context.diagnose({ code: 'comment-control-unprojected', kind: 'loss', source: 'comment', start: cp, end: cp + 1,
        message: 'The source comment control has no admitted displayed message or self-marker authority.' })
    } else if ([1, 2, 5, 8].includes(code)) {
      flush()
      context.diagnose({ code: 'object-anchor-unprojected', kind: 'loss', source: 'object', start: cp, end: cp + 1,
        message: `Source anchor 0x${code.toString(16)} is omitted until its image, note, comment or drawing authority is projected.` })
    } else if (code === 30 || code === 31) buffer += code === 30 ? '\u2011' : '\u00ad'
    else buffer += String.fromCodePoint(code)
  }
  flush()
  return { children, next: position }
}
