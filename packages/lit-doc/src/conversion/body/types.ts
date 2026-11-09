import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { ProjectedSection } from '../sections/types'

/** Source-CP callback for a note reference or the current note's self marker. */
export type ProjectInlineNote = (position: number) => DocxXmlElementPlan | undefined

/** Source-CP callback for a displayed comment reference or self marker. */
export type ProjectInlineComment = (position: number, inField: boolean) => DocxXmlElementPlan | null | undefined

/** Story-wide field state and source-run lookup for ordered body projection. */
export interface BodyProjection {
  /**
   * Projects one source paragraph exactly once in story order.
   * @param index - Canonical source paragraph index.
   * @param section - Nonfinal section properties attached to this paragraph mark.
   * @param tablePositioned - Whether the containing table overrides paragraph frame placement.
   * @returns A complete typed Word paragraph.
   */
  paragraph(index: number, section?: DocxXmlElementPlan, tablePositioned?: boolean): DocxXmlElementPlan
  /**
   * Checks field closure and atomically removes unadmitted bookmark pairs.
   * @param blocks - Complete typed Story children.
   * @returns Fully admitted Story output.
   */
  finish(blocks: DocxXmlElementPlan[]): DocxXmlElementPlan[]
}

/** Bounded story content and optional main-body section owners. */
export interface StoryProjectionRange {
  /** First content CP, excluding preceding stories. */
  start: number
  /** Exclusive content CP, excluding the story's guard paragraph. */
  end: number
  /** Main-story section properties, absent in header/footer parts. */
  sections?: readonly ProjectedSection[]
}
