import type { PropertyReader } from '../properties/types'
import type { WordFontDefaults, WordStylesSource } from '../styles/types'
import type { DocReadDiagnostic } from '../../types'

/** Per-inspection formatting sources and work budget shared by paragraph and character passes. */
export interface WordFormattingContext extends WordStylesSource {
  /** Whether best-effort conversion permits bounded structural-property recovery. */
  recoverProperties: boolean
  /** Shared compatibility decisions collected by lazy formatting and topology passes. */
  diagnostics: DocReadDiagnostic[]
  /** Optional default font slots, read only for the character pass. */
  fonts: WordFontDefaults | undefined
  /** Common parse, expansion and repeated-application budget. */
  reader: PropertyReader
  /** @param index - Original font-table slot. @returns Lazily decoded primary source font name, without substitution. */
  fontName?: (index: number) => string
}
