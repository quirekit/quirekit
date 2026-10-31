/** Vector outline of the evaluation mark text; y grows downward and 0 is the baseline. */
export interface QuireKitEvaluationMarkOutline {
  /** Outline units per em, the scale of `path` and `bounds`. */ readonly unitsPerEm: number;
  /** Ink bounds of the whole text in outline units. */ readonly bounds: {
    /** Leftmost ink x. */ readonly left: number;
    /** Topmost ink y, negative above the baseline. */ readonly top: number;
    /** Rightmost ink x. */ readonly right: number;
    /** Lowest ink y. */ readonly bottom: number;
  };
  /** SVG path data of every glyph along the baseline, using only absolute M, L, C, Q and Z commands. */ readonly path: string;
}
