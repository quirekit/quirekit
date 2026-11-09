/** Source horizontal position in physical coordinates or an exact relative alignment. */
export type DocTableHorizontalPosition = { offset: number } | { alignment: 'left' | 'center' | 'right' | 'inside' | 'outside' }

/** Source vertical position, including the distinct inline sentinel. */
export type DocTableVerticalPosition = { offset: number } | { alignment: 'inline' | 'top' | 'center' | 'bottom' | 'inside' | 'outside' }

/** Source evidence for proving one row's frame authority without interpreting a new frame model. */
export interface TableRowFrameEvidence {
  /** Complete distinct frame signatures on this row's own paragraphs and marker. */
  readonly signatures: ReadonlySet<string>
  /** First direct paragraph's signature, undefined when its properties or ownership are not proved. */
  readonly first: string | undefined
}

/** Complete source table positioning tuple used for adjacent-row identity and OOXML projection. */
export interface DocTablePosition {
  /** Physical horizontal reference, with column distinct from page margins. */
  horizontalAnchor: 'column' | 'margin' | 'page'
  /** Vertical reference, with paragraph meaning the preceding paragraph's bottom. */
  verticalAnchor: 'margin' | 'page' | 'paragraph'
  /** Decoded twip offset or exact horizontal alignment. */
  horizontal: DocTableHorizontalPosition
  /** Decoded twip offset or exact vertical alignment. */
  vertical: DocTableVerticalPosition
  /** Physical left text clearance in twips. */
  leftFromText: number
  /** Physical right text clearance in twips. */
  rightFromText: number
  /** Upper text clearance in twips. */
  topFromText: number
  /** Lower text clearance in twips. */
  bottomFromText: number
  /** Whether this table can overlap another floating table. */
  allowOverlap: boolean
}
