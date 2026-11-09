import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { DocBookmarkEntry } from '../../word/bookmarks/types'
import type { StoryProjectionRange } from '../body/types'
import type { ConversionSource } from '../source/types'
import type { ProjectionContext } from '../xml/types'
import { bookmarkEvents, firstBookmark } from './events'
import { omitBookmarkPairs } from './filter'
import type { BookmarkProjection } from './types'

/**
 * Projects actual-Story boundaries while keeping every source pair atomic.
 * @param source - Shared source index and canonical character/paragraph authorities.
 * @param range - Exact independently owned content interval.
 * @param context - Bounded typed XML and explicit loss owner.
 * @returns Source-ordered paragraph marker producer.
 */
export function createBookmarkProjection(source: ConversionSource, range: StoryProjectionRange, context: ProjectionContext): BookmarkProjection {
  const state = source.bookmarkState, entries: DocBookmarkEntry[] = []
  const omitted = new Map<number, string>(), counts = new Map<number, number>()
  const cachedTargets = new Set<number>()
  const text = source.storage.text
  /** @param cp - Source endpoint. @returns Whether the endpoint bisects one Unicode scalar. */
  function splitsScalar(cp: number): boolean {
    return cp > 0 && text.charCodeAt(cp - 1) >= 0xd800 && text.charCodeAt(cp - 1) <= 0xdbff
      && text.charCodeAt(cp) >= 0xdc00 && text.charCodeAt(cp) <= 0xdfff
  }
  /** @param entry - Original paired range. @param code - Stable explicit handling. @param message - Concrete ownership boundary. @param kind - Semantic loss or informational omission. */
  function diagnose(entry: DocBookmarkEntry, code: string, message: string, kind: 'loss' | 'compatibility' = 'loss'): void {
    context.diagnose({ code, kind, source: 'bookmark', start: entry.start, end: entry.end, message })
  }
  for (let index = firstBookmark(state.source.entries, range.start); index < state.source.entries.length; index++) {
    const entry = state.source.entries[index]!
    if (entry.start >= range.end) break
    state.attempted.add(entry.index)
    if (entry.end > range.end) {
      diagnose(entry, 'bookmark-story-boundary-unprojected', 'The complete bookmark crosses an independently owned Story; both markers are omitted.')
    } else if (entry.name === '_GoBack') {
      diagnose(entry, 'bookmark-navigation-marker-omitted', 'The source application navigation bookmark is omitted under the existing temporary-navigation policy.', 'compatibility')
    } else if (splitsScalar(entry.start) || splitsScalar(entry.end)) {
      diagnose(entry, 'bookmark-surrogate-boundary-unprojected', 'A bookmark endpoint bisects a Unicode scalar; the complete pair is omitted without splitting or changing the text.')
    } else {
      entries.push(entry)
      counts.set(entry.index, 0)
      if (!entry.native) diagnose(entry, 'bookmark-export-hint-unprojected',
        'The source disposable/export hint has no OOXML counterpart; the named target is retained to preserve references.')
      if (entry.columns) context.diagnose({ code: 'bookmark-column-navigation-unverified', kind: 'host-limit', source: 'bookmark', start: entry.start, end: entry.end,
        message: 'Source table-column bounds are retained as colFirst/colLast; rectangular column navigation and reference evaluation require separate host admission.' })
    }
  }
  const events = bookmarkEvents(entries)
  let cursor = 0

  /** @param position - Exact next source CP. @param inInstruction - Current field-code ownership. @param inField - Current source field or cache ownership. @returns Complete paragraph-level markers at this CP. */
  function at(position: number, inInstruction: boolean, inField: boolean): DocxXmlElementPlan[] {
    const result: DocxXmlElementPlan[] = []
    // Table row terminators may have no paragraph carrier. Skipped events stay
    // uncounted, so Story completion removes their other marker atomically.
    while (events[cursor] && events[cursor]!.position < position) cursor++
    while (events[cursor]?.position === position) {
      const event = events[cursor++]!, entry = event.entry
      counts.set(entry.index, counts.get(entry.index)! + 1)
      if (inInstruction) { omitted.set(entry.index, 'bookmark-instruction-unprojected'); continue }
      if (inField && !cachedTargets.has(entry.index)) {
        cachedTargets.add(entry.index)
        context.diagnose({ code: 'bookmark-field-cache-navigation-unverified', kind: 'host-limit', source: 'bookmark', start: entry.start, end: entry.end,
          message: 'Bookmark markers in a field cache are retained by the rich-result codec; native global navigation and reference evaluation inside opaque caches require separate host admission.' })
      }
      result.push(event.start ? context.element('bookmarkStart', { id: entry.index, name: entry.name,
        ...(entry.columns ? { colFirst: entry.columns.first, colLast: entry.columns.limit - 1 } : {}) })
        : context.element('bookmarkEnd', { id: entry.index }))
    }
    return result
  }

  /** @param blocks - Whole actual Story before installation. @returns Typed graph without any half-admitted bookmark pair. */
  function finish(blocks: DocxXmlElementPlan[]): DocxXmlElementPlan[] {
    for (const entry of entries) {
      if (counts.get(entry.index) !== 2 && !omitted.has(entry.index)) omitted.set(entry.index, 'bookmark-boundary-unprojected')
      const code = omitted.get(entry.index)
      if (code) diagnose(entry, code, code === 'bookmark-instruction-unprojected'
        ? 'A bookmark boundary belongs to field instruction data without an admitted bookmark carrier; both markers are omitted.'
        : 'A bookmark boundary has no projected paragraph carrier at its source CP; both markers are omitted without moving the range.')
    }
    return omitted.size ? omitBookmarkPairs(blocks, new Set([...omitted.keys()].map(String))) : blocks
  }
  return { at,
    /** @param end - Current run or paragraph limit. @returns Next event cut or the unchanged limit. */
    next: end => Math.min(end, events[cursor]?.position ?? end), finish }
}
