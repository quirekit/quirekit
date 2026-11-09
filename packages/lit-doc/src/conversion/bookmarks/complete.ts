import type { ConversionDocumentSource } from '../source/types'
import type { ProjectionContext } from '../xml/types'

/**
 * Accounts for complete pairs whose parts or source endpoints had no converted Story.
 * @param source - Document-wide source and attempted range accounting.
 * @param context - Complete conversion's loss-report owner.
 */
export function finishDocumentBookmarks(source: ConversionDocumentSource, context: ProjectionContext): void {
  for (const entry of source.bookmarkState.source.entries) if (!source.bookmarkState.attempted.has(entry.index)) {
    context.diagnose({ code: 'bookmark-story-unprojected', kind: 'loss', source: 'bookmark', start: entry.start, end: entry.end,
      message: 'This complete bookmark belongs to an unconverted Story or a source endpoint without a projected paragraph carrier; both markers are omitted.' })
  }
}
