import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { DocParagraphBaseFormat } from '../../types'
import type { CharacterPropertyKey, CharacterStyleResolver, CharacterToggleModes } from '../../word/characters/formatting/types'
import type { DocCharacterBaseFormat } from '../../word/characters/types'
import type { DocNumberingLevel } from '../../word/numbering/types'
import type { ParagraphPropertyKey } from '../../word/paragraphs/formatting/types'
import type { ConversionSource } from '../source/types'
import type { ProjectionContext } from '../xml/types'

/** A complete optional numbering graph, installed together with all its references. */
export interface NumberingProjection {
  /** Complete numbering part, absent when there are no active instances or projection was refused. */
  root: DocxXmlElementPlan | null
  /** Whether numbering operations were handled rather than omitted by the generic projector. */
  handled: boolean
  /**
   * Reads the paragraph's direct numbering changes without flattening inherited styles.
   * @param index - Source paragraph slot.
   * @param story - Owning source story, defaulting to the main document.
   * @returns Zero or one numPr children for its pPr.
   */
  paragraph(index: number, story?: ConversionSource): DocxXmlElementPlan[]
  /**
   * Reads one named style's own numbering changes.
   * @param index - Source paragraph-style slot.
   * @returns Zero or one numPr children for its pPr.
   */
  style(index: number): DocxXmlElementPlan[]
}

/** Shared source interpreters and bounded XML authority for one graph compilation. */
export interface NumberingLevelContext {
  /** Canonical source snapshot with style, font and operation authorities. */
  source: ConversionSource
  /** Memoized paragraph and marker character-style compiler. */
  characters: CharacterStyleResolver
  /** Bounded output and explicit loss decisions. */
  xml: ProjectionContext
  /** Fully validated level values, prepared before any candidate XML or retention diagnostic. */
  levels: Map<DocNumberingLevel, CompiledNumberingLevel>
}

/** Canonical source deltas, retaining explicit fields and relative toggle operations. */
export interface NumberingPropertyValues {
  /** Derived paragraph values used only for the level's own fields. */
  paragraph: DocParagraphBaseFormat
  /** Actual fields written by the level PAPX. */
  paragraphFields: Set<ParagraphPropertyKey>
  /** Derived marker settings used only for the level's own fields. */
  character: DocCharacterBaseFormat
  /** Actual surviving fields written by the level CHPX. */
  characterFields: Set<CharacterPropertyKey>
  /** Source relative operations that must not become fixed marker values. */
  toggles: CharacterToggleModes
}

/** A complete source tuple after semantic validation and before XML construction. */
export interface CompiledNumberingLevel {
  /** Exact OOXML format spelling; unknown values were already refused. */
  format: string
  /** Template with only the declared source offsets replaced. */
  text: string
  /** Canonical property deltas compiled by the shared interpreters. */
  properties: NumberingPropertyValues
}
