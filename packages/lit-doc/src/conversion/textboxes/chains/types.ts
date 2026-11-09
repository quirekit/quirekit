import type { DocxXmlElementPlan } from '@quirekit/lit-docx-contract'
import type { TextboxProjectionResult } from '../types'

/** Validated standard Word shape role, distinct from the nonvisual drawing identity. */
export interface TextboxChainLink {
  /** Original one-based author descriptor, within the unsignedShort target range. */
  readonly id: number
  /** Original zero-based frame sequence. */
  readonly sequence: number
}

/** Whole-chain output staged before any original frame or author resource becomes reachable. */
export interface TextboxChainProjectionResult extends Pick<TextboxProjectionResult, 'resources' | 'relationships'> {
  /** Complete outputs keyed by their actual original CP, without moving source anchors. */
  readonly drawings: ReadonlyMap<number, DocxXmlElementPlan>
  /** Exact source runs whose ordinary drawing ownership was validated. */
  readonly runs: readonly number[]
}
