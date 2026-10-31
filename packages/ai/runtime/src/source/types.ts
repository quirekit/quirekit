import type {
  QuireAiSourceBlockKind, QuireAiSourceCapability, QuireAiSourceCommandDescriptor, QuireAiSourceRange
} from "@quirekit/ai-contract";

/** One replacement in a change set, in the coordinates of the text before the set. */
export interface QuireAiSourceChange {
  /** Start of the replaced text. */
  readonly from: number;
  /** End of the replaced text. */
  readonly to: number;
  /** Inserted text. */
  readonly insert: string;
}

/** Replacements of one step: sorted, non-overlapping and all in the same coordinates. */
export type QuireAiSourceChangeSet = readonly QuireAiSourceChange[];

/** One block of a source document, as the port segments it. */
export interface QuireAiSourceBlock {
  /** Start of the block's own source; for a list item, its marker. */
  readonly from: number;
  /** End of the block's own source, before any nested block. */
  readonly to: number;
  /** End including nested blocks. */
  readonly end: number;
  /** Neutral kind. */
  readonly kind: QuireAiSourceBlockKind;
  /** Syntax or semantic name, matched by source block facts. */
  readonly name: string;
  /** Nesting depth; 0 for top-level blocks. */
  readonly depth: number;
  /** Text before `from` on its first line (container indentation); continuation lines carry it too. */
  readonly indent: string;
  /** Read-only attributes, such as a heading level or code language. */
  readonly attrs: Readonly<Record<string, string | number | boolean>>;
  /** For a list item: start of the list holding it, shared by its sibling items. */
  readonly list?: number | undefined;
}

/** Step of a source write: text replacements, a described command, or an opaque state inverse. */
export type QuireAiSourceStep =
  | {
    /** Text replacements in the coordinates after the previous steps. */
    readonly kind: "changes";
    /** Replacements. */
    readonly changes: QuireAiSourceChangeSet;
  }
  | {
    /** Described command run on the state after the previous steps. */
    readonly kind: "command";
    /** Command name. */
    readonly name: string;
    /** Adapted command options. */
    readonly params: unknown;
    /** Selection the command acts on, in the coordinates after the previous steps. */
    readonly selection?: QuireAiSourceRange | undefined;
  }
  | {
    /** Inverse of earlier state effects, as the port reported it. */
    readonly kind: "state";
    /** Opaque inverse. */
    readonly inverse: unknown;
  };

/** Outcome of planning or applying steps. */
export type QuireAiSourceStepResult =
  | {
    /** Every step applied. */
    readonly ok: true;
    /** Text replacements each step made, each in the coordinates after the previous ones. */
    readonly changes: readonly QuireAiSourceChangeSet[];
    /** Text after all steps. */
    readonly text: string;
  }
  | {
    /** A step was refused; nothing was applied. */
    readonly ok: false;
    /** Index of the refused step. */
    readonly failedStep: number;
    /** Safe reason, when the editor gives one. */
    readonly reason?: string | undefined;
  };

/** Attribution of a write the AI makes. */
export interface QuireAiSourceWriteMeta {
  /** Request the write belongs to. */
  readonly requestId: string | null;
  /** Logical operation of the write. */
  readonly operationId: string;
  /** Identity the AI writes as. */
  readonly author: { readonly id: string; readonly name: string } | null;
}

/** One accepted transaction of the editor, as the AI core follows it. */
export interface QuireAiSourceTransaction {
  /** Text replacements, in the coordinates before the transaction; empty for state-only transactions. */
  readonly changes: QuireAiSourceChangeSet;
  /** Text each replacement removed, aligned with `changes`. */
  readonly removed: readonly string[];
  /** Attribution when the AI wrote it through `apply`, otherwise null. */
  readonly agent: QuireAiSourceWriteMeta | null;
  /** For AI transactions: inverse of their non-text state effects, to hand back as a `state` step. */
  readonly inverse?: unknown;
  /** For AI transactions: non-text changes described for people reviewing them, such as an added comment. */
  readonly described?: readonly QuireAiSourceDescribedChange[] | undefined;
}

/** A non-text change, such as a comment, named for people reviewing a request. */
export interface QuireAiSourceDescribedChange {
  /** Whether something was added, changed or removed. */
  readonly kind: "inserted" | "edited" | "removed";
  /** Group title, such as "批注". */
  readonly section: string;
  /** What changed, such as the comment text. */
  readonly excerpt: string;
}

/** Engine-neutral source document an editor adapter provides to the AI core. */
export interface QuireAiSourceDocument {
  /** Source language; only Markdown is supported. */
  readonly language: "markdown";
  /** @returns Current LF text. */
  text(): string;
  /** @returns Revision token that changes with every text change. */
  revision(): string;
  /** @returns Whether the editor is alive. */
  isOpen(): boolean;
  /** @returns Whether the editor accepts writes. */
  isEditable(): boolean;
  /** @param listener - Called once when the editor is destroyed. @returns Detaches it. */
  onDestroy(listener: () => void): () => void;
  /** @returns Every block of the current text, parents before children, in source order. */
  blocks(): readonly QuireAiSourceBlock[];
  /** @param text - Standalone source. @returns Its blocks, parsed without the editor. */
  segment(text: string): readonly QuireAiSourceBlock[];
  /** @returns Main selection. */
  selection(): QuireAiSourceRange;
  /** @param steps - Steps to try. @returns What they would change; nothing is applied. */
  plan(steps: readonly QuireAiSourceStep[]): QuireAiSourceStepResult;
  /** @param steps - Steps to apply. @param meta - Attribution. @returns Outcome; steps apply as one transaction and one undo step, or not at all. */
  apply(steps: readonly QuireAiSourceStep[], meta: QuireAiSourceWriteMeta): QuireAiSourceStepResult;
  /** @param listener - Called for each accepted transaction. @returns Unsubscribes. */
  subscribe(listener: (transaction: QuireAiSourceTransaction) => void): () => void;
  /** @returns Commands that carry an Agent description, by name. */
  commands(): ReadonlyMap<string, QuireAiSourceCommandDescriptor>;
  /** @returns Facts of the installed extensions. */
  capabilities(): readonly QuireAiSourceCapability[];
}

/** Write policy of the application, consulted at each write. */
export type QuireAiSourceWriteDecision =
  | {
    /** The write may proceed. */
    readonly allowed: true;
    /** Whether the request's writes are recorded for one review at its end. */
    readonly review: boolean;
  }
  | {
    /** The write is refused. */
    readonly allowed: false;
    /** Safe reason. */
    readonly reason: string;
  };
