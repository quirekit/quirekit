import type { Node } from "@quirekit/pm";
import type { QuireAiActionCapability, QuireAiFormatCapability } from "@quirekit/ai-contract";
import type { QuireAiViewBlock } from "../view/types";
import type { QuireAiAppliedEdit } from "./apply";
import type { QuireAiInlineSpan } from "./markup";

/** Document range in start-document positions. */
export interface QuireAiEditRange {
  /** Range start. */
  readonly from: number;
  /** Range end. */
  readonly to: number;
}

/** One format value to apply. */
export interface QuireAiFormatValue {
  /** Format capability that applies the value. */
  readonly format: QuireAiFormatCapability;
  /** Schema-valid value, or null to clear. */
  readonly value: unknown;
}

/** New block with the formats to apply once it is in the document. */
export interface QuireAiPlannedBlock {
  /** Block node to insert. */
  readonly node: Node;
  /** Paragraph formats of the new block. */
  readonly paragraph: readonly QuireAiFormatValue[];
  /** Character formats, offsets relative to the block's text. */
  readonly spans: readonly (QuireAiInlineSpan & QuireAiFormatValue)[];
  /** Character formats of text blocks inside a created block such as a table's cells, from their inline markup. */
  readonly nested?: readonly QuireAiNestedSpans[] | undefined;
}

/** Character formats of one text block inside a created block. */
export interface QuireAiNestedSpans {
  /** Content start of the text block, relative to the position before the created block. */
  readonly offset: number;
  /** Character formats, offsets relative to the text block's text. */
  readonly spans: readonly (QuireAiInlineSpan & QuireAiFormatValue)[];
}

/** Validated operation with positions in the start document. */
export type QuireAiPlannedOperation = QuireAiPlannedOperationBody & {
  /** Index of the model operation it was planned from; one model operation may plan several. */
  readonly source: number;
};

/** Planned operation without its source index. */
export type QuireAiPlannedOperationBody =
  | {
      /** Replaces a block's inline content. */
      readonly kind: "replace-content";
      /** Content range of the block. */
      readonly range: QuireAiEditRange;
      /** New text. */
      readonly text: string;
      /** Character formats, offsets relative to `text`. */
      readonly spans: readonly (QuireAiInlineSpan & QuireAiFormatValue)[];
    }
  | {
      /** Replaces exact text, keeping its formatting. */
      readonly kind: "replace-text";
      /** Text range. */
      readonly range: QuireAiEditRange;
      /** Replacement text. */
      readonly text: string;
    }
  | {
      /** Inserts blocks at a block boundary. */
      readonly kind: "insert";
      /** Boundary position. */
      readonly at: number;
      /** Blocks in order. */
      readonly blocks: readonly QuireAiPlannedBlock[];
    }
  | {
      /** Moves adjacent sibling blocks, nodes and all, to a boundary. */
      readonly kind: "move";
      /** Start of the moved blocks. */
      readonly from: number;
      /** End of the moved blocks. */
      readonly to: number;
      /** Boundary they land at, outside them. */
      readonly at: number;
    }
  | {
      /** Removes whole blocks, or clears a container's last remaining block. */
      readonly kind: "delete";
      /** Block ranges, and whether to clear the content instead of removing the block. */
      readonly ranges: readonly QuireAiDeletionRange[];
    }
  | {
      /** Applies formats to ranges. */
      readonly kind: "format";
      /** Ranges with the formats applied to each. */
      readonly targets: readonly (QuireAiEditRange & QuireAiFormatValue)[];
    }
  | {
      /** Runs a feature-declared block action. */
      readonly kind: "action";
      /** Action fact. */
      readonly action: QuireAiActionCapability;
      /** Position before the target block, or null without a target. */
      readonly pos: number | null;
      /** Content start of the first body section, where an untargeted action places the selection. */
      readonly defaultAnchor: number | null;
      /** Text range selected before the action runs, for `target: "text"` actions. */
      readonly range: QuireAiEditRange | null;
      /** Schema-valid parameters. */
      readonly params: unknown;
      /** What the action's `prepare` produced for these parameters. */
      readonly prepared?: unknown;
      /** Text a text-target operation named, or null for the whole block. */
      readonly text?: string | null;
    };

/** Block removed by a delete operation. */
export interface QuireAiDeletionRange extends QuireAiEditRange {
  /** Whether the block is cleared instead of removed, because its container would become empty. */
  readonly clear: boolean;
  /** Content range of the container a cleared block keeps alive. */
  readonly container?: QuireAiEditRange | undefined;
}

/** One operation an edit could not carry out. */
export interface QuireAiEditFailure {
  /** Index of the operation in the model's list. */
  readonly source: number;
  /** Failure code, such as `invalid-input` or `stale-target`. */
  readonly code: string;
  /** Message naming the operation and how to fix it. */
  readonly message: string;
}

/** Result of planning an edit operation by operation. */
export interface QuireAiEditPlan {
  /** Operations that planned, in start-document positions. */
  readonly planned: readonly QuireAiPlannedOperation[];
  /** Operations that did not, in list order. */
  readonly failures: readonly QuireAiEditFailure[];
  /** Operations past the per-call limit, left unprocessed. */
  readonly unprocessed: number;
}

/** One block holding searched text, with the range of each occurrence. */
export interface QuireAiTextMatches {
  /** Block as the view lists it. */
  readonly block: QuireAiViewBlock;
  /** Occurrence ranges in document order. */
  readonly ranges: readonly QuireAiEditRange[];
}

/** An operation as the model wrote it. */
export type QuireAiModelOperation = Record<string, unknown>;

/** What one `document_edit` call has committed while its arguments were still streaming. */
export interface QuireAiStreamState {
  /** Whether this call commits as it streams; decided once from the write policy. */
  readonly enabled: boolean;
  /** Operations fully handed to the queue, a prefix of the model's list. */
  doneOperations: number;
  /** Blocks of operation `doneOperations` handed to the queue, when it is a streaming insert. */
  doneBlocks: number;
  /** Where the rest of each partly written insert goes, after its blocks already written, by model index. */
  readonly anchors: Map<number, QuireAiModelOperation>;
  /** Operations held back to the final write, such as a delete that would empty its container before new blocks arrive. */
  readonly deferred: number[];
  /** Committed parts, numbered by the model's operation index. */
  readonly parts: { readonly source: number; readonly applied: QuireAiAppliedEdit | null; readonly failures: readonly string[] }[];
  /** Commits in model order. */
  queue: Promise<void>;
}
