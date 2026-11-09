/** An input the state-level matrix can run without real layout. */
export type QualityInput = "Enter" | "Shift-Enter" | "Backspace" | "Delete" | "Tab" | "Shift-Tab" | "type";

/** Invariant identifiers from the input quality plan. */
export type QualityRule = "I1" | "I2" | "I3" | "I4" | "error";

/** One cell of the input matrix. */
export interface QualityCell {
  /** Stable identity for reports and the known-gap list. */ readonly id: string;
  /** Block family under test. */ readonly block: string;
  /** Caret position name within or around the block. */ readonly position: string;
  /** Input performed at the caret. */ readonly input: QualityInput;
  /** Whole document with one `¦` caret. */ readonly source: string;
  /** Usage-frequency weight of this cell in the score. */ readonly weight: number;
}

/** One broken invariant. */
export interface QualityViolation {
  /** Broken rule. */ readonly rule: QualityRule;
  /** Human-readable evidence. */ readonly detail: string;
}

/** Outcome of running one cell. */
export interface QualityResult {
  /** The cell that ran. */ readonly cell: QualityCell;
  /** Source after the input, with the caret. */ readonly after: string;
  /** Every broken invariant; empty when the cell passes. */ readonly violations: readonly QualityViolation[];
}

/** A block family with its caret positions. */
export interface QualityBlock {
  /** Family name. */ readonly name: string;
  /** Usage-frequency weight. */ readonly weight: number;
  /** Position name to block source with one `¦` caret. */ readonly positions: Readonly<Record<string, string>>;
  /** Block source without a caret, for positions in the paragraphs around it. */ readonly source: string;
  /** Whether the block may only start the document. */ readonly leading?: boolean;
}
