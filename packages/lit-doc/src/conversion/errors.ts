import type { DocConversionReport } from './types'

/** Strict semantic-loss rejection with a complete bounded conversion report. */
export class DocConversionError extends Error {
  /** Stable conversion failure category. */
  readonly code = 'conversion-loss' as const
  /** Complete decisions collected before strict admission. */
  readonly report: DocConversionReport

  /**
   * Creates an explicit loss rejection without retaining input or generated package bytes.
   * @param report - Source projection decisions and original denominators.
   */
  constructor(report: DocConversionReport) {
    super('DOC conversion would lose or approximate unsupported source semantics')
    this.name = 'DocConversionError'
    this.report = report
  }
}
