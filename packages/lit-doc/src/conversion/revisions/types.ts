import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { DocRevisionAuthorsSource } from '../../word/revisions/types'

/** Document-owned source authors and deterministic output identity allocation, shared by every Story. */
export interface ConversionRevisionState {
  /** Next synthetic OOXML carrier identity, independent of source RSID or display grouping. */
  nextId: number
  /** Once-read source directory, loaded only when an actual content revision needs an author. */
  authors?: DocRevisionAuthorsSource
}

/** One preflighted inline revision, leaving resource and field ownership with their original handlers. */
export interface InlineRevisionProjection {
  /** Whether the owner has accounted for both effective source content flags. */
  handled: boolean
  /** Exact source save-session attributes on the initial OOXML run. */
  attributes: Readonly<Record<string, string>>
  /** @param run - Completely projected and admitted run. @returns Native wrapper, or unchanged run after an explicit refusal. */
  wrap(run: DocxXmlElementPlan): DocxXmlElementPlan
}
