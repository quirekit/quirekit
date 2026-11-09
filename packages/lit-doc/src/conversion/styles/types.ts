import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { DocCharacterBaseFormat } from '../../word/characters/types'

/** Named-style projection and source snapshots used for precise run compensation. */
export interface StyleProjection {
  /** Complete typed styles part. */
  root: DocxXmlElementPlan
  /** Source Normal paragraph text settings. */
  normal: DocCharacterBaseFormat
  /** Source compiled paragraph text settings keyed by source slot. */
  paragraphs: ReadonlyMap<number, DocCharacterBaseFormat>
  /** Source character styles compiled over Normal, keyed by source slot. */
  characters: ReadonlyMap<number, DocCharacterBaseFormat>
}
