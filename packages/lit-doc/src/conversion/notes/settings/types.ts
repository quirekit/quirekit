import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'

/** Admitted scalar properties in one OOXML note property group. */
export type NotePropertyValues = Partial<Record<'pos' | 'numFmt' | 'numStart' | 'numRestart', string | number>>

/** Successful note overrides belonging to one source section. */
export interface NoteSectionProjection {
  /** Footnote then endnote property groups, before the page tuple. */
  elements: DocxXmlElementPlan[]
  /** Original operations fully interpreted by this projection. */
  handled: Set<number>
  /** Explicit endnote suppression, emitted at its own section schema position. */
  suppressEndnotes?: boolean
}

/** Atomic document settings and independent section overrides for active note families. */
export interface NoteSettingsProjection {
  /** Document-wide note rules and standard separator references. */
  documentProperties: DocxXmlElementPlan[]
  /** Successfully projected source sections. */
  sections: ReadonlyMap<number, NoteSectionProjection>
}
