import type { HtmlDescriptor, HtmlTextDesc } from "../../descriptors";

/** Ownership indexes retained while descriptor topology and mount contracts remain valid. */
export interface HtmlPositionIndexState {
  /** Direct mounted DOM owners, including custom content holes. */
  readonly domOwners: WeakMap<Node, HtmlDescriptor>;
  /** Complete descriptor preorder for structural queries. */
  readonly descriptors: readonly HtmlDescriptor[];
  /** Descriptors participating in the exact mounted parent tree. */
  readonly represented: ReadonlySet<HtmlDescriptor>;
  /** Non-overlapping text spans in document order. */
  readonly texts: readonly HtmlTextDesc[];
  /** Missing semantic owners checked before resolving a DOM point. */
  readonly unrepresented: readonly HtmlDescriptor[];
  /** Exact identities used by composition and retained node consumers. */
  readonly descriptorsById: ReadonlyMap<string, HtmlDescriptor>;
  /** Custom NodeView or MarkView callbacks require conservative mount validation. */
  readonly customOwnership: boolean;
}
