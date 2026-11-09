import type { Node } from "@quirekit/pm";

/** One component of a change, reduced to what a rule needs to locate it. */
export type CollabChangeOp =
  | { readonly retain: number; readonly patch?: Readonly<Record<string, unknown>> | undefined }
  | { readonly insert: readonly unknown[] }
  | { readonly delete: number };

/** A change to a whole document, as positions kept, inserted and deleted in order. */
export interface CollabChange {
  /** Components in document order; everything after the last one is kept. */
  readonly ops: readonly CollabChangeOp[];
  /** Patch of the document attributes. */
  readonly root?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Domain check of a candidate document; returns a reason to reject or null.
 * The previous authoritative document lets a check tolerate problems that
 * already existed, such as those imported with the file.
 */
export type Validator = ((doc: Node, before: Node, context?: ValidatorContext) => string | null) & {
  /** What a change must touch for this check to run; without it the check runs on every change. */
  readonly scope?: ValidatorScope | undefined;
  /** Reason codes this check rejects with (`code` or `code:detail`). */
  readonly reasons?: readonly string[] | undefined;
};

/** Who made a candidate change and what it was, for checks that depend on the author. */
export interface ValidatorContext {
  /** Actor the host authenticated for the submission; null when the authority runs without one. */
  readonly actor: string | null;
  /** The change from the previous authoritative document to the candidate, corrections included. */
  readonly change: CollabChange;
}

/**
 * What a change must touch for a validator to run. A change touches a node
 * type, attribute or mark when it inserts or deletes content carrying it or
 * patches it; root attributes count when the root patch changes them.
 */
export interface ValidatorScope {
  /** Node types whose nodes the check reads. */
  readonly nodes?: readonly string[] | undefined;
  /** Node attributes the check reads, on any node type. */
  readonly attrs?: readonly string[] | undefined;
  /** Marks the check reads. */
  readonly marks?: readonly string[] | undefined;
  /** Document attributes the check reads. */
  readonly root?: readonly string[] | undefined;
  /** Node types whose content the check reads: any insert or delete inside such a node counts. */
  readonly within?: readonly string[] | undefined;
}

/** Domain repair of a candidate document; returns the repaired document or null when it cannot help. */
export type Repairer = (doc: Node) => Node | null;

/** One change that was rebased over concurrent work, as a reconciler sees it. */
export interface ReconcileContext {
  /** Authoritative document before the change. */
  readonly before: Node;
  /** Document after the rebased change, possibly corrected by earlier reconcilers. */
  readonly candidate: Node;
  /** Ranges `[from, to)` of `candidate` the change inserted. */
  readonly inserted: readonly (readonly [number, number])[];
  /**
   * Identities the authority renamed in this client's earlier changes that
   * the client has not seen yet; the change may still refer to the old ones.
   */
  readonly renamed: ReadonlySet<string>;
}

/** A corrected candidate. */
export interface Reconciled {
  /** Corrected document. Only attributes change, so the inserted ranges stay valid. */
  readonly doc: Node;
  /** Identities renamed in the change's content, remembered until the client has seen the correction. */
  readonly renamed?: readonly string[] | undefined;
}

/**
 * Resolves what a merge cannot see, such as two users taking the same next
 * free identity for new content. Runs only on changes rebased over concurrent
 * work, before the feature plugins. Returns a corrected candidate, null when
 * nothing needs correcting, or a reason to reject the change.
 */
export type Reconciler = ((context: ReconcileContext) => Reconciled | string | null) & {
  /** Reason codes this reconciler rejects with. */
  readonly reasons?: readonly string[] | undefined;
};

/** What one accepted entry changed, taken at acceptance and stored with it, never broadcast (R20). */
export interface EntryFacts {
  /** Text the entry inserted. */
  readonly inserted: string;
  /** Text it deleted, from the version before it. */
  readonly deleted: string;
  /** Start of the text block holding the change in the version before it, or -1 outside one. */
  readonly block: number;
  /** First position touched, in the version before it. */
  readonly from: number;
  /** End of the touched range, in the version before it. */
  readonly to: number;
  /** Whether it only inserted or deleted characters, without structure, formatting or document attributes. */
  readonly text: boolean;
  /** Node types inserted, deleted or patched. */
  readonly nodes: readonly string[];
  /** Node types the entry inserted. */
  readonly added: readonly string[];
  /** Node types the entry deleted. */
  readonly removed: readonly string[];
  /** Marks on inserted or deleted content, or patched. */
  readonly marks: readonly string[];
  /** Node attributes set or patched. */
  readonly attrs: readonly string[];
  /** Document attributes patched. */
  readonly root: readonly string[];
}

/** A feature's record kind for a change it recognizes. */
export interface RecordKind {
  /** Feature-named kind. */
  readonly kind: string;
  /** Version of its facts. */
  readonly kindVersion: number;
  /** Kind-owned facts. */
  readonly facts?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Recognizes a feature's change from what it touched; features declare
 * these (proposal 11.2) and the kernel never branches on their node names.
 */
export type RecordClassifier = (facts: EntryFacts) => RecordKind | null;

/**
 * How concurrent writes of one document attribute combine (proposal 5.6):
 * `merge` splits the value to its fields, and to entries of declared keyed
 * arrays, and merges them; `checked` treats the value as one object, so a
 * write made without seeing a concurrent write of the same attribute is refused.
 */
export type RootStrategy = "merge" | "checked";

/** A whole-block object on a node, written as one unit (proposal 5.6). */
export interface CheckedNodeObject {
  /** Node type holding the object. */
  readonly node: string;
  /** Attribute identifying the node across versions, or a `/` path to a field inside one. */
  readonly id: string;
  /** Attributes holding the object's data, or `/` paths to fields inside them. */
  readonly data: readonly string[];
  /**
   * Attribute holding the object's version, or a `/` path to a field inside
   * one; several paths for objects whose owners keep it in different places,
   * the first holding a number counting. A node without one is not checked.
   */
  readonly version: string | readonly string[];
}
