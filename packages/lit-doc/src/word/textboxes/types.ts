import type { ByteView } from '../../binary/bytes'

/** One original textbox-chain descriptor, including unused application slots. */
export interface DocTextboxEntry {
  /** Original zero-based physical descriptor slot. */
  index: number
  /** Original relative CP in this textbox subdocument. */
  start: number
  /** Original following CP; the final spare endpoint is not a content boundary. */
  end: number
  /** Original sixteen-bit reusable flag, without normalizing a final zero. */
  reuseFlags: number
  /** Effective spare role, forced true for the final descriptor. */
  reusable: boolean
  /** Original union words: active chain count/edit state or spare next/count bit patterns. */
  data: readonly [number, number]
  /** Original ignored destination bit pattern. */
  destination: number
  /** Original owner identity, uninterpreted for spare records. */
  shapeId: number
  /** Original ignored undo identifier. */
  undoTextId: number
}

/** One original display fragment, without executing cached break decisions. */
export interface DocTextboxBreak {
  /** Original zero-based fragment slot. */
  index: number
  /** Original relative first CP. */
  start: number
  /** Original following CP, possibly unavailable as indicated by the flags. */
  end: number
  /** Original unsigned descriptor index, including the 65535 sentinel. */
  textboxIndex: number
  /** Original signed dependency operand. */
  dependency: number
  /** Complete original break flags. */
  flags: number
}

/** Raw textbox tables belonging to one independent source subdocument. */
export interface DocTextboxPart {
  /** Corresponding source story category; all CPs here remain relative to it. */
  kind: 'textbox' | 'headerTextbox'
  /** Complete physical descriptors, including all spare slots. */
  entries: readonly DocTextboxEntry[]
  /** Complete original cached display fragments. */
  breaks: readonly DocTextboxBreak[]
  /** Original final text-table operand, or null when the table is absent. */
  textTerminalCp: number | null
  /** Original final display-table operand, or null when the table is absent. */
  breakTerminalCp: number | null
}

/** Bounded source metadata, distinct from editable drawing text or actual layout. */
export interface DocTextboxesSource {
  /** Source-only contract discriminator. */
  scope: 'textbox-source'
  /** Body textboxes followed by header textboxes, including absent tables. */
  parts: readonly DocTextboxPart[]
}

/** Private bounded PLC storage established before decoding or output allocation. */
export interface TextboxPlc {
  /** Original fixed/variable payload, absent only for a missing table. */
  view: ByteView | null
  /** Physical record count already charged to shared budgets. */
  count: number
  /** Original last CP, independent from any visible content endpoint. */
  terminalCp: number | null
}
