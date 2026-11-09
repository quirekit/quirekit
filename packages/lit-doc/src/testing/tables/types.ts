/** One independently authored table row used to encode a complete DOC fixture. */
export interface TableFixtureRow {
  /** One paragraph of text for every physical source cell. */
  texts: readonly string[]
  /** Logical page edges, including the final outer edge. */
  edges: readonly number[]
  /** Optional explicitly stored TC80 tuples; missing trailing tuples use source defaults. */
  cells?: readonly { flags: number, width: number }[]
  /** Direct row operations applied after the initial definition. */
  properties?: readonly number[]
}

/** Source-generation options for independently encoded table fixtures. */
export interface TableDocumentOptions {
  /** Effective FIB generation, defaulting to Word 97. */
  version?: number
  /** Omits all explicit depth operations while retaining direct table membership. */
  implicitDepth?: boolean
}
