/** Explicit tab stop on the paragraph's logical inline axis. */
export interface QuireTextTabStop {
  /** Distance in CSS pixels from the unindented logical text-area edge. */
  readonly position: number;
  /** Alignment of the field following the tab. */
  readonly alignment: "start" | "center" | "end";
  /** Optional repeated paint character; omitted for an empty tab. */
  readonly leader?: string | undefined;
}

/** Optional paragraph tab geometry; absence preserves ordinary text layout. */
export interface QuireTextTabs {
  /** Explicit stops, in increasing logical position. */
  readonly stops: readonly QuireTextTabStop[];
  /** Positive CSS pixel interval after the final explicit stop, anchored at the same origin. */
  readonly defaultInterval?: number | undefined;
  /** Logical distance from the tab origin to this layout region's leading edge. */
  readonly offset?: number | undefined;
}

/** Paint-only content for one tab, separate from its single source character. */
export interface QuireTextTabPaint {
  /** Repeated leader text, or empty when no leader fits. */
  readonly text: string;
  /** Physical inset from the tab cluster's left edge in CSS pixels. */
  readonly offset: number;
}
