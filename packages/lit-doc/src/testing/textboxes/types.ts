/** Independently authored original 22-byte textbox descriptor. */
export interface TextboxEntryVector {
  /** Original relative source CP. */
  start: number
  /** Original following CP, including undefined terminal operands. */
  end: number
  /** Original union words, without deriving active or spare semantics. */
  data: readonly [number, number]
  /** Original reusable flag word. */
  reuseFlags: number
  /** Original ignored destination operand. */
  destination: number
  /** Original owner shape identity. */
  shapeId: number
  /** Original ignored undo identity. */
  undoTextId: number
}

/** Independently authored six-byte textbox display fragment. */
export interface TextboxBreakVector {
  /** Original source-relative first CP. */
  start: number
  /** Original following CP. */
  end: number
  /** Original unsigned textbox slot or sentinel. */
  textboxIndex: number
  /** Original signed dependency count. */
  dependency: number
  /** Complete original fragment flags. */
  flags: number
}

/** Optional physical tables belonging to one textbox subdocument. */
export interface TextboxPartVector {
  /** Original body or header textbox family. */
  kind: 'textbox' | 'headerTextbox'
  /** Absent and physically empty PLCs remain distinct. */
  entries?: readonly TextboxEntryVector[]
  /** Optional independent original display fragments. */
  breaks?: readonly TextboxBreakVector[]
}
/** Independent rich textbox author content used by actual conversion vectors. */
export interface TextboxAuthorVector {
  /** Whether a second active descriptor deliberately repeats the same original shape owner. */
  duplicateOwner?: boolean
  /** Complete author paragraph text, excluding the textbox protection and spare CRs. */
  text: string
  /** Original image storage, when referenced by independent character operations. */
  data?: Uint8Array
  /** Author-relative direct formatting and resource locators. */
  characters?: readonly { start: number, end: number, operations: readonly number[] }[]
}

/** Independently encoded physical frame in a binary linked-textbox test document. */
export interface TextboxLinkFrameVector {
  /** Original shape id, independent of its CP and chain sequence. */
  shapeId: number
  /** Complete original high descriptor index and low frame sequence. */
  textId: number
  /** Original next-shape operand; zero is terminal. */
  nextShapeId: number
  /** Additional effective shape-property writes. */
  properties?: readonly (readonly [number, number])[]
}

/** Actual binary DOC variations for whole-chain projection and refusal tests. */
export interface TextboxLinkVector {
  /** Original physical shapes; absent selects a two-frame chain. */
  frames?: readonly TextboxLinkFrameVector[]
  /** Frame indices in source CP order, which need not be chain order. */
  order?: readonly number[]
  /** Source text between original drawing controls, such as a paragraph break or field. */
  separator?: string
  /** Source FTXBX cTxbx; absent selects actual frame count. */
  count?: number
  /** Original FTXBX first-frame owner; absent selects the first physical frame. */
  owner?: number
  /** Complete independent author storage and optional inline media. */
  author?: TextboxAuthorVector
}
