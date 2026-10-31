/** One source relationship whose internal target is an absolute OPC name. */
export interface SourcePackageRelationship {
  /** Exact source-local relationship identity. */
  readonly id: string
  /** Opaque relationship type URI. */
  readonly type: string
  /** Absolute part name or unchanged external URI. */
  readonly target: string
  /** External links are recorded without acquisition. */
  readonly external: boolean
}

/** Exact bytes and relationship authority of a reachable opaque dependency. */
export interface SourcePackagePart {
  /** Canonical absolute OPC part name. */
  readonly name: string
  /** Original effective content type. */
  readonly contentType: string
  /** Portable original bytes; never a parsed/reconstructed workbook. */
  readonly base64: string
  /** Complete relationship list in original order. */
  readonly relationships: readonly SourcePackageRelationship[]
  /** Original relationship document when present. */
  readonly relationshipsXml?: string
}

/** A source relationship transported independently of its original story. */
export interface PreservedXmlRelationship extends SourcePackageRelationship {
  /** Package-isolated placeholder in detached XML. */
  readonly token: string
  /** Original owning part, used for validation and diagnostics. */
  readonly sourcePart: string
}

/** JSON-safe dependency graph for detached source XML. */
export interface PreservedXmlResources {
  /** Transport protocol version. */
  readonly version: 1
  /** Captured explicit source references retained for history. */
  readonly references: readonly PreservedXmlRelationship[]
  /** Shared recursive dependency bytes. */
  readonly parts: readonly SourcePackagePart[]
}

/**
 * Captures source references without changing the original tree.
 * @param element - Detached, namespace-closed source fragment.
 * @returns Detached fragment with portable relationship identities.
 */
export type PreserveXmlRelationships = (element: import('../core/types.js').XmlElement) => import('../core/types.js').XmlElement

/** Bounds for a captured opaque OPC dependency graph. */
export interface SourcePackageLimits {
  /** Maximum aggregate decoded dependency bytes. */
  readonly maxBytes: number
  /** Maximum distinct dependency parts. */
  readonly maxParts: number
}
