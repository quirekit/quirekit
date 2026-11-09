/** Field whose actual presence distinguishes a section override from a format default. */
export type DocNoteSectionField = 'format' | 'restart' | 'offset' | 'position'

/** Original section note properties before OOXML mapping or marker evaluation. */
export interface DocNoteSectionRule {
  /** Original unsigned MSONFC code, with unknown codes retained for explicit projection refusal. */
  format: number
  /** Source restart selector, continuous 0, section 1, or page 2 for footnotes. */
  restart: number
  /** Source continuous-numbering offset operand, default zero when absent. */
  offset: number
  /** Source footnote position, page bottom 1 or below text 2; absent for endnotes. */
  position?: number
  /** Distinct fields explicitly assigned in first-assignment order. */
  explicit: readonly DocNoteSectionField[]
}

/** Legacy document-wide numbering retained only when the effective FIB version uses it. */
export interface DocLegacyNoteRule {
  /** Original unsigned MSONFC code. */
  format: number
  /** Original restart selector, continuous 0, section 1, or page 2. */
  restart: number
  /** Original document-wide starting value. */
  start: number
  /** Original footnote position, section end 0, page bottom 1 or below text 2. */
  position?: number
}

/** Version-selected source document note properties. */
export interface DocNoteDocumentSettings {
  /** Original endnote position, section end 0 or document end 3. */
  endnotePosition: number
  /** Active document numbering in Word 97/2000, absent in later versions. */
  legacyNumbering?: {
    /** Source footnote document rule. */
    footnote: DocLegacyNoteRule
    /** Source endnote document rule. */
    endnote: DocLegacyNoteRule
  }
}

/** Independent section note properties with exact source positions. */
export interface DocNoteSectionSettings {
  /** Inclusive main-story CP. */
  start: number
  /** Exclusive main-story CP. */
  end: number
  /** Source footnote values, including normative section defaults. */
  footnote: DocNoteSectionRule
  /** Source endnote values, including normative section defaults. */
  endnote: DocNoteSectionRule
  /** Explicit suppression of section-end endnotes; absent when the source uses its default. */
  suppressEndnotes?: boolean
}

/** Optional source settings inspection, separate from content indexes and rendering. */
export interface DocNoteSettingsSource {
  /** Explicit source settings contract. */
  scope: 'note-settings-source'
  /** Active DOP fields, null when no document settings are present. */
  document: DocNoteDocumentSettings | null
  /** Independent SEPX rules in original section order. */
  sections: readonly DocNoteSectionSettings[]
}
