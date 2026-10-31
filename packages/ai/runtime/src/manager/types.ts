import type { QuireAiLayoutPort, QuireAiPicturePort } from "@quirekit/ai-contract";
import type { QuireAiSkillLibrary } from "../skills";
import type { QuireAiTransformOptions } from "./transform/types";
import type { QuireEditor } from "@quirekit/core";
import type { Node, Step } from "@quirekit/pm";
import type {
  QuireAiRemovalCapability, QuireAiNoteCapability,
  QuireAiActionCapability, QuireAiBlockCapability, QuireAiFormatCapability, QuireAiStructureCapability, QuireAiDocumentSettingCapability
} from "@quirekit/ai-contract";
import type { QuireDocumentSdk, QuireDocumentSdkOptions } from "../document-sdk";
import type { QuireAiToolHost } from "../tool-host";
import type { QuireDocumentTool } from "../document-tools";

/** Facts compiled from every installed extension. */
export interface QuireAiRegistry {
  /** Structural roles keyed by node name. */
  readonly structures: ReadonlyMap<string, QuireAiStructureCapability>;
  /** Block presentation keyed by node name. */
  readonly blocks: ReadonlyMap<string, QuireAiBlockCapability>;
  /** Caption notes of marked nodes, keyed by node name. */
  readonly notes: ReadonlyMap<string, readonly QuireAiNoteCapability[]>;
  /** Character formats in declaration order. */
  readonly characterFormats: readonly QuireAiFormatCapability[];
  /** Paragraph formats in declaration order. */
  readonly paragraphFormats: readonly QuireAiFormatCapability[];
  /** Block actions keyed by operation name. */
  readonly actions: ReadonlyMap<string, QuireAiActionCapability>;
  /** Document setting groups in declaration order. */
  readonly settings: readonly QuireAiDocumentSettingCapability[];
  /** Tests of blocks already removed pending review. */
  readonly removals: readonly QuireAiRemovalCapability[];
}

/** Options for a document SDK created by the AI manager. */
export interface QuireAiDocumentSdkOptions extends Omit<QuireDocumentSdkOptions, "editor" | "tools"> {
  /**
   * Transitional tools served beside the core tools.
   * @param host - Guarded command host.
   * @returns Extra tools with names distinct from the core tools.
   */
  readonly tools?: ((host: QuireAiToolHost) => readonly QuireDocumentTool[]) | undefined;
  /** Model access for `document_transform`; without it the tool is not served. */
  readonly transform?: QuireAiTransformOptions | undefined;
  /** Skills offered through `skill_read`; without it the tool is not served. */
  readonly skills?: QuireAiSkillLibrary | undefined;
  /** Pictures actions may insert, such as built-in illustrations. */
  readonly pictures?: QuireAiPicturePort | undefined;
  /** Pagination of the mounted layout, shown in the document view as page breaks. */
  readonly layout?: QuireAiLayoutPort | undefined;
}

/** Per-editor AI manager. */
export interface QuireAiManager {
  /** Editor the manager belongs to. */
  readonly editor: QuireEditor;
  /** Facts compiled on first access. */
  readonly registry: QuireAiRegistry;
  /** Assigns and resolves model-visible block identities. */
  readonly identity: QuireAiBlockIdentity;
  /**
   * Creates a document SDK serving the core tools.
   * @param options - Document identity, write policy and transitional tools.
   * @returns Document SDK bound to this editor.
   */
  createDocumentSdk(options: QuireAiDocumentSdkOptions): QuireDocumentSdk;
  /** In-document previews of edits being generated or awaiting approval. */
  readonly previews: QuireAiPreviews;
}

/** Visual role of a previewed range. */
export type QuireAiPresentationRole = "inserted" | "removed" | "changed";

/**
 * Render-only preview of an edit: the steps turn `baseDoc` into the document
 * shown while generating, where replaced and deleted content is still present.
 * Its shape matches the View Engine presentation overlay.
 */
export interface QuireAiPresentation {
  /** Canonical document the steps apply to. */
  readonly baseDoc: Node;
  /** Steps producing the presented document. */
  readonly steps: readonly Step[];
  /** Ranges in the presented document with their roles. */
  readonly ranges: readonly {
    /** Range start. */
    readonly from: number;
    /** Range end. */
    readonly to: number;
    /** Visual role. */
    readonly role: QuireAiPresentationRole;
  }[];
  /** Present while the edit awaits the user's approval. */
  readonly review?: QuireAiPreviewReview | undefined;
}

/** Decision port of an edit awaiting approval, shared with every other review surface. */
export interface QuireAiPreviewReview {
  /** @returns Whether the pending review accepted the approval. */
  approve(): boolean;
  /** @returns Whether the pending review accepted the rejection. */
  reject(): boolean;
}

/** Current in-document preview of an editor's AI edits. */
export interface QuireAiPreviews {
  /** Preview currently shown, or null. */
  readonly current: QuireAiPresentation | null;
  /**
   * Observes preview changes.
   * @param listener - Receives the new preview, or null when it is cleared.
   * @returns Unsubscribe function.
   */
  subscribe(listener: (presentation: QuireAiPresentation | null) => void): () => void;
}

/** One block position awaiting an identity. */
export interface QuireAiBlockEntry {
  /** Position before the block node. */
  readonly pos: number;
  /** Schema node name, used to reject a position now held by another kind of block. */
  readonly type: string;
  /** Node size, so the mapped end can confirm the same block still spans the mapped range. */
  readonly size: number;
}

/** Model-visible block identities that survive edits between reads. */
export interface QuireAiBlockIdentity {
  /**
   * Assigns identities in document order, reusing each identity whose block still exists.
   * @param entries - Every block of the current document in order.
   * @returns Identity for each entry.
   */
  assign(entries: readonly QuireAiBlockEntry[]): readonly string[];
  /**
   * Resolves an identity to the block's current position.
   * @param id - Identity from the latest read.
   * @returns Current position, or null when the block no longer exists.
   */
  resolve(id: string): number | null;
  /**
   * Tells an id this table issued, whether or not its block still exists, from other text of the same shape.
   * @param id - Candidate id such as `b3`.
   * @returns Whether the table issued it.
   */
  issued(id: string): boolean;
  /** Stops following transactions. */
  destroy(): void;
}
