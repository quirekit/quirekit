/** Complete independently authored drawing stream and optional source anchor PLCs. */
export interface DrawingDocumentFixture {
  /** Drawing-group record and labelled document containers. */
  content: Uint8Array
  /** Optional main-part FSPA PLC. */
  main?: Uint8Array
  /** Optional aggregate header FSPA PLC. */
  header?: Uint8Array
}

/** Independent source occurrences sharing one original global media slot. */
export interface FloatingPictureFixtureOptions {
  /** Original CPs of distinct top-level picture frames; defaults to CP1. */
  positions?: readonly number[]
  /** Deliberate ClientAnchor association corruption for refusal tests. */
  clientIndexOffset?: number
  /** Optional exact original ClientAnchor values, including deliberately stale zeroes. */
  clientIndices?: readonly number[]
  /** Optional PLC references independent from the uniquely stored shape identities. */
  anchorShapeIds?: readonly number[]
}
