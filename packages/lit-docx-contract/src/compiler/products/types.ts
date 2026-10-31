import type { DocxCompilerPhase } from "../phases/index.js";

/** Severity attached to one compiler diagnostic. */
export type DocxCompilerDiagnosticSeverity = "info" | "warning" | "error";

/** Structured compiler diagnostic emitted by a contribution or validator. */
export interface DocxCompilerDiagnostic {
  /** Stable machine-readable diagnostic code. */
  readonly code: string;
  /** Human-readable diagnostic detail. */
  readonly message: string;
  /** User-facing severity. */
  readonly severity: DocxCompilerDiagnosticSeverity;
  /** Contribution that emitted the diagnostic. */
  readonly contributionId?: string | undefined;
  /** Compiler phase where the diagnostic was emitted. */
  readonly phase?: DocxCompilerPhase | undefined;
  /** Optional structural source path. */
  readonly path?: string | undefined;
}

/** Symbolic relationship reference resolved by the final package allocator. */
export interface DocxRelationshipReference {
  /** Discriminant preventing a semantic key from being mistaken for XML text. */
  readonly kind: "relationship-reference";
  /** Stable relationship-plan key. */
  readonly key: string;
}

/** XML value accepted by the schema-aware plan. */
export type DocxXmlAttributeValue =
  | string
  | number
  | boolean
  | DocxRelationshipReference;

/** One namespace-aware XML attribute plan. */
export interface DocxXmlAttributePlan {
  /** Namespace URI, or an empty string for an unqualified attribute. */
  readonly namespaceUri: string;
  /** Local attribute name without a prefix. */
  readonly localName: string;
  /** Preferred namespace prefix when serialized. */
  readonly prefix?: string | undefined;
  /** Typed attribute value. */
  readonly value: DocxXmlAttributeValue;
}

/** One child accepted by a namespace-aware XML element plan. */
export type DocxXmlChildPlan = DocxXmlElementPlan | string;

/** Namespace-aware XML element plan used by the advanced builder. */
export interface DocxXmlElementPlan {
  /** Namespace URI of the element. */
  readonly namespaceUri: string;
  /** Local element name without a prefix. */
  readonly localName: string;
  /** Preferred namespace prefix when serialized. */
  readonly prefix?: string | undefined;
  /** Typed attributes in deterministic declaration order. */
  readonly attributes: readonly DocxXmlAttributePlan[];
  /** Child elements and text in document order. */
  readonly children: readonly DocxXmlChildPlan[];
}

/** Explicit raw XML escape-hatch plan. */
export interface DocxUnsafeXmlPlan {
  /** Discriminant that prevents accidental plain-string authoring. */
  readonly kind: "unsafe-xml";
  /** Raw XML payload. */
  readonly xml: string;
  /** Auditable reason why the typed builder cannot represent the payload. */
  readonly reason: string;
  /** Whether the payload preserves imported source or authors new XML. */
  readonly authority: "preservation" | "authoring";
}

/** Semantic document intent emitted before package compilation. */
export interface DocxSemanticIntent {
  /** Stable key unique within one compilation. */
  readonly key: string;
  /** Semantic intent family understood by a later compiler contribution. */
  readonly type: string;
  /** Immutable model-neutral intent payload. */
  readonly payload: Readonly<Record<string, unknown>>;
}

/** Resource request emitted before package identity allocation. */
export interface DocxResourcePlan {
  /** Stable semantic resource key. */
  readonly key: string;
  /** Resource family such as image, font, or embedded object. */
  readonly kind: string;
  /** MIME type when the resource has binary content. */
  readonly mediaType?: string | undefined;
  /** Browser-safe binary payload. */
  readonly data?: Uint8Array | undefined;
  /** External source identifier retained without implicit acquisition. */
  readonly source?: string | undefined;
}

/** Relationship request expressed with semantic keys. */
export interface DocxRelationshipPlan {
  /** Stable relationship request key. */
  readonly key: string;
  /** Source package part name. */
  readonly sourcePart: string;
  /** OOXML relationship type URI. */
  readonly relationshipType: string;
  /** Target part name, resource key, or external URI. */
  readonly target: string;
  /** Whether the relationship target is internal or external. */
  readonly targetMode: "internal" | "external";
  /** Exact id retained only when preserved XML cannot use a symbolic reference. */
  readonly fixedId?: string | undefined;
  /** Complete preserved `.rels` source containing this fixed relationship. */
  readonly preservedSourceXml?: string | undefined;
}

/** One symbolic replacement inside generated XML text. */
export interface DocxGeneratedXmlRelationshipReference {
  /** Placeholder that exists only before package resolution. */
  readonly placeholder: string;
  /** Stable relationship-plan key resolved into the placeholder. */
  readonly relationshipKey: string;
}

/** Generated XML plus symbolic package references awaiting resolution. */
export interface DocxGeneratedXmlPlan {
  /** Discriminant separating generated templates from unsafe raw XML. */
  readonly kind: "generated-xml";
  /** Generated XML containing exact in-memory placeholders. */
  readonly xml: string;
  /** Relationship placeholders owned by this part. */
  readonly relationships: readonly DocxGeneratedXmlRelationshipReference[];
}

/** One package part requested by a contribution. */
export interface DocxPackagePartPlan {
  /** Absolute OPC part name beginning with a slash. */
  readonly name: string;
  /** MIME content type registered for the part. */
  readonly contentType: string;
  /** Explicit typed rule for replacing a known base fallback producer. */
  readonly mergePolicy?:
    | "base-fallback"
    | "replace-base-fallback"
    | undefined;
  /** Typed XML root when the part is generated structurally. */
  readonly root?: DocxXmlElementPlan | undefined;
  /** Generated XML template whose symbolic references are centrally resolved. */
  readonly generatedXml?: DocxGeneratedXmlPlan | undefined;
  /** Explicit raw XML when preservation or advanced authoring requires it. */
  readonly unsafeXml?: DocxUnsafeXmlPlan | undefined;
  /** Browser-safe binary part payload. */
  readonly data?: Uint8Array | undefined;
  /** Original zero-edge `.rels` document owned by this part, if one existed. */
  readonly emptyRelationshipsXml?: string | undefined;
}

/** Complete unresolved package graph submitted to the package resolver. */
export interface DocxPackageSourcePlan {
  /** Deferred source dependencies, resolved against final emitted XML before identity allocation. */
  readonly preservedXmlResources?: unknown;
  /** Semantic resources awaiting concrete package paths. */
  readonly resources: readonly DocxResourcePlan[];
  /** Semantic relationships awaiting part-local ids. */
  readonly relationships: readonly DocxRelationshipPlan[];
  /** Package parts whose payloads may still contain symbolic references. */
  readonly parts: readonly DocxPackagePartPlan[];
}

/** Immutable delta returned by one compiler contribution. */
export interface DocxCompilerPatch {
  /** Semantic intents added by this contribution. */
  readonly intents?: readonly DocxSemanticIntent[] | undefined;
  /** Resources added by this contribution. */
  readonly resources?: readonly DocxResourcePlan[] | undefined;
  /** Relationships added by this contribution. */
  readonly relationships?: readonly DocxRelationshipPlan[] | undefined;
  /** Package parts added by this contribution. */
  readonly parts?: readonly DocxPackagePartPlan[] | undefined;
  /** Non-fatal or fatal diagnostics added by this contribution. */
  readonly diagnostics?: readonly DocxCompilerDiagnostic[] | undefined;
}

/** Immutable products visible at one compiler phase boundary. */
export interface DocxCompilerSnapshot {
  /** Most recently completed compiler phase. */
  readonly phase: DocxCompilerPhase;
  /** Semantic intents accumulated so far. */
  readonly intents: readonly DocxSemanticIntent[];
  /** Resource plans accumulated so far. */
  readonly resources: readonly DocxResourcePlan[];
  /** Relationship plans accumulated so far. */
  readonly relationships: readonly DocxRelationshipPlan[];
  /** Package part plans accumulated so far. */
  readonly parts: readonly DocxPackagePartPlan[];
  /** Diagnostics accumulated so far. */
  readonly diagnostics: readonly DocxCompilerDiagnostic[];
}
