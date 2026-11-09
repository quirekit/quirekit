import type { CheckedNodeObject, RecordClassifier, Reconciler, Repairer, RootStrategy, Validator, ValidatorScope } from "./authority/types";
import type { QuireExtensionThisContext } from "@quirekit/core";
import type { Node } from "@quirekit/pm";

/** Version of a feature's synchronization rules, part of the room's compatibility list (R13). */
export interface CollabRulesVersion {
  /** Rule kind. */
  readonly kind: "version";
  /** Version; bump it whenever the feature's rules or server plugins change behavior. */
  readonly version: string;
}

/** A document scan whose findings a change must not add to; problems the document already had are tolerated. */
export interface CollabDiagnostics {
  /** Rule kind. */
  readonly kind: "diagnostics";
  /** @param doc - Document. @returns One key per problem, each starting with a declared reason code. */
  readonly collect: (doc: Node) => readonly string[];
  /** What a change must touch for the scan to run. */
  readonly scope?: ValidatorScope | undefined;
  /** Reason codes the keys start with. */
  readonly reasons: readonly string[];
}

/** A check, and optionally a repair, of every node of one type. */
export interface CollabNodeRule {
  /** Rule kind. */
  readonly kind: "node";
  /** Node type name. */
  readonly node: string;
  /** @param node - A node of the type. @returns Reason code to reject, or null. */
  readonly validate?: ((node: Node) => string | null) | undefined;
  /** @param node - A node that failed. @returns The repaired node, or null when it cannot help. */
  readonly repair?: ((node: Node) => Node | null) | undefined;
  /** What a change must touch for the check to run. */
  readonly scope?: ValidatorScope | undefined;
  /** Reason codes `validate` returns. */
  readonly reasons?: readonly string[] | undefined;
}

/** A whole-document check, which may read the authenticated actor (R14). */
export interface CollabValidator {
  /** Rule kind. */
  readonly kind: "validator";
  /** The check. */
  readonly validate: Validator;
  /** Reason codes it returns. */
  readonly reasons: readonly string[];
}

/** A whole-document repair tried before a failing change is rejected. */
export interface CollabRepairer {
  /** Rule kind. */
  readonly kind: "repairer";
  /** The repair. */
  readonly repair: Repairer;
}

/** A correction of concurrent changes, such as two people taking the same new identity. */
export interface CollabReconciler {
  /** Rule kind. */
  readonly kind: "reconciler";
  /** The reconciler. */
  readonly reconcile: Reconciler;
  /** Reason codes it rejects with. */
  readonly reasons?: readonly string[] | undefined;
}

/** Recognizes the feature's changes for collaboration records (11.2). */
export interface CollabRecordKind {
  /** Rule kind. */
  readonly kind: "record";
  /** The classifier. */
  readonly classify: RecordClassifier;
}

/**
 * How one of the feature's editor plugins takes part on the server (D9).
 * Normalizing plugins must be idempotent; guards judge only document state.
 * Interface, interaction, history and permission plugins are client-only:
 * permissions reach the server through validators with the actor (R14).
 */
export interface CollabServerPlugin {
  /** Rule kind. */
  readonly kind: "server-plugin";
  /** Name of the plugin's key. */
  readonly key: string;
  /** Role on the server. */
  readonly role: "normalize" | "guard" | "client";
  /** What a change must touch for the plugin to matter; omitted, it runs on every change. */
  readonly scope?: ValidatorScope | undefined;
}

/** Entries of a document attribute's arrays merged by id rather than written whole (proposal 5.6). */
export interface CollabKeyed {
  /** Rule kind. */
  readonly kind: "keyed";
  /** Document attribute. */
  readonly attribute: string;
  /** Array paths inside the attribute (`*` for an entry) and the id field of their entries. */
  readonly paths: Readonly<Record<string, string>>;
}

/**
 * How concurrent writes of a document attribute combine (proposal 5.6): `merge`
 * merges its fields, `checked` refuses a write that did not see a concurrent
 * one. Every document attribute is declared; one declared with keyed arrays is
 * `merge`, and one nothing declares is `checked`.
 */
export interface CollabRootAttribute {
  /** Rule kind. */
  readonly kind: "root";
  /** Document attribute. */
  readonly attribute: string;
  /** Strategy. */
  readonly strategy: RootStrategy;
}

/**
 * A whole-block object on a node, such as a whiteboard, written as one unit:
 * each write sets the version to the one it saw plus one, and a write based
 * on an older version is refused with `stale-object` (proposal 5.6).
 */
export interface CollabCheckedObject extends CheckedNodeObject {
  /** Rule kind. */
  readonly kind: "checked";
}

/** One rule a feature declares for collaboration. */
export type CollabRule = CollabRulesVersion | CollabDiagnostics | CollabNodeRule | CollabValidator | CollabRepairer | CollabReconciler | CollabRecordKind | CollabServerPlugin | CollabKeyed
  | CollabRootAttribute | CollabCheckedObject;

/** Factory installed on any extension kind that declares collaboration rules. */
export type CollabRulesFactory<Options extends object = object, Storage extends object = object> = (
  this: QuireExtensionThisContext<Options, Storage>,
  context: QuireExtensionThisContext<Options, Storage>
) => readonly CollabRule[];

declare module "@quirekit/core" {
  interface QuireExtensionConfig<Options extends object = object, Storage extends object = object> {
    /** Declares this feature's collaboration rules, which `@quirekit/classic-collab` assembles for the server. */
    readonly addCollabRules?: CollabRulesFactory<Options, Storage>;
  }

  interface QuireNodeConfig<Options extends object = object, Storage extends object = object> {
    /** Declares this node's collaboration rules. */
    readonly addCollabRules?: CollabRulesFactory<Options, Storage>;
  }

  interface QuireMarkConfig<Options extends object = object, Storage extends object = object> {
    /** Declares this mark's collaboration rules. */
    readonly addCollabRules?: CollabRulesFactory<Options, Storage>;
  }
}
