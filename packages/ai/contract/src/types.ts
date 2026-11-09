import type { QuireExtensionThisContext, SingleCommands } from "@quirekit/core";
import type { Mark, Node, Schema, Transaction } from "@quirekit/pm";

/** Plain JSON Schema object describing accepted values. */
export type QuireAiJsonSchema = Readonly<Record<string, unknown>>;

/** Structural role a node plays in the AI document view. */
export type QuireAiStructureRole =
  /** Main content container; its blocks form the body section of the view. */
  | "body"
  /** Independent text flow such as a header or footer, listed as its own section. */
  | "story"
  /** Invisible container of stories; the view descends into it. */
  | "store";

/** Declares the structural role of one node type. */
export interface QuireAiStructureCapability {
  /** Capability discriminator. */
  readonly kind: "structure";
  /** Schema node name. */
  readonly node: string;
  /** Role in the document view. */
  readonly role: QuireAiStructureRole;
  /**
   * Names a story section for the model.
   * @param node - Story node.
   * @param doc - Document root, for stories referenced from elsewhere in the document.
   * @returns Short human-readable section title, or null to leave the story out of the view.
   */
  readonly label?: ((node: Node, doc: Node) => string | null) | undefined;
}

/**
 * Supplies the section title of stories a feature owns, such as comment messages.
 * Several features may label stories of one node; a feature that hides a story wins,
 * otherwise the first title wins, and the structure fact's title is the fallback.
 */
export interface QuireAiStoryLabelCapability {
  /** Capability discriminator. */
  readonly kind: "story-label";
  /** Story node name, as declared by a structure fact with role `story`. */
  readonly node: string;
  /**
   * Names a story section for the model.
   * @param node - Story node.
   * @param doc - Document root.
   * @returns Section title; null leaves out a story that belongs to an object shown elsewhere,
   * such as a watermark's text; undefined for stories this feature does not own.
   */
  readonly label: (node: Node, doc: Node) => string | null | undefined;
}

/**
 * Supplies the view label, and optionally the internal items, of block or inline nodes a feature
 * owns although another feature declares the node, such as a watermark drawn by a drawing node or
 * a whiteboard stored as a picture. The first owner wins, and the block fact is the fallback.
 */
export interface QuireAiBlockLabelCapability {
  /** Capability discriminator. */
  readonly kind: "block-label";
  /** Node name, as declared by a block fact. */
  readonly node: string;
  /**
   * Labels a node for the model.
   * @param node - Node.
   * @param doc - Document root, when known.
   * @returns Label, an empty one to hide an inline node, or undefined for nodes this feature does not own.
   */
  readonly label: (node: Node, doc?: Node) => string | undefined;
  /**
   * Internal semantic items of an owned node, read through the core's paged read tool; an inline
   * node's items are read through the text block holding it.
   * @param node - Node.
   * @returns Source-order items, or undefined for nodes this feature does not own.
   */
  readonly items?: ((node: Node) => readonly import("./items/types").QuireAiBlockItem[] | undefined) | undefined;
  /**
   * How people see an owned node when reviewing a change; never shown to the model.
   * @param node - Node.
   * @returns Presentation, or undefined for nodes this feature does not own.
   */
  readonly present?: ((node: Node) => QuireAiBlockPresentation | undefined) | undefined;
}

/** How people see a block or inline object when reviewing a change. */
export interface QuireAiBlockPresentation {
  /** Short name, such as "图片：季度营收" or "流程图「系统架构设计」". */
  readonly label: string;
  /** Image showing the object, such as a picture's own rendering. */
  readonly image?: QuireAiPresentedImage | undefined;
}

/** Image a review shows for an object; the host resolves its media reference. */
export interface QuireAiPresentedImage {
  /** Host media reference, such as a document picture's source. */
  readonly source: unknown;
  /** Intrinsic width in CSS pixels, when known. */
  readonly width?: number | undefined;
  /** Intrinsic height in CSS pixels, when known. */
  readonly height?: number | undefined;
}

/**
 * Adds a short note to the caption of a listed child, for a feature that marks nodes another feature
 * lists, such as a content control on a table row or cell. A row's note joins the caption of its first
 * cell; a cell's note joins its own.
 */
export interface QuireAiNoteCapability {
  /** Capability discriminator. */
  readonly kind: "note";
  /** Node name of the marked node, such as a table row or cell. */
  readonly node: string;
  /**
   * @param node - Marked node.
   * @param container - Block whose children are listed, such as the table.
   * @returns Note, or undefined when the node carries nothing this feature owns.
   */
  readonly note: (node: Node, container: Node) => string | undefined;
}

/**
 * Tells whether a block is already removed pending review, such as a tracked deletion: it stays
 * visible until decided, and deleting it again is already done.
 */
export interface QuireAiRemovalCapability {
  /** Capability discriminator. */
  readonly kind: "removal";
  /**
   * @param node - Block node.
   * @returns Whether the whole block is removed pending review.
   */
  readonly removed: (node: Node) => boolean;
}

/** One line of the document settings section. */
export interface QuireAiDocumentSettingEntry {
  /** Setting name, such as "页面" or "样式“正文”"; also pairs the entry across documents. */
  readonly label: string;
  /** Setting value in the view notation. */
  readonly value: string;
}

/** Declares document-level settings shown at the top of the view, such as page setup and styles. */
export interface QuireAiDocumentSettingCapability {
  /** Capability discriminator. */
  readonly kind: "document-setting";
  /** Globally unique setting group name. */
  readonly name: string;
  /** Position among setting groups, smaller first: broad settings such as the page before details such as styles. Defaults to 100. */
  readonly order?: number | undefined;
  /**
   * Reads the settings of one document.
   * @param doc - Document root.
   * @returns Entries in display order; empty when the feature has nothing to show.
   */
  readonly read: (doc: Node) => readonly QuireAiDocumentSettingEntry[];
}

/** Declares how one block node type appears in the AI document view. */
export interface QuireAiBlockCapability {
  /** Capability discriminator. */
  readonly kind: "block";
  /** Schema node name. */
  readonly node: string;
  /**
   * Short type label shown instead of the inline text summary, such as "表格 2×3".
   * Text blocks omit it and show their text. For an inline atom, an empty label
   * hides it from the view.
   * @param node - Block node.
   * @param doc - Document root when the caller has it, such as for numbering a reference.
   * @returns Label for a non-text block.
   */
  readonly label?: ((node: Node, doc?: Node) => string) | undefined;
  /**
   * Internal semantic items available through the core's paged read tool.
   * @param node - Exact immutable block.
   * @returns Source-order facts without binary payloads or model instructions.
   */
  readonly items?: ((node: Node) => readonly import("./items/types").QuireAiBlockItem[]) | undefined;
  /**
   * Nested blocks listed beneath this block, such as table cells.
   * @param node - Container block.
   * @returns Child block nodes with a short position caption.
   */
  readonly children?: ((node: Node) => readonly QuireAiBlockChild[]) | undefined;
  /**
   * Lists the block's own child blocks beneath it, for a wrapper such as a block content control
   * that has an id of its own and holds whole paragraphs.
   */
  readonly contains?: boolean | undefined;
  /**
   * Read-only properties of an inline container, shown after its content as `⟦content⟧{name:value}`,
   * such as a content control's kind, title and choices.
   * @param node - Inline container node.
   * @param doc - Document root when the caller has it.
   * @returns Properties in display order, or undefined to show none.
   */
  readonly properties?: ((node: Node, doc?: Node) => Readonly<Record<string, unknown>> | undefined) | undefined;
  /**
   * How people see the node when reviewing a change; never shown to the model. Without it a
   * review names the node by its label.
   * @param node - Block or inline node.
   * @returns Presentation, or undefined to use the label.
   */
  readonly present?: ((node: Node) => QuireAiBlockPresentation | undefined) | undefined;
  /** Makes this block insertable by the editing tool, keyed as `{[key]: value}`. */
  readonly create?: QuireAiBlockCreation | undefined;
}

/** Declares how the editing tool creates a new block. */
export interface QuireAiBlockCreation {
  /** Key of the insert entry, such as "table" in `{table: [["a", "b"]]}`. */
  readonly key: string;
  /** One-sentence meaning of the value for the model. */
  readonly description: string;
  /** Value schema. */
  readonly schema: QuireAiJsonSchema;
  /**
   * Builds the block.
   * @param value - Schema-valid value.
   * @param schema - Editor schema.
   * @returns New block node.
   */
  readonly build: (value: unknown, schema: Schema) => Node;
}

/** One nested block exposed by a container block. */
export interface QuireAiBlockChild {
  /** Child node that owns the listed blocks. */
  readonly node: Node;
  /** Position of the child relative to the container's content start; may be nested deeper than a direct child. */
  readonly offset: number;
  /** Caption shown before the child's first block, such as "(1,2)". */
  readonly caption: string;
  /** Nodes between the container and the child, outermost first, such as the row of a table cell; their notes join the caption. */
  readonly owners?: readonly Node[] | undefined;
}

/** Formatting plane a format capability belongs to. */
export type QuireAiFormatLevel = "character" | "paragraph";

/** Declares one named, model-visible formatting property. */
export interface QuireAiFormatCapability {
  /** Capability discriminator. */
  readonly kind: "format";
  /** Globally unique property name used in the view and by editing tools. */
  readonly name: string;
  /** Whether the property belongs to text runs or to paragraphs. */
  readonly level: QuireAiFormatLevel;
  /** One-sentence meaning and value range for the model. */
  readonly description: string;
  /**
   * Reads the property from a text run (character) or a text block (paragraph).
   * @param target - Text node marks, or the paragraph node.
   * @returns JSON value, or undefined when the property is not set.
   */
  readonly read: (target: QuireAiFormatTarget) => unknown;
  /** Schema of accepted values, the same value space `read` returns; `null` always clears. */
  readonly schema?: QuireAiJsonSchema | undefined;
  /**
   * Applies the value inside the editing tool's command chain. The range is
   * already selected, so selection-based commands of the owning feature apply to it.
   * @param context - Shared transaction, mapped range and single-command runner.
   * @param value - Schema-valid value, or null to clear.
   * @returns Whether the owning command accepted the change.
   */
  readonly apply?: ((context: QuireAiFormatApplyContext, value: unknown) => boolean) | undefined;
  /**
   * Optional whole-range satisfaction rule paired with the applying owner.
   * Defaults to comparing `read` on every paragraph or character run.
   * @param context - Immutable current document and mapped selected range.
   * @param value - Schema-valid requested value, or null to clear.
   * @returns Whether the complete range already satisfies all requested fields.
   */
  readonly satisfied?: ((context: QuireAiFormatSatisfactionContext, value: unknown) => boolean) | undefined;
  /** Chooses among several declarations able to apply one format; the highest wins. */
  readonly applyPriority?: number | undefined;
  /**
   * Paragraph formats only: blocks carrying the format are numbered in sequence, such as list items.
   * Text placed after such a block for it, like a translation, continues inside the block so numbering stays.
   */
  readonly numbered?: boolean | undefined;
  /** How people see the format when reviewing a change; never shown to the model. */
  readonly present?: QuireAiFormatPresentation | undefined;
}

/** People-facing name and values of one format. */
export interface QuireAiFormatPresentation {
  /** Short name, such as "对齐". */
  readonly label: string;
  /**
   * Writes one value for people, such as "居中" for "center".
   * @param value - Value as `read` returns it.
   * @returns Display text; omitted shows the value as plain text.
   */
  readonly value?: ((value: unknown) => string) | undefined;
}

/** Transaction-bound context a format applies into. */
export interface QuireAiFormatApplyContext {
  /** Transaction shared by every operation of one edit. */
  readonly tr: Transaction;
  /** Commands running on the shared transaction. */
  readonly commands: SingleCommands;
  /** Range start in the transaction's current document: a text range, or a block's content start. */
  readonly from: number;
  /** Range end in the transaction's current document. */
  readonly to: number;
}

/** Read-only current range inspected before deciding whether a format needs execution. */
export interface QuireAiFormatSatisfactionContext {
  /** Immutable document at the current transaction stage. */
  readonly doc: Node;
  /** Mapped content start of the selected range. */
  readonly from: number;
  /** Mapped content end of the selected range. */
  readonly to: number;
}

/** Source a format capability reads from. */
export type QuireAiFormatTarget =
  | {
      /** Character-level target discriminator. */
      readonly level: "character";
      /** Marks on one text run. */
      readonly marks: readonly Mark[];
    }
  | {
      /** Paragraph-level target discriminator. */
      readonly level: "paragraph";
      /** Text block node. */
      readonly node: Node;
      /** Document root, for formats resolved through document-level registries. */
      readonly doc: Node;
      /**
       * Position before the block when the reader knows it, for values that depend on the block's
       * place in the document, such as the number a list item shows. Absent when formats are
       * copied to another block, so such values are not copied.
       */
      readonly pos?: number | undefined;
    };

/**
 * One edit operation beyond the core ones, built by the AI core from an editor command that carries an Agent
 * description; features describe their commands with `defineCommand` instead of declaring actions.
 */
export interface QuireAiActionCapability {
  /** Operation discriminator. */
  readonly kind: "action";
  /** Operation name: the command name. */
  readonly name: string;
  /** One-sentence meaning for the model. */
  readonly description: string;
  /** Block types accepted as target; omitted means any block, or none for the first body section. */
  readonly nodes?: readonly string[] | undefined;
  /**
   * What the operation addresses: a whole block (default); exact `text` inside the
   * target block (the whole block content when `text` is omitted), selected before
   * `apply` runs; or nothing, for operations on
   * document-level objects named in `params`.
   */
  readonly target?: "block" | "text" | "none" | undefined;
  /**
   * Whether the operation may only share an edit with other standalone actions,
   * because its command owns the whole transaction (such as a revision decision).
   */
  readonly standalone?: boolean | undefined;
  /** Catalog group, such as "表格"; ungrouped actions are listed first. */
  readonly category?: string | undefined;
  /** Side effect declared by the command; a policy change lets the product policy always ask for approval. */
  readonly risk?: "read" | "write" | "policy" | undefined;
  /** JSON Schema of `params`. */
  readonly schema: QuireAiJsonSchema;
  /**
   * Prepares what the command needs and cannot get inside the synchronous chain, such as a
   * picture registered in the host's media store; runs once per distinct `params` before the edit.
   * @param params - Schema-valid parameters.
   * @param ports - Host ports of the document SDK.
   * @returns Value handed to `apply` as `context.prepared`.
   * @throws Error whose message, naming the fix, fails only this operation.
   */
  readonly prepare?: ((params: unknown, ports: QuireAiHostPorts) => Promise<unknown>) | undefined;
  /**
   * Runs the owning feature's command inside the editing tool's chain.
   * @param context - Shared transaction, single-command runner and mapped target.
   * @param params - Schema-valid parameters.
   * @returns Whether the owning command accepted the change.
   */
  readonly apply: (context: QuireAiActionContext, params: unknown) => boolean;
}

/** Transaction-bound context an action runs in. */
export interface QuireAiActionContext {
  /** Transaction shared by every operation of one edit. */
  readonly tr: Transaction;
  /** Commands running on the shared transaction. */
  readonly commands: SingleCommands;
  /** Position before the target block in the transaction's current document, or null without a target. */
  readonly pos: number | null;
  /** Selected text range for `target: "text"` actions (the block content when `text` is omitted), in the transaction's current document. */
  readonly range: { readonly from: number; readonly to: number } | null;
  /** Product-configured AI identity, for authored content such as comments; null when none is configured. */
  readonly author: { readonly id: string; readonly name: string } | null;
  /** What the action's `prepare` returned for these parameters; undefined for actions without `prepare`. */
  readonly prepared?: unknown;
  /** Exact text a `target: "text"` operation named, or null when it addresses the whole block. */
  readonly text?: string | null;
}

/** Host services the document SDK offers to actions. */
export interface QuireAiHostPorts {
  /** Pictures the model may insert; absent when the host has none. */
  readonly pictures?: QuireAiPicturePort | undefined;
  /** Pagination of the laid-out document; absent without a mounted layout. */
  readonly layout?: QuireAiLayoutPort | undefined;
}

/** One page of the laid-out document. */
export interface QuireAiLayoutPage {
  /** First document position of the page's body content. */
  readonly from: number;
  /** End document position of the page's body content. */
  readonly to: number;
  /** Share of the page body used by content, 0–1, or null when unknown. */
  readonly used: number | null;
}

/** Pagination the host's layout provides, so the view can show where pages end. */
export interface QuireAiLayoutPort {
  /**
   * @param doc - Document the pages must belong to.
   * @returns Pages in order, or null when no layout of this document is available.
   */
  readonly pages: (doc: Node) => readonly QuireAiLayoutPage[] | null;
}

/** One picture of the host's catalog. */
export interface QuireAiPictureAsset {
  /** Identifier the model writes, such as `avatar/woman-1`. */
  readonly id: string;
  /** Category, such as `头像`, `图标` or `装饰`. */
  readonly category: string;
  /** What the picture shows and what it suits. */
  readonly description: string;
  /** Width divided by height. */
  readonly aspect: number;
}

/** A picture generated and registered by the host, ready to place in the document. */
export interface QuireAiPreparedPicture {
  /** Media reference the picture node stores. */
  readonly source: unknown;
  /** Pixel size of the registered image. */
  readonly intrinsicSize: { readonly width: number; readonly height: number };
  /** File name shown for the picture. */
  readonly name: string;
}

/** Pictures supplied by the host, such as built-in illustrations recoloured by palette. */
export interface QuireAiPicturePort {
  /** @returns The catalog. */
  list(): readonly QuireAiPictureAsset[];
  /** @returns Palette names, the first being the default. */
  palettes(): readonly string[];
  /**
   * Generates a picture and registers it in the host's media store.
   * @param request - Catalog id and optional palette.
   * @returns The registered picture.
   * @throws Error naming an unknown id or palette.
   */
  prepare(request: { readonly asset: string; readonly palette?: string | undefined }): Promise<QuireAiPreparedPicture>;
}

/** Any fact an extension contributes to the AI manager. */
export type QuireAiCapability =
  | QuireAiStructureCapability
  | QuireAiBlockCapability
  | QuireAiFormatCapability
  | QuireAiStoryLabelCapability
  | QuireAiBlockLabelCapability
  | QuireAiRemovalCapability
  | QuireAiDocumentSettingCapability
  | QuireAiNoteCapability;

/** Factory installed on any extension kind that contributes AI facts. */
export type QuireAiCapabilityFactory<
  Options extends object = object,
  Storage extends object = object
> = (
  this: QuireExtensionThisContext<Options, Storage>,
  context: QuireExtensionThisContext<Options, Storage>
) => readonly QuireAiCapability[];

declare module "@quirekit/core" {
  interface QuireExtensionConfig<Options extends object = object, Storage extends object = object> {
    /** Contributes facts that describe this extension's content to the AI manager. */
    readonly addAiCapabilities?: QuireAiCapabilityFactory<Options, Storage>;
  }

  interface QuireNodeConfig<Options extends object = object, Storage extends object = object> {
    /** Contributes facts that describe this node to the AI manager. */
    readonly addAiCapabilities?: QuireAiCapabilityFactory<Options, Storage>;
  }

  interface QuireMarkConfig<Options extends object = object, Storage extends object = object> {
    /** Contributes facts that describe this mark to the AI manager. */
    readonly addAiCapabilities?: QuireAiCapabilityFactory<Options, Storage>;
  }
}
