/** One effective custom tab stop in the original paragraph coordinate system. */
export interface DocTabStop {
  /** Signed position in twips relative to the paragraph origin. */
  position: number
  /** Source TabJC, with list tabs using the normative value six. */
  alignment: 0 | 1 | 2 | 3 | 4 | 6
  /** Source TabLC, normalized to zero when a bar tab ignores its leader. */
  leader: 0 | 1 | 2 | 3 | 4 | 5 | 7
}

/** Final write at one position in the current style or direct formatting layer. */
export interface DocTabChange {
  /** Exact source or inherited position affected by the write. */
  position: number
  /** Replacement stop, or null to clear an inherited stop. */
  value: DocTabStop | null
}

/** Effective stops and independently retained current-layer provenance. */
export interface DocParagraphTabs {
  /** Sorted custom stops after source inheritance and ordered edits. */
  stops: readonly DocTabStop[]
  /** Sorted final local writes, excluding unaffected inherited stops. */
  changes: readonly DocTabChange[]
  /** Whether local deletion ranges need approximation to exact OOXML clear positions. */
  rangeDeletion: boolean
}

/** Validated tab operation before any inherited state is modified. */
export interface TabOperation {
  /** Closed source-position intervals to remove before adding stops. */
  removals: readonly { start: number, end: number, position: number }[]
  /** Ordered explicit replacements. */
  additions: readonly DocTabStop[]
}
