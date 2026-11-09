/** Logical text flow shared by independently placed text-box frames. */
export interface LitAstTextBoxLink {
  /** Stable Story-local chain identity, independent of generated OOXML numeric ids. */
  readonly chainId: string
  /** Zero-based frame order; only sequence zero owns author children. */
  readonly sequence: number
}
