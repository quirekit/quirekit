/** One actual field frame while recovering source-order visible text. */
export interface TextRecoveryFieldFrame {
  /** Original absolute begin CP. */
  start: number
  /** Current characters belong to the instruction until the separator. */
  instruction: boolean
  /** Private or unreadable source state suppresses the complete cached result. */
  suppressResult: boolean
}

/** Bounded field ownership shared with the ordinary-text recovery scanner. */
export interface TextRecoveryFields {
  /** Whether ordinary source text at the current position is displayable. */
  readonly visible: boolean
  /**
   * Consumes one observed field control in source order.
   * @param position - Absolute source CP.
   * @param code - Original begin, separator or end control.
   */
  control(position: number, code: 19 | 20 | 21): void
  /** Records any unterminated field at the actual Story end. */
  finish(): void
}
