/** One header/footer source range, retaining the distinction between inheritance and blank content. */
export interface DocHeaderFooterRange {
  /** Zero-based main-document section. */
  section: number
  /** Source content owner. */
  kind: 'header' | 'footer'
  /** Section slot whose absence inherits the same variant from its predecessor. */
  variant: 'default' | 'even' | 'first'
  /** Inclusive absolute UTF-16 CP in the concatenated source text. */
  start: number
  /** Exclusive absolute CP, including the source guard paragraph mark. */
  end: number
  /** Exclusive content CP after removing the guard, equal to start for an absent slot. */
  contentEnd: number
}

/** One note separator stored alongside header/footer content. */
export interface DocHeaderFooterSeparator {
  /** Note family owning this source range. */
  kind: 'footnote' | 'endnote'
  /** Separator purpose independent from ordinary header/footer variants. */
  role: 'separator' | 'continuationSeparator' | 'continuationNotice'
  /** Inclusive absolute source CP. */
  start: number
  /** Exclusive absolute CP including any guard. */
  end: number
  /** Exclusive content CP without the guard. */
  contentEnd: number
}

/** Bounded source header/footer locators, before formatting or page selection. */
export interface DocHeaderFooterSource {
  /** Explicit inspection capability boundary. */
  scope: 'header-footer-source'
  /** Original document parity flag, or null when the DOP record is absent. */
  evenAndOddHeaders: boolean | null
  /** Original relative CPs through the final story endpoint, excluding the undefined last PLC entry. */
  positions: readonly number[]
  /** Six note-separator slots when a header directory exists. */
  separators: readonly DocHeaderFooterSeparator[]
  /** Six variants per section in original PLC order, including absent slots. */
  stories: readonly DocHeaderFooterRange[]
}
