import type { DocxXmlChildPlan, DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { DocCommentEntry } from '../../word/comments/types'
import type { ProjectionContext } from '../xml/types'
import type { CommentBoundaryProjection, CommentRangeEvent, PendingCommentOutput } from './types'

/**
 * Emits original range endpoints without imposing a nesting stack on crossing ranges.
 * @param entries - Validated source comment directory.
 * @param pending - Messages with complete staged bodies.
 * @param failed - Message failures propagated to atomic thread admission.
 * @param text - Original UTF-16 storage, used only to reject scalar-splitting endpoints.
 * @param context - Shared bounded XML and loss owner.
 * @returns Monotonic source-CP range producer.
 */
export function commentRanges(entries: readonly DocCommentEntry[], pending: ReadonlyMap<number, PendingCommentOutput>,
  failed: Set<number>, text: string, context: ProjectionContext): CommentBoundaryProjection {
  const events: CommentRangeEvent[] = []
  /** @param cp - Source endpoint. @returns Whether it divides one Unicode scalar. */
  function splitsScalar(cp: number): boolean {
    return cp > 0 && text.charCodeAt(cp - 1) >= 0xd800 && text.charCodeAt(cp - 1) <= 0xdbff
      && text.charCodeAt(cp) >= 0xdc00 && text.charCodeAt(cp) <= 0xdfff
  }
  for (const entry of entries) {
    if (!entry.range || !pending.has(entry.index)) continue
    if (splitsScalar(entry.range.start) || splitsScalar(entry.range.end)) {
      failed.add(entry.index)
      context.diagnose({ code: 'comment-surrogate-boundary-unprojected', kind: 'loss', source: `comment:${entry.index}`,
        start: entry.range.start, end: entry.range.end, message: 'A source annotation range divides a Unicode scalar; its complete thread is omitted without moving the range.' })
      continue
    }
    if (!(entry.range.rawFlags & 0x4000)) context.diagnose({ code: 'comment-range-export-hint-unprojected', kind: 'loss',
      source: `comment:${entry.index}`, start: entry.range.start, end: entry.range.end,
      message: 'The annotation bookmark disposable/export hint has no standard comment-range counterpart; the original named message target is retained.' })
    if (entry.range.end === entry.range.start + 1 && [1, 8].includes(text.charCodeAt(entry.range.start))) context.diagnose({
      code: 'comment-object-target-unverified', kind: 'host-limit', source: `comment:${entry.index}`, start: entry.range.start, end: entry.range.end,
      message: 'The original annotation targets one source object; object import and native object-range selection have independent admission and are not inferred from the retained comment markers.' })
    events.push({ position: entry.range.start, index: entry.index, start: true }, { position: entry.range.end, index: entry.index, start: false })
  }
  events.sort((a, b) => a.position - b.position || Number(a.start) - Number(b.start) || a.index - b.index)
  let cursor = 0
  return {
    /** @param position - Exact next source CP. @param inField - Any open field ownership. @returns Paragraph-level range events at this boundary. */
    at(position: number, inField: boolean): DocxXmlElementPlan[] {
      const result: DocxXmlElementPlan[] = []
      // Row-only boundaries have no paragraph carrier. They remain uncounted
      // so final thread admission removes the other endpoint and reference.
      while (events[cursor] && events[cursor]!.position < position) cursor++
      while (events[cursor]?.position === position) {
        const event = events[cursor++]!, output = pending.get(event.index)!
        if (inField) { failed.add(event.index); continue }
        output.boundaries++
        if (output.source.extra?.parentIndex !== null && output.source.extra?.parentIndex !== undefined) continue
        result.push(context.element(event.start ? 'commentRangeStart' : 'commentRangeEnd', { id: event.index }))
      }
      return result
    },
    /** @param end - Current format/paragraph cut. @returns Earlier range event or unchanged cut. */
    next: end => Math.min(end, events[cursor]?.position ?? end),
  }
}

/**
 * Removes all references and endpoints of unadmitted threads after main-flow projection.
 * @param root - Complete typed document tree.
 * @param omitted - Decimal message identities belonging to refused threads.
 * @returns Complete document retaining unrelated text, resources and properties.
 */
export function omitCommentThreads(root: DocxXmlElementPlan, omitted: ReadonlySet<string>): DocxXmlElementPlan {
  return { ...root, children: root.children.flatMap<DocxXmlChildPlan>(child => {
    if (typeof child === 'string') return [child]
    if (['commentRangeStart', 'commentRangeEnd', 'commentReference'].includes(child.localName)
      && omitted.has(String(child.attributes.find(attribute => attribute.localName === 'id')?.value))) return []
    return [omitCommentThreads(child, omitted)]
  }) }
}
