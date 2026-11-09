import type { DocReadError } from '../../../../errors'
import type { DocDrawingShape } from '../../types'
import type { FloatingPictureIndex } from '../../pictures/types'
import type { SourceFloatingTextbox, SourceTextboxChain, TextShapeIdentitySource } from '../types'

/** Once-indexed same-part source identities and incoming links, including explicit read failures. */
export interface TextboxChainIndex {
  /** Original identity, without forcing unrelated appearance through ordinary-shape admission. */
  identities: ReadonlyMap<DocDrawingShape, TextShapeIdentitySource>
  /** All original source shapes naming a descriptor slot. */
  slots: ReadonlyMap<number, readonly DocDrawingShape[]>
  /** Number of original incoming next-shape references. */
  incoming: ReadonlyMap<number, number>
  /** Unique physical FSPA association, with null for aliases. */
  anchors: ReadonlyMap<number, FloatingPictureIndex | null>
  /** Whether another text-capable source has an unreadable identity. */
  uncertain: boolean
  /** Successful or refused whole-chain reads, never partial shape arrays. */
  chains: Map<number, SourceTextboxChain | DocReadError>
}

/** Source-layer chain lookup, separate from author ranges and target package state. */
export interface TextboxChainReader {
  /** @param frame - Actual ordinary frame already selected by its source CP. @returns Complete validated multi-frame chain, or undefined for an unambiguous single frame. */
  read(frame: SourceFloatingTextbox): SourceTextboxChain | undefined
}
