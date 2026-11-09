import type { ReferenceComparisonWork, ReferenceSummary } from "../references/types";
import type { Tree, TreeBuffer } from "@lezer/common";
import type { SyntaxReuseWork } from "../../source/parsing/types";

/** Confirmed definitions shared by grammar and lazy destination queries. */
export interface ReferenceDefinitions {
  /** Immutable source order, including shadowed definitions. */
  readonly entries: ReferenceSummary;
  /** Stable identity while the normalized label set is unchanged. */
  readonly labels: ReadonlySet<string>;
}

/** Source interval of a native inline block that may contain reference brackets. */
export interface ReferenceBlock {
  /** Inclusive start in its chunk or document. */
  readonly from: number;
  /** Exclusive end in the same coordinate space. */
  readonly to: number;
}

/** Actual label reads from one complete native inline context. */
export interface ReferenceInlineTrace extends ReferenceBlock {
  /** Normalized labels queried by this context, including missing definitions. */
  readonly labels: Set<string>;
}

/** Parse-local contexts keyed by exact source interval, with no retained source text. */
export type ReferenceTrace = Map<string, ReferenceInlineTrace>;

/** Grammar proof belonging to one native chunk and one parser instance. */
export interface ReferenceCertificate {
  /** Definition membership under which the chunk was accepted. */
  readonly labels: ReadonlySet<string>;
  /** Complete paragraph dependency set; absent means conservative invalidation. */
  readonly dependencies: ReadonlySet<string> | undefined;
}

/** Weak native ownership, isolated from other parser configurations and documents. */
export type ReferenceCertificates = WeakMap<Tree | TreeBuffer, ReferenceCertificate>;

/** A native chunk with its absolute position, as found by a traversal. */
export interface ReferenceChunk {
  /** Immutable parser chunk. */
  readonly chunk: Tree | TreeBuffer;
  /** Its absolute source position. */
  readonly offset: number;
}

/** Actual reference-refinement work for one accepted parser snapshot. */
export interface ReferenceParseWork extends ReferenceComparisonWork, SyntaxReuseWork {
  /** Immutable chunks visited while locating affected blocks. */
  visitedChunks: number;
  /** Already certified chunks skipped. */
  reusedChunks: number;
  /** Inline blocks invalidated for reference decisions. */
  checkedBlocks: number;
  /** Native inline-destination checks after a closing bracket. */
  inlineChecks: number;
  /** Additional incremental grammar passes. */
  refinements: number;
  /** Definition-summary nodes visited in this parse, including its structural pass. */
  definitionNodes: number;
  /** Cached definition-summary chunks reused in this parse. */
  definitionChunks: number;
  /** Definitions read from canonical source in this parse. */
  definitionsRead: number;
  /** Definition entries copied while combining chunk summaries. */
  copiedDefinitions: number;
  /** Shared child links retained by newly built summary branches. */
  summaryLinks: number;
  /** New label sets materialized for grammar decisions. */
  labelBuilds: number;
  /** Definition entries consumed while materializing label sets. */
  labelReads: number;
  /** Actual normalized-label reads recorded during inline refinement. */
  dependencyReads: number;
  /** Cached dependency membership comparisons after a label-set change. */
  dependencyChecks: number;
  /** Paragraphs reused after their recorded membership reads remained unchanged. */
  dependencyReuses: number;
  /** Chunk visits while attaching or retaining accepted grammar certificates. */
  certifiedChunks: number;
  /** Parse-local trace sorting, interval lookup and merge comparisons. */
  traceComparisons: number;
}
