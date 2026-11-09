import type { CoreCommandMethods } from "./commands/types";
import type {
  AttributeSpec,
  Decoration,
  DecorationSource,
  DOMOutputSpec,
  EditorProps as PMEditorProps,
  EditorState as PMEditorState,
  Mark as PMMark,
  MarkType as PMMarkType,
  ParseOptions,
  MarkSpec,
  Node as PMNode,
  NodeSpec,
  NodeType as PMNodeType,
  ParseRule,
  Plugin,
  Schema,
  SchemaSpec,
  Slice,
  TagParseRule,
  Transform,
  Transaction
} from "@quirekit/pm";
import type {
  MarkView as PMMarkView,
  MarkViewConstructor as PMMarkViewConstructor,
  NodeView as PMNodeView,
  NodeViewConstructor as PMNodeViewConstructor,
  ViewMutationRecord as PMViewMutationRecord
} from "@quirekit/pm-view";
import type {
  QuireMarkdownExtensionOptions,
  QuireMarkdownContentType,
  QuireMarkdownLexerConfiguration,
  QuireMarkdownManagerOptions,
  QuireMarkdownMarkParseResult,
  QuireMarkdownParseHelpers,
  QuireMarkdownParseResult,
  QuireMarkdownRendererHelpers,
  QuireMarkdownRenderContext,
  QuireMarkdownToken,
  QuireMarkdownTokenizer
} from "@quirekit/markdown";
import type {
  DocxManagerContributionValue,
  DocxManagerDiagnosticEvent,
  DocxManagerOptions
} from "@quirekit/docx";
import type { QuireEditor } from "./Editor";
import type { DecorationSpec, DecorationWithType } from "./decorations/types";
import type {
  GetUpdatedPositionResult,
  MappablePosition
} from "./helpers/MappablePosition";
import type { InputRule } from "./InputRule";
import type { Mark as QuireMarkExtension } from "./Mark";
import type { Node as QuireNodeExtension } from "./Node";
import type { PasteRule } from "./PasteRule";
import type {
  QuireLayoutProviderEntry,
  QuireLayoutProviderRegistration
} from "./layout-provider";
import type {
  QuireDocumentProfileEntry,
  QuireDocumentProfileRegistration
} from "./document-profile";
import type {
  QuireSelectionAdapterEntry,
  QuireSelectionAdapterRegistration,
  QuireSelectionContribution
} from "./selection-adapter";

/**
 * Parent config shape exposed to `extend()` callbacks.
 *
 * Function fields keep their parameter and return types; value fields are
 * exposed directly. This mirrors Tiptap's parent-field typing so extension
 * packages can use module augmentation without inventing QuireKit aliases.
 */
export type ParentConfig<Config> = Partial<{
  [Field in keyof Config]: Required<Config>[Field] extends (...args: any) => any
    ? (...args: Parameters<Required<Config>[Field]>) => ReturnType<Required<Config>[Field]>
    : Config[Field];
}>;

/** Converts a union into the intersection used by module-augmented commands. */
export type UnionToIntersection<Union> = (
  Union extends unknown ? (value: Union) => void : never
) extends (value: infer Intersection) => void
  ? Intersection
  : never;

/** Returns the value union of an object type. */
export type ValuesOf<Value> = Value[keyof Value];

/** Selects keys whose values extend a requested type. */
export type KeysWithTypeOf<Value, Requested> = {
  [Key in keyof Value]: Value[Key] extends Requested ? Key : never;
}[keyof Value];

/**
 * Command registry from which every public command surface derives. Core commands are
 * declared here directly; extensions add theirs with `declare module "@quirekit/core"`.
 */
export interface Commands<ReturnType = any> {
  /** Renderer-neutral commands installed by the core Commands extension. */
  readonly core: CoreCommandMethods<ReturnType>;
  /** Commands that control declarative decoration recomputation. */
  updateDecorations: {
    /**
     * Forces all or one extension's declarative decorations to rebuild.
     *
     * @param extensionName - Optional extension name to target.
     * @returns Command result.
     */
    updateDecorations: (extensionName?: string) => ReturnType;
  };
}

/** Tiptap-compatible props supplied to one raw command callback. */
export type CommandProps = {
  /** Editor instance that owns the command manager. */
  readonly editor: QuireEditor;
  /** Shared transaction mutated by the command. */
  readonly tr: Transaction;
  /** Command helpers that run against the same transaction. */
  readonly commands: SingleCommands;
  /** Creates non-dispatching availability helpers. */
  readonly can: () => CanCommands;
  /** Creates a chain that continues on the shared transaction. */
  readonly chain: () => ChainedCommands;
  /** Chainable ProseMirror state facade backed by the shared transaction. */
  readonly state: PMEditorState;
  /** Mounted editor view exposed to command callbacks. */
  readonly view: QuireMountedEditorView;
  /** Dispatch guard, omitted while checking command availability. */
  readonly dispatch: ((transaction?: Transaction) => void) | undefined;
};

/** Tiptap-compatible raw command callback. */
export type Command = (props: CommandProps) => boolean;

/** Tiptap-compatible command factory. */
export type CommandSpec = (...args: any[]) => Command;

/** Runtime command factory map. */
export type AnyCommands = Record<string, CommandSpec>;

/** Flattens every module-augmented command group into one command surface. */
export type UnionCommands<ReturnType = Command> = UnionToIntersection<
  ValuesOf<Pick<Commands<ReturnType>, KeysWithTypeOf<Commands<ReturnType>, object>>>
>;

/** Raw command factories collected by the extension manager. */
export type RawCommands = {
  [Item in keyof UnionCommands]: UnionCommands<Command>[Item];
};

/** Immediately executing command methods exposed by `editor.commands`. */
export type SingleCommands = {
  [Item in keyof UnionCommands]: UnionCommands<boolean>[Item];
};

/** Chainable command methods exposed by `editor.chain()`. */
export type ChainedCommands = {
  [Item in keyof UnionCommands]: UnionCommands<ChainedCommands>[Item];
} & {
  /** Dispatches the shared transaction and reports aggregate command success. */
  run: () => boolean;
};

/** Non-dispatching command methods exposed by `editor.can()`. */
export type CanCommands = SingleCommands & {
  /** Creates a non-dispatching command chain. */
  chain: () => ChainedCommands;
};

/** Tiptap-compatible focus position accepted by focus helpers. */
export type FocusPosition = "start" | "end" | "all" | number | boolean | null;

/** QuireKit compatibility alias for focus positions. */
export type QuireFocusPosition = FocusPosition;

/** Utility helpers exposed on editor instances. */
export interface QuireEditorUtils {
  /**
   * Maps a mappable position through a transaction.
   *
   * @param position - Position to map.
   * @param transaction - Transaction whose mapping should be applied.
   * @returns Updated position and map result.
   */
  readonly getUpdatedPosition: (
    position: MappablePosition,
    transaction: Transaction
  ) => GetUpdatedPositionResult;
  /**
   * Creates a mappable position from an absolute document position.
   *
   * @param position - Absolute document position.
   * @returns Mappable position instance.
   */
  readonly createMappablePosition: (position: number) => MappablePosition;
}

/** Maps key names such as `Mod-z` to extension shortcut handlers. */
export type QuireKeyboardShortcutMap = Readonly<Record<string, Command>>;

/** Lists Tiptap-compatible input rules contributed by an extension. */
export type QuireInputRuleList = readonly InputRule[];

/** Lists Tiptap-compatible paste rules contributed by an extension. */
export type QuirePasteRuleList = readonly PasteRule[];

/** Controls whether Tiptap-compatible rule plugins run for extensions. */
export type EnableRules = (QuireAnyExtension | string)[] | boolean;

/** QuireKit rule configuration, accepting immutable extension lists internally. */
export type QuireEnableRules = readonly (QuireAnyExtension | string)[] | boolean;

/** One extension-owned resource carried beside a private clipboard slice. */
export interface QuireClipboardResource {
  /** Stable extension namespace that owns validation and import behavior. */
  readonly namespace: string;
  /** Owner-local payload version used to reject incompatible resource shapes. */
  readonly version: number;
  /** Stable key used to deduplicate repeated references inside one transfer. */
  readonly key: string;
  /** JSON-safe owner-defined resource payload. */
  readonly data: unknown;
}

/** Immutable inputs supplied to one feature-owned clipboard resource importer. */
export interface QuireClipboardResourcePasteContext {
  /** Editor receiving the private clipboard transfer. */
  readonly editor: QuireEditor;
  /** Slice after earlier resource owners have applied identity remapping. */
  readonly slice: Slice;
  /** Validated resources carried beside the private clipboard slice. */
  readonly resources: readonly QuireClipboardResource[];
}

/** One feature-owned contribution to a composed private-resource paste. */
export interface QuireClipboardResourcePasteContribution {
  /** Slice after this owner has applied its target-local remapping. */
  readonly slice: Slice;
  /**
   * Applies owner metadata after the final slice replacement is in the transaction.
   *
   * @param transaction - Shared atomic paste transaction.
   * @returns Nothing.
   */
  readonly apply: (transaction: Transaction) => void;
}

/** ProseMirror-style editor props supported by QuireKit core. */
export interface QuireEditorProps<This = unknown> extends PMEditorProps<This> {
  /**
   * Supplies attributes for DOM-capable editor roots.
   *
   * Canvas and SVG modes may translate only renderer-neutral attributes. HTML
   * mode applies the resolved attributes to its mounted root.
   */
  readonly attributes?:
    | Record<string, string>
    | ((this: This, state: PMEditorState) => Record<string, string>);
  /**
   * Supplies transient view decorations for mounted editor views.
   *
   * HTML mode applies a limited DOM-safe subset. Canvas and SVG modes consume
   * non-flow inline/node decorations through a renderer-neutral decoration lane.
   */
  readonly decorations?: (
    this: This,
    state: PMEditorState
  ) => DecorationSource | null | undefined;
  /**
   * Enumerates extension-owned resources referenced by one copied slice.
   *
   * The generic clipboard transport validates and serializes these values but
   * never interprets owner-specific data.
   */
  readonly quireClipboardResources?: (
    this: This,
    slice: Slice,
    view: QuireMountedEditorView
  ) => readonly QuireClipboardResource[];
  /**
   * Imports feature-owned resources into one composed private clipboard paste.
   *
   * Owners return `null` when no compatible resource belongs to them. The
   * generic clipboard pipeline composes every returned slice first, replaces
   * the selection once, then applies every metadata contribution to the same
   * transaction.
   */
  readonly quireClipboardResourcePaste?: (
    this: This,
    context: QuireClipboardResourcePasteContext
  ) => QuireClipboardResourcePasteContribution | null;
  /**
   * Fills the input-owned paste transaction after resource remapping, before
   * resource application. Return false without changes to use normal replacement.
   * Never dispatch here; refusal sets `preventDispatch` on this transaction.
   * @param transaction - One uncommitted input transaction.
   * @param slice - Parsed, resource-remapped source content.
   * @param view - Originating mounted view.
   * @returns Whether the owner prepared or refused the replacement.
   */
  readonly quireClipboardPaste?: (
    this: This,
    transaction: Transaction,
    slice: Slice,
    view: QuireMountedEditorView
  ) => boolean;
}

/** Maps node names to ProseMirror node specs contributed by an extension. */
export type QuireNodeSpecMap = Readonly<Record<string, NodeSpec>>;

/** Maps mark names to ProseMirror mark specs contributed by an extension. */
export type QuireMarkSpecMap = Readonly<Record<string, MarkSpec>>;

/** Tiptap-compatible extension attribute metadata. */
export interface QuireExtensionAttributeSpec extends AttributeSpec {
  /** Whether this attribute should be emitted by rendered attribute helpers. */
  readonly rendered?: boolean | undefined;
  /**
   * Converts node or mark attrs to rendered HTML attributes.
   *
   * @param attrs - Full node or mark attrs object.
   * @returns HTML attributes to merge into the rendered output.
   */
  readonly renderHTML?: ((attrs: Readonly<Record<string, unknown>>) => Record<string, unknown> | null) | null;
  /**
   * Parses this attribute from an HTML element.
   *
   * @param element - Element being parsed by a ProseMirror parse rule.
   * @returns Parsed attribute value.
   */
  readonly parseHTML?: ((element: HTMLElement) => unknown) | null;
  /** Whether this attribute should be preserved when splitting a node. */
  readonly keepOnSplit?: boolean | undefined;
  /**
   * Projects a retained attribute onto the newly split node without mutating its source.
   *
   * @param value - Source attribute value.
   * @returns Attribute value for the new node.
   */
  readonly splitValue?: ((value: unknown) => unknown) | null | undefined;
  /** Whether this attribute must not receive a generated default. */
  readonly isRequired?: boolean | undefined;
}

/** Maps schema attribute names to ProseMirror-compatible attribute specs. */
export type QuireSchemaAttributeMap = Readonly<Record<string, QuireExtensionAttributeSpec>>;

/** Resolved attribute metadata for one extension node or mark type. */
export interface QuireExtensionAttribute {
  /** Node or mark type name that owns this attribute. */
  readonly type: string;
  /** Attribute name. */
  readonly name: string;
  /** Attribute metadata. */
  readonly attribute: Required<Omit<QuireExtensionAttributeSpec, "validate">> &
    Pick<QuireExtensionAttributeSpec, "validate">;
}

/** Lists ProseMirror plugins contributed by an extension. */
export type QuirePluginList = readonly Plugin[];

/** Identifies the authoring family that created an extension. */
export type QuireExtensionKind = "extension" | "node" | "mark";

/** HTML attributes passed to schema renderHTML callbacks. */
export type QuireHTMLAttributes = Readonly<Record<string, unknown>>;

/** Document range with inclusive start and exclusive end positions. */
export interface Range {
  /** Inclusive start document position. */
  from: number;
  /** Exclusive end document position. */
  to: number;
}

/** Immutable QuireKit document range. */
export interface QuireRange extends Range {
  /** Inclusive start document position. */
  readonly from: number;
  /** Exclusive end document position. */
  readonly to: number;
}

/** Predicate used by document traversal helpers. */
export type QuireNodePredicate = (node: PMNode) => boolean;

/** Node paired with its document position. */
export interface NodeWithPos {
  /** Matched node. */
  node: PMNode;
  /** Document position before the node. */
  pos: number;
}

/** Immutable QuireKit node and document-position pair. */
export interface QuireNodeWithPos extends NodeWithPos {
  /** Matched node. */
  readonly node: PMNode;
  /** Document position before the node. */
  readonly pos: number;
}

/** Mark paired with its document range. */
export interface MarkRange extends Range {
  /** Mark found in the range. */
  mark: PMMark;
}

/** Immutable QuireKit mark and document-range pair. */
export interface QuireMarkRange extends MarkRange {
  /** Inclusive start document position. */
  readonly from: number;
  /** Exclusive end document position. */
  readonly to: number;
  /** Mark found in the range. */
  readonly mark: PMMark;
}

/** Parent node match returned by ancestor traversal helpers. */
export interface QuireParentNodeMatch extends QuireNodeWithPos {
  /** Position at the start of the node content. */
  readonly start: number;
  /** Depth where the node was found. */
  readonly depth: number;
}

/** Text serializer callback used by static text helpers. */
export type QuireTextSerializer = (context: QuireTextSerializerContext) => string;

/** Context passed to a text serializer callback. */
export interface QuireTextSerializerContext {
  /** Node being serialized. */
  readonly node: PMNode;
  /** Node position relative to the start node. */
  readonly pos: number;
  /** Parent node when available. */
  readonly parent: PMNode;
  /** Child index in the parent. */
  readonly index: number;
  /** Requested text range. */
  readonly range: QuireRange;
}

/** Point in renderer-neutral canvas coordinate space. */
export interface QuireCanvasPoint {
  /** Horizontal coordinate. */
  readonly x: number;
  /** Vertical coordinate. */
  readonly y: number;
}

/** Rectangle in renderer-neutral canvas coordinate space. */
export interface QuireCanvasRect {
  /** Left coordinate. */
  readonly x: number;
  /** Top coordinate. */
  readonly y: number;
  /** Rectangle width. */
  readonly width: number;
  /** Rectangle height. */
  readonly height: number;
}

/** ProseMirror document range represented by a render command. */
export interface QuireCanvasDocumentRange {
  /** Inclusive start document position. */
  readonly from: number;
  /** Exclusive end document position. */
  readonly to: number;
}

/** Pointer routing policy retained by one mounted interaction target. */
export interface QuireMountedInteractionPointerPolicy {
  /** Retained routing behavior selected by the mounted View. */
  readonly kind: string;
  /** Whether the mounted editor should receive focus after activation. */
  readonly shouldFocusEditor?: boolean | undefined;
  /** Whether the originating browser event should be default-prevented. */
  readonly shouldPreventDefault?: boolean | undefined;
}

/** Clone-safe retained pointer target published by a mounted editor view. */
export interface QuireMountedInteractionTargetSnapshot {
  /** Interaction-hit family that won pointer routing. */
  readonly targetKind: string;
  /** Selection domain selected by the retained hit. */
  readonly selectionDomain: string;
  /** Command target selected by the retained hit. */
  readonly commandTarget: string;
  /** Semantic owner represented by the target, when one was retained. */
  readonly owner?: QuireViewWidgetOwner | undefined;
  /** Exact repeated visual occurrence represented by the target, when retained. */
  readonly visualInstanceId?: string | undefined;
  /** Semantic role carried by the retained target. */
  readonly role?: string | undefined;
  /** Named actionable part inside the semantic owner. */
  readonly part?: string | undefined;
  /** Half-open document range represented by the target. */
  readonly range?: QuireCanvasDocumentRange | undefined;
  /** Exact retained pointer rectangle in document coordinates. */
  readonly referenceRect?: QuireCanvasRect | undefined;
  /** Pointer policy already resolved by the mounted View. */
  readonly pointerPolicy?: QuireMountedInteractionPointerPolicy | undefined;
}

/** Host surface metadata exposed by renderer-neutral mounted view widgets. */
export interface QuireViewHost {
  /** Host backend kind such as `canvas`, `svg`, or `html`. */
  readonly kind: string;
  /** Optional stable host identifier. */
  readonly id?: string | undefined;
  /** Host-owned surface object. */
  readonly surface: unknown;
  /** Optional host metadata supplied by the mounted runtime. */
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

/** Renderer-neutral owner metadata attached to a mounted view widget. */
export interface QuireViewWidgetOwner {
  /** Semantic owner kind such as `document-node`, `decoration`, or `extension`. */
  readonly kind: string;
  /** Optional stable owner id. */
  readonly id?: string | undefined;
  /** Optional owner name such as a node, mark, extension, or widget family name. */
  readonly name?: string | undefined;
  /** Optional owner metadata supplied by the producing view integration. */
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

/** Renderer-neutral virtual widget object exposed by mounted editor views. */
export interface QuireViewWidget {
  /** Raw renderer target object backing this widget. */
  readonly target: unknown;
  /** Raw renderer target ancestry from this widget to the outermost target. */
  readonly targetPath: readonly unknown[];
  /** Stable widget identifier. */
  readonly id: string;
  /** Path within the compiled qkView tree. */
  readonly nodePath: string;
  /** Resolved widget rectangle in renderer coordinates. */
  readonly rect: QuireCanvasRect;
  /** Optional document range represented by this widget. */
  readonly range?: QuireCanvasDocumentRange | undefined;
  /** Optional semantic role such as `button` or `callout`. */
  readonly role?: string | undefined;
  /** Optional named part within a semantic widget. */
  readonly part?: string | undefined;
  /** Optional semantic owner that produced or owns this widget. */
  readonly owner?: QuireViewWidgetOwner | undefined;
  /** Whether this widget participates in pointer hit testing. */
  readonly pointerEvents: string;
  /** Optional cursor suggested while this widget is hovered. */
  readonly cursor?: string | undefined;
  /** Event bindings available on this widget. */
  readonly events: Readonly<Record<string, unknown>>;
  /** Current host surface supplied by the owning mounted runtime. */
  readonly host: QuireViewHost | undefined;
  /** Parent widget in the compiled target tree, if available. */
  readonly parent: QuireViewWidget | undefined;
  /** Direct child widgets in compiler output order. */
  readonly children: readonly QuireViewWidget[];
  /** Ancestor widgets from nearest parent to outermost parent. */
  readonly ancestors: readonly QuireViewWidget[];
  /**
   * Checks whether the widget rectangle contains a renderer-space point.
   *
   * @param point - Renderer-space point to test.
   * @returns Whether the point is inside the widget rectangle.
   */
  containsPoint(point: QuireCanvasPoint): boolean;
  /**
   * Checks whether the widget range contains a document position.
   *
   * @param position - Document position to test.
   * @returns Whether the position falls inside this widget range.
   */
  containsPosition(position: number): boolean;
  /**
   * Checks whether the widget range overlaps another document range.
   *
   * @param range - Document range to test.
   * @returns Whether the ranges overlap.
   */
  overlapsRange(range: QuireCanvasDocumentRange): boolean;
}

/** Result returned when a renderer-space point hits a mounted widget. */
export interface QuireViewWidgetHit {
  /** Deepest topmost widget hit by the point. */
  readonly widget: QuireViewWidget;
  /** Widget ancestry from deepest to outermost. */
  readonly path: readonly QuireViewWidget[];
  /** Pointer position used for the hit test. */
  readonly point: QuireCanvasPoint;
}

/**
 * Per-mark canvas text style delta for the Canvas/SVG track.
 *
 * A mark contributes only the properties it changes; the framework composes
 * deltas in document mark order over the node's base text style. This is how a
 * mark teaches the canvas backends to render without a hardcoded font map.
 */
export interface QuireMarkCanvasStyle {
  /** Inherited semantic style layer, resolved before direct mark formatting. */
  readonly cascade?: "inherited" | "direct";
  /** Font weight override applied to the marked text. */
  readonly fontWeight?: "normal" | "bold";
  /** Font style override applied to the marked text. */
  readonly fontStyle?: "normal" | "italic";
  /** Complex-script-only font weight applied after Unicode slot itemization. */
  readonly fontWeightComplexScript?: "normal" | "bold";
  /** Complex-script-only font style applied after Unicode slot itemization. */
  readonly fontStyleComplexScript?: "normal" | "italic";
  /** Explicit Word-compatible run direction, including explicit false. */
  readonly rightToLeft?: boolean;
  /** Direct hidden-text state, including explicit false. */
  readonly hidden?: boolean;
  /** Font-capital variant applied through the measured CSS font shorthand. */
  readonly fontVariantCaps?: "normal" | "small-caps";
  /** Length-preserving visual text transform applied before shaping and paint. */
  readonly textTransform?: "none" | "uppercase";
  /** Font family override applied to the marked text. */
  readonly fontFamily?: string;
  /** Latin and high-ANSI font family override applied during script itemization. */
  readonly fontFamilyLatin?: string;
  /** East Asian font family override applied during script itemization. */
  readonly fontFamilyEastAsia?: string;
  /** Complex-script font family override retained for script-aware shaping. */
  readonly fontFamilyComplexScript?: string;
  /** Opaque source hint interpreted only by the document profile's font selector. */
  readonly fontSelectionHint?: unknown;
  /** BCP 47 language for Latin and other non-East-Asian shaping runs. */
  readonly languageLatin?: string;
  /** BCP 47 language for East Asian shaping runs. */
  readonly languageEastAsia?: string;
  /** BCP 47 language for complex-script shaping runs. */
  readonly languageComplexScript?: string;
  /** Absolute CSS font size applied to the marked text (px values are honored on canvas). */
  readonly fontSize?: string;
  /** Complex-script-only absolute font size applied after Unicode slot itemization. */
  readonly fontSizeComplexScript?: string;
  /** Signed character spacing applied after each paintable grapheme. */
  readonly letterSpacing?: string;
  /** Whether text participates in a container's character grid; absence inherits. */
  readonly characterGrid?: boolean;
  /** Horizontal glyph-width ratio; tracking and vertical metrics remain independent. */
  readonly horizontalScale?: number | undefined;
  /** Relative multiplier applied after an absolute mark font size is resolved. */
  readonly fontScale?: number;
  /** Inherited glyph-only scale, applied after the absolute font size. */
  readonly glyphScale?: number;
  /** Independent highlighter overlay; null restores the underlying shading. */
  readonly highlightColor?: string | null;
  /** Baseline shift in final-font em units; positive values move the run upward. */
  readonly baselineShiftEm?: number;
  /** Glyph color applied to the marked text. */
  readonly color?: string;
  /** Background fill painted behind the marked text run. */
  readonly backgroundColor?: string;
  /** Underline pattern and optional independent paint color. */
  readonly underline?: {
    /** Standard underline token validated by the source extension. */
    readonly style: string;
    /** Opaque paint color; absence follows the glyph. */
    readonly color?: string;
  };
  /** Semantic emphasis value; explicit none clears inherited emphasis before layout. */
  readonly emphasisMark?: "none" | "dot" | "comma" | "circle" | "underDot";
  /** Paint-only legacy Word glyph effects in canonical pass order. */
  readonly glyphEffects?: readonly ("outline" | "shadow" | "emboss" | "imprint")[];
  /** Per-effect overrides applied after the inherited/full set; absent keys keep their inherited state. */
  readonly glyphEffectOverrides?: Readonly<Partial<Record<"outline" | "shadow" | "emboss" | "imprint", boolean>>>;
  /** Text decoration lines applied to the marked text. */
  readonly textDecoration?: readonly (
    "underline" | "line-through" | "double-line-through" | "overline"
  )[];
}

/** Immutable source location supplied while resolving one textblock's marks. */
export interface QuireMarkCanvasStyleContext {
  /** Textblock containing this occurrence, independent of mark object reuse. */
  readonly node: PMNode;
  /** Absolute position of the textblock's inline content. */
  readonly contentStart: number;
  /** Effective textblock typography including conditional container styling. */
  readonly inheritedStyle?: QuireNodeCanvasTextStyle | null;
  /** Layout-captured document; supplied by the mounted editor resolver. */
  readonly document?: PMNode;
}

/**
 * Resolves the canvas style delta for one mark instance.
 *
 * @param mark - Mark instance whose style should be resolved.
 * @param context - Optional immutable occurrence context for document-dependent styles.
 * @returns Canvas text style delta, or null for no contribution.
 */
export type QuireMarkCanvasStyleResolver = (mark: PMMark, context?: QuireMarkCanvasStyleContext) => QuireMarkCanvasStyle | null;

/** Maps ProseMirror mark type names to canvas style resolvers. */
export type QuireMarkCanvasStyleMap = Readonly<Record<string, QuireMarkCanvasStyleResolver>>;

/**
 * Base canvas text style a node sets for its inline content on the Canvas/SVG
 * track, before marks apply. Sizes are scales over the inherited base, so a node
 * stays independent of the absolute base font size.
 */
export interface QuireNodeCanvasTextStyle extends QuireMarkCanvasStyle {
  /** Inherited inline properties used only when no semantic style mark is present; direct marks still win. */
  readonly defaultInlineStyle?: QuireMarkCanvasStyle;
  /** Absolute CSS size overriding the node's relative font scale; direct marks still win. */
  readonly fontSize?: string;
  /** Inherited glyph color before direct run marks. */
  readonly color?: string;
  /** Inherited language for Latin shaping; direct run language overrides it. */
  readonly languageLatin?: string;
  /** Inherited East Asian language, also used to resolve emphasis placement. */
  readonly languageEastAsia?: string;
  /** Inherited language for complex-script shaping. */
  readonly languageComplexScript?: string;
  /** Inherited semantic emphasis value; none explicitly disables its ancestors. */
  readonly emphasisMark?: "none" | "dot" | "comma" | "circle" | "underDot";
  /**
   * Logical document-font role consumed by every visual backend and product
   * surface. Extensions should use `heading` for heading-like textblocks
   * instead of making consumers infer semantics from a concrete node name.
   */
  readonly documentFontRole?: "body" | "heading";
  /**
   * One-based outline level exposed to navigation surfaces. A heading-like
   * paragraph may participate in the outline without using a dedicated node
   * type; omit the field for ordinary body text.
   */
  readonly documentOutlineLevel?: number;
  /** Multiplier applied to the inherited base font size. */
  readonly fontScale?: number;
  /** Font weight applied to the node's unmarked text. */
  readonly fontWeight?: "normal" | "bold";
  /** Font style applied to the node's unmarked text. */
  readonly fontStyle?: "normal" | "italic";
  /** Font family applied to the node's text. */
  readonly fontFamily?: string;
  /** Multiplier applied to the inherited base line height; defaults to fontScale. */
  readonly lineHeightScale?: number;
}

/**
 * Resolves the base canvas text style for one node instance.
 *
 * @param node - Node instance whose base text style should be resolved.
 * @returns Base canvas text style, or null for no contribution.
 */
export type QuireNodeCanvasTextStyleResolver = (node: PMNode) => QuireNodeCanvasTextStyle | null;

/** Maps ProseMirror node type names to base canvas text style resolvers. */
export type QuireNodeCanvasTextStyleMap = Readonly<Record<string, QuireNodeCanvasTextStyleResolver>>;

/** Schema spec shape produced by QuireKit extension contributions. */
export type QuireSchemaSpec = SchemaSpec & {
  /** Node specs keyed by node name. */
  readonly nodes: Record<string, NodeSpec>;
  /** Mark specs keyed by mark name. */
  readonly marks: Record<string, MarkSpec>;
};

/** Severity assigned to extension manager diagnostics. */
export type QuireExtensionDiagnosticSeverity = "warning" | "error";

/** Context used while resolving extension options and storage. */
export interface QuireExtensionContext<Options extends object = object> {
  /** Name of the extension being resolved. */
  readonly name: string;
  /** Resolved extension options. */
  readonly options: Readonly<Options>;
}

/** Context used while resolving extension commands. */
export interface QuireExtensionCommandContext<
  Options extends object = object,
  Storage extends object = object
> extends QuireExtensionContext<Options> {
  /** Resolved storage object owned by the extension. */
  readonly storage: Storage;
}

/** `this` context exposed to Tiptap-compatible option factories. */
export interface QuireExtensionOptionsThisContext<Options extends object = object> {
  /** Name of the extension being resolved. */
  readonly name: string;
  /** Resolved parent field value for extended extensions. */
  readonly parent: unknown;
  /** Option overrides already applied to this extension. */
  readonly options: Readonly<Partial<Options>>;
}

/** `this` context exposed while creating extension storage. */
export interface QuireExtensionStorageThisContext<Options extends object = object>
  extends QuireExtensionContext<Options> {
  /** Resolved parent field value for extended extensions. */
  readonly parent: unknown;
}

/** `this` context exposed to Tiptap-compatible contribution factories. */
export interface QuireExtensionThisContext<
  Options extends object = object,
  Storage extends object = object
> extends QuireExtensionCommandContext<Options, Storage> {
  /** Resolved parent field value for extended extensions. */
  readonly parent: unknown;
  /** Editor instance available to editor-bound Tiptap factories. */
  readonly editor?: QuireEditor | undefined;
  /** Full extension list available after editor resolution. */
  readonly extensions?: readonly QuireAnyExtension[] | undefined;
}

/** Factory signature shared by extension, node, and mark decorations. */
export type QuireAddDecorationsFactory<
  Options extends object = object,
  Storage extends object = object
> = (
  this: QuireExtensionThisContext<Options, Storage>,
  context: QuireExtensionThisContext<Options, Storage>
) => DecorationSpec | null;

/**
 * Creates DOCX contributions from one resolved extension.
 *
 * @param context - Resolved extension options and storage.
 * @returns One contribution, several contributions, or no contribution.
 */
export type QuireDocxContributionFactory<
  Options extends object = object,
  Storage extends object = object
> = (
  this: QuireExtensionThisContext<Options, Storage>,
  context: QuireExtensionThisContext<Options, Storage>
) => DocxManagerContributionValue<
  QuireJSONContent,
  NonNullable<QuireJSONContent["marks"]>[number],
  QuireJSONContent
>;

/**
 * Tiptap-compatible config value that can be declared statically or resolved from
 * the extension `this` context.
 */
export type QuireConfigValue<
  Value,
  Options extends object = object,
  Storage extends object = object
> =
  | Value
  | ((
    this: QuireExtensionThisContext<Options, Storage>
  ) => Value);

/** Context passed to extension lifecycle hooks. */
export interface QuireExtensionLifecycleContext<
  Options extends object = object,
  Storage extends object = object
> {
  /** Editor instance that owns the lifecycle transition. */
  readonly editor: QuireEditor;
  /** Extension receiving the lifecycle hook. */
  readonly extension: QuireExtension<Options, Storage>;
  /** Current editor state when the lifecycle hook runs. */
  readonly state: QuireEditorState;
}

/** Context passed to extension update lifecycle hooks. */
export interface QuireExtensionUpdateContext<
  Options extends object = object,
  Storage extends object = object
> extends QuireExtensionLifecycleContext<Options, Storage> {
  /** Editor state before the update was applied. */
  readonly previousState: QuireEditorState;
  /** Primary transaction that caused the update, when the update came from dispatch. */
  readonly transaction?: Transaction | undefined;
  /** Transactions appended by ProseMirror plugins while applying the primary transaction. */
  readonly appendedTransactions: readonly Transaction[];
}

/**
 * Runs before extension `onCreate` hooks when an editor is being created.
 *
 * @param context - Lifecycle context for the extension and editor.
 */
export type QuireExtensionBeforeCreateHook<
  Options extends object = object,
  Storage extends object = object
> = (
  this: QuireExtensionThisContext<Options, Storage>,
  context: QuireExtensionLifecycleContext<Options, Storage>
) => void;

/**
 * Runs when an extension is attached to a newly created editor.
 *
 * @param context - Lifecycle context for the extension and editor.
 */
export type QuireExtensionCreateHook<
  Options extends object = object,
  Storage extends object = object
> = (
  this: QuireExtensionThisContext<Options, Storage>,
  context: QuireExtensionLifecycleContext<Options, Storage>
) => void;

/**
 * Runs after an editor state update is applied.
 *
 * @param context - Update lifecycle context with previous and current state.
 */
export type QuireExtensionUpdateHook<
  Options extends object = object,
  Storage extends object = object
> = (
  this: QuireExtensionThisContext<Options, Storage>,
  context: QuireExtensionUpdateContext<Options, Storage>
) => void;

/**
 * Runs when the editor is destroyed.
 *
 * @param context - Lifecycle context for the extension and editor.
 */
export type QuireExtensionDestroyHook<
  Options extends object = object,
  Storage extends object = object
> = (
  this: QuireExtensionThisContext<Options, Storage>,
  context: QuireExtensionLifecycleContext<Options, Storage>
) => void;

/** Continues a dispatchTransaction hook chain. */
export type QuireDispatchTransactionNext = (transaction: Transaction) => void;

/** Props passed to an extension dispatchTransaction hook. */
export interface DispatchTransactionProps {
  /** Transaction being dispatched. */
  transaction: Transaction;
  /** Calls the next hook, or core dispatch when this is the last hook. */
  next: QuireDispatchTransactionNext;
}

/** Immutable QuireKit dispatchTransaction hook props. */
export interface QuireDispatchTransactionProps extends DispatchTransactionProps {
  /** Transaction being dispatched. */
  readonly transaction: Transaction;
  /** Calls the next hook, or core dispatch when this is the last hook. */
  readonly next: QuireDispatchTransactionNext;
}

/** Tiptap-compatible `this` context exposed to runtime extension hooks. */
export interface QuireExtensionRuntimeThisContext<
  Options extends object = object,
  Storage extends object = object
> {
  /** Name of the extension receiving the hook. */
  readonly name: string;
  /** Resolved extension options. */
  readonly options: Readonly<Options>;
  /** Resolved extension storage. */
  readonly storage: Storage;
  /** Editor instance dispatching the transaction. */
  readonly editor: QuireEditor;
  /** Resolved parent field value for extended extensions. */
  readonly parent: unknown;
}

/** Backward-compatible alias for dispatchTransaction hook context. */
export type QuireDispatchTransactionThisContext<
  Options extends object = object,
  Storage extends object = object
> = QuireExtensionRuntimeThisContext<Options, Storage>;

/**
 * Runs when the editor receives focus.
 *
 * @param event - Focus event payload emitted by the editor.
 */
export type QuireExtensionFocusHook<
  Options extends object = object,
  Storage extends object = object
> = (
  this: QuireExtensionRuntimeThisContext<Options, Storage>,
  event: QuireEditorFocusEvent
) => void;

/**
 * Runs when the editor loses focus.
 *
 * @param event - Blur event payload emitted by the editor.
 */
export type QuireExtensionBlurHook<
  Options extends object = object,
  Storage extends object = object
> = (
  this: QuireExtensionRuntimeThisContext<Options, Storage>,
  event: QuireEditorBlurEvent
) => void;

/**
 * Intercepts transactions before the editor applies them.
 *
 * @param props - Transaction and next dispatcher for the hook chain.
 */
export type QuireExtensionDispatchTransactionHook<
  Options extends object = object,
  Storage extends object = object
> = (
  this: QuireDispatchTransactionThisContext<Options, Storage>,
  props: QuireDispatchTransactionProps
) => void;

/**
 * Transforms pasted HTML before it is parsed into editor content.
 *
 * @param html - HTML string to transform.
 * @param view - Optional mounted view that initiated the paste.
 * @returns Transformed HTML string.
 */
export type QuireTransformPastedHTMLHook<
  Options extends object = object,
  Storage extends object = object
> = (
  this: QuireExtensionRuntimeThisContext<Options, Storage>,
  html: string,
  view?: unknown
) => string;

/**
 * Adds schema fields to a node extension while the editor schema is being built.
 *
 * @param extension - Node extension whose ProseMirror schema spec is being built.
 * @returns Extra node spec fields, or nullish when no fields should be added.
 */
export type QuireExtendNodeSchemaHook<
  Options extends object = object,
  Storage extends object = object
> = (
  this: QuireExtensionThisContext<Options, Storage>,
  extension: QuireAnyExtension
) => Partial<NodeSpec> | null | undefined;

/**
 * Adds schema fields to a mark extension while the editor schema is being built.
 *
 * @param extension - Mark extension whose ProseMirror schema spec is being built.
 * @returns Extra mark spec fields, or nullish when no fields should be added.
 */
export type QuireExtendMarkSchemaHook<
  Options extends object = object,
  Storage extends object = object
> = (
  this: QuireExtensionThisContext<Options, Storage>,
  extension: QuireAnyExtension
) => Partial<MarkSpec> | null | undefined;

/** Schema type selector accepted by Tiptap-compatible global attributes. */
export type QuireSchemaAttributeTypes = readonly string[] | "*" | "nodes" | "marks";

/** Describes attributes that should be merged into existing schema items. */
export interface QuireSchemaAttributeContribution {
  /** Node or mark type names, or a shorthand group, that should receive these attributes. */
  readonly types: QuireSchemaAttributeTypes;
  /** Attribute specs to merge into each matching node or mark type. */
  readonly attributes: QuireSchemaAttributeMap;
}

/** Defines a Tiptap-compatible behavior extension before resolution. */
export interface QuireExtensionConfig<
  Options extends object = object,
  Storage extends object = object
> extends QuireMarkdownConfigFields {
  /** Unique extension name used for ordering, debugging, and command ownership. */
  readonly name: string;
  /** Higher priority extensions run their commands before lower priority extensions. */
  readonly priority?: number;
  /**
   * Orders only keyboard shortcut handlers without changing the extension's
   * schema, command, plugin, or lifecycle order.
   */
  readonly keyboardShortcutPriority?: number;
  /** Lifecycle hook called before extension create hooks run. */
  readonly onBeforeCreate?: QuireExtensionBeforeCreateHook<Options, Storage>;
  /** Lifecycle hook called after the editor is created. */
  readonly onCreate?: QuireExtensionCreateHook<Options, Storage>;
  /** Lifecycle hook called after the editor state changes. */
  readonly onUpdate?: QuireExtensionUpdateHook<Options, Storage>;
  /** Lifecycle hook called when the editor is destroyed. */
  readonly onDestroy?: QuireExtensionDestroyHook<Options, Storage>;
  /** Lifecycle hook called when the editor receives focus. */
  readonly onFocus?: QuireExtensionFocusHook<Options, Storage>;
  /** Lifecycle hook called when the editor loses focus. */
  readonly onBlur?: QuireExtensionBlurHook<Options, Storage>;
  /** Hook that can intercept transactions before core applies them. */
  readonly dispatchTransaction?: QuireExtensionDispatchTransactionHook<
    Options,
    Storage
  >;
  /** Hook that transforms pasted HTML before parsing. */
  readonly transformPastedHTML?: QuireTransformPastedHTMLHook<Options, Storage>;
  /** Hook that adds schema fields to node extensions. */
  readonly extendNodeSchema?: QuireExtendNodeSchemaHook<Options, Storage>;
  /** Hook that adds schema fields to mark extensions. */
  readonly extendMarkSchema?: QuireExtendMarkSchemaHook<Options, Storage>;
  /**
   * Creates model-neutral DOCX contributions owned by this extension.
   *
   * @returns DOCX codecs, feature compilers, or package passes.
   */
  readonly addDocx?: QuireDocxContributionFactory<Options, Storage>;
  /**
   * Creates renderer-neutral layout-provider registrations.
   *
   * @returns Provider registrations owned by the extension.
   */
  readonly addLayoutProviders?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireExtensionThisContext<Options, Storage>
  ) => readonly QuireLayoutProviderRegistration[];
  /**
   * Creates document-profile registrations that supply document-model
   * semantics to a layout engine.
   *
   * @returns Profile registrations owned by the extension.
   */
  readonly addDocumentProfiles?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireExtensionThisContext<Options, Storage>
  ) => readonly QuireDocumentProfileRegistration[];
  /**
   * Creates high-level structured-range selection contributions.
   *
   * Use `selectionPreset.*` for common behavior. Infrastructure packages that
   * introduce a new crossing model may use `addSelectionAdapters()` instead.
   *
   * @returns Selection contributions owned by the extension.
   */
  readonly addSelection?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireExtensionThisContext<Options, Storage>
  ) => readonly QuireSelectionContribution[];
  /**
   * Creates renderer-neutral structured-range selection adapter registrations.
   *
   * @returns Selection adapter registrations owned by the extension.
   */
  readonly addSelectionAdapters?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireExtensionThisContext<Options, Storage>
  ) => readonly QuireSelectionAdapterRegistration[];
  /** Static qkView event handlers contributed by this extension. */
  readonly viewEventHandlers?: QuireExtensionViewEventHandlerMap;
  /**
   * Creates the default option object for this extension.
   *
   * @returns Default options used before caller-provided overrides are merged.
   */
  readonly addOptions?: (
    this: QuireExtensionOptionsThisContext<Options>
  ) => Options;
  /**
   * Creates the storage object owned by this extension.
   *
   * @returns Storage object owned by this extension.
   */
  readonly addStorage?: (
    this: QuireExtensionStorageThisContext<Options>
  ) => Storage;
  /**
   * Creates named commands from the resolved options and storage.
   *
   * @returns Command handlers keyed by command name.
   */
  readonly addCommands?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => AnyCommands;
  /**
   * Creates keyboard shortcuts from the resolved options and storage.
   *
   * @returns Shortcut handlers keyed by ProseMirror keymap shortcut name.
   */
  readonly addKeyboardShortcuts?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => QuireKeyboardShortcutMap;
  /**
   * Creates input rules from the resolved options and storage.
   *
   * @returns Input rules contributed by the extension.
   */
  readonly addInputRules?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => QuireInputRuleList;
  /**
   * Creates paste rules from the resolved options and storage.
   *
   * @returns Paste rules contributed by the extension.
   */
  readonly addPasteRules?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => QuirePasteRuleList;
  /**
   * Creates ProseMirror plugins from the resolved options and storage.
   *
   * @returns ProseMirror plugins contributed by the extension.
   */
  readonly addProseMirrorPlugins?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => QuirePluginList;
  /**
   * Creates declarative node, inline, and widget decorations.
   *
   * @returns Decoration policy and factories, or null when disabled.
   */
  readonly addDecorations?: QuireAddDecorationsFactory<Options, Storage>;
  /**
   * Creates mounted view adapters from the resolved options and storage.
   *
   * @returns Mounted view adapters contributed by the extension.
   */
  readonly addViewAdapters?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => readonly QuireViewAdapter[];
  /**
   * Creates named qkView event handlers from the resolved options and storage.
   *
   * @returns qkView event handlers keyed by handler id.
   */
  readonly addViewEventHandlers?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => QuireExtensionViewEventHandlerMap;
  /**
   * Creates child extensions bundled by this extension.
   *
   * @returns Child extensions that should be installed with this extension.
   */
  readonly addExtensions?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => readonly QuireAnyExtension[];
  /**
   * Creates the optional top node name contributed by this extension.
   *
   * @returns Top node name for the schema, or undefined.
   */
  readonly addTopNodeName?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => string | undefined;
  /**
   * Creates global attribute contributions for existing node or mark types.
   *
   * @returns Attribute contributions to merge into matching node or mark types.
   */
  readonly addGlobalAttributes?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => readonly QuireSchemaAttributeContribution[];
  /**
   * Creates base Canvas/SVG text-style resolvers for existing node types.
   *
   * Behavior extensions use this hook when a global attribute, rather than a
   * dedicated node type, controls the effective textblock style.
   *
   * @returns Style resolvers keyed by existing node type name.
   */
  readonly addNodeCanvasTextStyles?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => QuireNodeCanvasTextStyleMap;
  /**
   * Creates transforms for the default HTML serialization of existing nodes.
   *
   * Behavior extensions use this hook to project canonical document metadata
   * into semantic HTML without introducing a second stored node type.
   *
   * @returns HTML serialization transforms keyed by existing node type name.
   */
  readonly addNodeHTMLSerializationTransforms?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => QuireNodeHTMLSerializationTransformMap;
  /**
   * Creates transforms for the default Markdown serialization of existing nodes.
   *
   * @returns Markdown serialization transforms keyed by existing node type name.
   */
  readonly addNodeMarkdownSerializationTransforms?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => QuireNodeMarkdownSerializationTransformMap;
}

/** Internal extension spec after QuireKit-specific contributions are lowered. */
export interface QuireExtensionSpec<
  Options extends object = object,
  Storage extends object = object
> {
  /** Unique extension name used for ordering, debugging, and command ownership. */
  readonly name: string;
  /** Authoring family used to create this extension. */
  readonly kind?: QuireExtensionKind;
  /** Higher priority extensions run their commands before lower priority extensions. */
  readonly priority?: number;
  /**
   * Orders only keyboard shortcut handlers without changing the extension's
   * other contribution order.
   */
  readonly keyboardShortcutPriority?: number;
  /** Optional ProseMirror top node name contributed by this extension. */
  readonly topNodeName?: string;
  /** Internal lowered command map contributed by this extension. */
  readonly commands?: AnyCommands;
  /** Internal lowered keyboard shortcuts contributed by this extension. */
  readonly keyboardShortcuts?: QuireKeyboardShortcutMap;
  /** Internal lowered input rules contributed by this extension. */
  readonly inputRules?: QuireInputRuleList;
  /** Internal lowered paste rules contributed by this extension. */
  readonly pasteRules?: QuirePasteRuleList;
  /** Internal lowered node specs contributed by this extension. */
  readonly nodes?: QuireNodeSpecMap;
  /** Internal lowered mark specs contributed by this extension. */
  readonly marks?: QuireMarkSpecMap;
  /** Internal lowered ProseMirror plugins contributed by this extension. */
  readonly plugins?: QuirePluginList;
  /** Internal lowered layout-provider registrations. */
  readonly layoutProviders?: readonly QuireLayoutProviderEntry[];
  /** Internal lowered document-profile registrations. */
  readonly documentProfiles?: readonly QuireDocumentProfileEntry[];
  /** Internal lowered structured-range selection adapter registrations. */
  readonly selectionAdapters?: readonly QuireSelectionAdapterEntry[];
  /** Internal lowered mounted view adapters contributed by this extension. */
  readonly viewAdapters?: readonly QuireViewAdapter[];
  /** Internal lowered qkView event handlers contributed by this extension. */
  readonly viewEventHandlers?: QuireExtensionViewEventHandlerMap;
  /** Internal lowered child extensions bundled by this extension. */
  readonly extensions?: readonly QuireAnyExtension[];
  /** Lifecycle hook called before extension create hooks run. */
  readonly onBeforeCreate?: QuireExtensionBeforeCreateHook<Options, Storage>;
  /** Lifecycle hook called after the editor is created. */
  readonly onCreate?: QuireExtensionCreateHook<Options, Storage>;
  /** Lifecycle hook called after the editor state changes. */
  readonly onUpdate?: QuireExtensionUpdateHook<Options, Storage>;
  /** Lifecycle hook called when the editor is destroyed. */
  readonly onDestroy?: QuireExtensionDestroyHook<Options, Storage>;
  /** Lifecycle hook called when the editor receives focus. */
  readonly onFocus?: QuireExtensionFocusHook<Options, Storage>;
  /** Lifecycle hook called when the editor loses focus. */
  readonly onBlur?: QuireExtensionBlurHook<Options, Storage>;
  /** Hook that can intercept transactions before core applies them. */
  readonly dispatchTransaction?: QuireExtensionDispatchTransactionHook<
    Options,
    Storage
  >;
  /** Hook that transforms pasted HTML before parsing. */
  readonly transformPastedHTML?: QuireTransformPastedHTMLHook<Options, Storage>;
  /** Hook that adds schema fields to node extensions. */
  readonly extendNodeSchema?: QuireExtendNodeSchemaHook<Options, Storage>;
  /** Hook that adds schema fields to mark extensions. */
  readonly extendMarkSchema?: QuireExtendMarkSchemaHook<Options, Storage>;
  /**
   * Creates the default option object for this extension.
   *
   * @returns Default options used before caller-provided overrides are merged.
   */
  readonly addOptions?: (
    this: QuireExtensionOptionsThisContext<Options>,
    context: QuireExtensionOptionsThisContext<Options>
  ) => Options;
  /**
   * Creates the storage object owned by this extension.
   *
   * @param context - Extension context containing the extension name and
   * resolved options.
   * @returns Storage object owned by this extension.
   */
  readonly addStorage?: (
    this: QuireExtensionStorageThisContext<Options>,
    context: QuireExtensionContext<Options>
  ) => Storage;
  /**
   * Creates named commands from the resolved options and storage.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Command handlers keyed by command name.
   */
  readonly addCommands?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireExtensionThisContext<Options, Storage>
  ) => AnyCommands;
  /**
   * Creates keyboard shortcuts from the resolved options and storage.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Shortcut handlers keyed by ProseMirror keymap shortcut name.
   */
  readonly addKeyboardShortcuts?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireExtensionThisContext<Options, Storage>
  ) => QuireKeyboardShortcutMap;
  /**
   * Creates input rules from the resolved options and storage.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Input rules contributed by the extension.
   */
  readonly addInputRules?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireExtensionThisContext<Options, Storage>
  ) => QuireInputRuleList;
  /**
   * Creates paste rules from the resolved options and storage.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Paste rules contributed by the extension.
   */
  readonly addPasteRules?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireExtensionThisContext<Options, Storage>
  ) => QuirePasteRuleList;
  /**
   * Creates node specs from the resolved options and storage.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Node specs keyed by node name.
   */
  readonly addNodes?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireExtensionThisContext<Options, Storage>
  ) => QuireNodeSpecMap;
  /**
   * Creates mark specs from the resolved options and storage.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Mark specs keyed by mark name.
   */
  readonly addMarks?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireExtensionThisContext<Options, Storage>
  ) => QuireMarkSpecMap;
  /**
   * Creates ProseMirror plugins from the resolved options and storage.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns ProseMirror plugins contributed by the extension.
   */
  readonly addProseMirrorPlugins?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireExtensionThisContext<Options, Storage>
  ) => QuirePluginList;
  /**
   * Creates declarative node, inline, and widget decorations.
   *
   * @returns Decoration policy and factories, or null when disabled.
   */
  readonly addDecorations?: QuireAddDecorationsFactory<Options, Storage>;
  /**
   * Creates mounted view adapters from the resolved options and storage.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Mounted view adapters contributed by the extension.
   */
  readonly addViewAdapters?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireExtensionThisContext<Options, Storage>
  ) => readonly QuireViewAdapter[];
  /**
   * Creates named qkView event handlers from the resolved options and storage.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns qkView event handlers keyed by handler id.
   */
  readonly addViewEventHandlers?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireExtensionThisContext<Options, Storage>
  ) => QuireExtensionViewEventHandlerMap;
  /**
   * Creates child extensions bundled by this extension.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Child extensions that should be installed with this extension.
   */
  readonly addExtensions?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireExtensionThisContext<Options, Storage>
  ) => readonly QuireAnyExtension[];
  /**
   * Creates the optional top node name contributed by this extension.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Top node name for the schema, or undefined.
   */
  readonly addTopNodeName?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireExtensionThisContext<Options, Storage>
  ) => string | undefined;
  /**
   * Creates attribute contributions for existing node or mark types.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Attribute contributions to merge into matching node or mark types.
   */
  readonly addAttributes?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireExtensionThisContext<Options, Storage>
  ) => readonly QuireSchemaAttributeContribution[];
  /**
   * Creates global attribute contributions for existing node or mark types.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Attribute contributions to merge into matching node or mark types.
   */
  readonly addGlobalAttributes?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireExtensionThisContext<Options, Storage>
  ) => readonly QuireSchemaAttributeContribution[];
}

/** Context passed to a node renderHTML callback. */
export interface QuireNodeRenderHTMLContext<
  Options extends object = object,
  Storage extends object = object
> extends QuireExtensionCommandContext<Options, Storage> {
  /** ProseMirror node being serialized. */
  readonly node: PMNode;
  /** Resolved HTML attributes for the node. */
  readonly HTMLAttributes: QuireHTMLAttributes;
}

/** Context passed to a node renderText callback. */
export interface QuireNodeRenderTextContext<
  Options extends object = object,
  Storage extends object = object
> extends QuireExtensionCommandContext<Options, Storage>, QuireTextSerializerContext {}

/** Context passed to a mark renderHTML callback. */
export interface QuireMarkRenderHTMLContext<
  Options extends object = object,
  Storage extends object = object
> extends QuireExtensionCommandContext<Options, Storage> {
  /** ProseMirror mark being serialized. */
  readonly mark: PMMark;
  /** Resolved HTML attributes for the mark. */
  readonly HTMLAttributes: QuireHTMLAttributes;
}

/**
 * Resolves a node view position in the current editor state.
 *
 * @returns Current document position of the node view, or undefined when the
 * node is no longer mounted.
 */
export type QuireNodeViewGetPos = () => number | undefined;

/** Props passed to a Tiptap-compatible DOM node view renderer. */
export interface NodeViewRendererProps {
  /** ProseMirror node represented by the DOM node view. */
  node: Parameters<PMNodeViewConstructor>[0];
  /** ProseMirror DOM editor view that owns the node view. */
  view: Parameters<PMNodeViewConstructor>[1];
  /** Resolves the node's current document position. */
  getPos: Parameters<PMNodeViewConstructor>[2];
  /** Decorations active around the node. */
  decorations: Parameters<PMNodeViewConstructor>[3];
  /** Decorations active inside the node content. */
  innerDecorations: Parameters<PMNodeViewConstructor>[4];
  /** Editor instance that owns the view. */
  editor: QuireEditor;
  /** Node extension that contributed the renderer. */
  extension: QuireNodeExtension;
  /** HTML attributes resolved for the node. */
  HTMLAttributes: Record<string, any>;
}

/** Reactive props exposed by Tiptap-compatible framework node views. */
export interface NodeViewProps extends NodeViewRendererProps {
  /** Decorations with their ProseMirror decoration type exposed. */
  decorations: readonly DecorationWithType[];
  /** Whether the node view is selected. */
  selected: boolean;
  /** Updates the represented node attributes. */
  updateAttributes: (attributes: Record<string, any>) => void;
  /** Deletes the represented node. */
  deleteNode: () => void;
}

/** Framework integration options for Tiptap-compatible DOM node views. */
export interface NodeViewRendererOptions {
  /** Determines whether the node view stops a DOM event. */
  stopEvent: ((props: { event: Event }) => boolean) | null;
  /** Determines whether the node view ignores a DOM mutation. */
  ignoreMutation: ((props: { mutation: PMViewMutationRecord }) => boolean) | null;
  /** Tag used for the framework-managed content DOM element. */
  contentDOMElementTag: string;
  /** Whether a text selection contained by the node also selects the node view. */
  selectedOnTextSelection?: boolean | undefined;
  /** Whether position shifts trigger framework view rerenders. */
  trackNodeViewPosition?: boolean | undefined;
}

/**
 * Creates a Tiptap-compatible ProseMirror DOM node view.
 *
 * @param props - Node, DOM view, editor, extension, and rendered attributes.
 * @returns ProseMirror DOM node view.
 */
export type NodeViewRenderer = (props: NodeViewRendererProps) => PMNodeView;

/** Props passed to a Tiptap-compatible DOM mark view renderer. */
export interface MarkViewRendererProps {
  /** ProseMirror mark represented by the DOM mark view. */
  mark: Parameters<PMMarkViewConstructor>[0];
  /** ProseMirror DOM editor view that owns the mark view. */
  view: Parameters<PMMarkViewConstructor>[1];
  /** Whether the mark view appears in inline content. */
  inline: Parameters<PMMarkViewConstructor>[2];
  /** Editor instance that owns the view. */
  editor: QuireEditor;
  /** Mark extension that contributed the renderer. */
  extension: QuireMarkExtension;
  /** HTML attributes resolved for the mark. */
  HTMLAttributes: Record<string, any>;
  /** Updates the represented mark attributes. */
  updateAttributes: (attrs: Record<string, any>) => void;
}

/** Reactive props exposed by Tiptap-compatible framework mark views. */
export interface MarkViewProps extends MarkViewRendererProps {}

/**
 * Creates a Tiptap-compatible ProseMirror DOM mark view.
 *
 * @param props - Mark, DOM view, editor, extension, and rendered attributes.
 * @returns ProseMirror DOM mark view.
 */
export type MarkViewRenderer<
  Props = MarkViewRendererProps
> = (props: Props) => PMMarkView;

/** Framework integration options for Tiptap-compatible DOM mark views. */
export interface MarkViewRendererOptions {
  /** Determines whether the mark view ignores a DOM mutation. */
  ignoreMutation: ((props: { mutation: PMViewMutationRecord }) => boolean) | null;
}

/**
 * Renderer-neutral node view constructor consumed by mounted QuireKit views.
 *
 * @param node - ProseMirror node represented by the view.
 * @param view - Mounted editor view that owns the node view.
 * @param getPos - Function that resolves the current node position.
 * @param decorations - Decorations active on the node.
 * @param innerDecorations - Decorations active inside the node content.
 * @returns Renderer-specific node view instance.
 */
export type QuireNodeViewConstructor = (
  node: PMNode,
  view: QuireMountedEditorView,
  getPos: QuireNodeViewGetPos,
  decorations: readonly Decoration[],
  innerDecorations: DecorationSource
) => unknown;

/** Maps node names to renderer-neutral node view constructors. */
export type QuireNodeViewMap = Readonly<Record<string, QuireNodeViewConstructor>>;

/** Props passed to a renderer-neutral node view renderer. */
export interface QuireNodeViewRendererProps {
  /** ProseMirror node represented by the node view. */
  readonly node: PMNode;
  /** Mounted editor view that owns the node view. */
  readonly view: QuireMountedEditorView;
  /** Function that resolves the current node position. */
  readonly getPos: QuireNodeViewGetPos;
  /** Decorations active on the node. */
  readonly decorations: readonly Decoration[];
  /** Decorations active inside the node content. */
  readonly innerDecorations: DecorationSource;
  /** Editor instance that owns the mounted view. */
  readonly editor: QuireEditor;
  /** Extension that contributed this node view renderer. */
  readonly extension: QuireAnyExtension;
  /** Resolved rendered HTML attributes for the node. */
  readonly HTMLAttributes: Record<string, unknown>;
}

/** Tiptap-compatible alias passed to node view renderers. */
export interface QuireNodeViewProps extends QuireNodeViewRendererProps {}

/** DOM mutation or selection change record observed by a mounted node or mark view. */
export type QuireViewMutationRecord =
  | MutationRecord
  | {
    /** Selection mutation discriminator used by ProseMirror-style views. */
    readonly type: "selection";
    /** Node that owns the selection mutation. */
    readonly target: globalThis.Node;
  };

/** Props passed to node and mark view stopEvent callbacks. */
export interface QuireViewStopEventProps {
  /** DOM event being tested. */
  readonly event: Event;
}

/** Props passed to node and mark view ignoreMutation callbacks. */
export interface QuireViewIgnoreMutationProps {
  /** DOM mutation or selection change to test. */
  readonly mutation: QuireViewMutationRecord;
}

/** Optional node view renderer options reserved for framework integrations. */
export interface QuireNodeViewRendererOptions {
  /** Function used by framework integrations to stop handling selected events. */
  readonly stopEvent?: ((props: QuireViewStopEventProps) => boolean) | null | undefined;
  /** Function used by framework integrations to ignore selected DOM mutations. */
  readonly ignoreMutation?: ((props: QuireViewIgnoreMutationProps) => boolean) | null | undefined;
  /** Tag used for a framework-managed HTML content DOM element. */
  readonly contentDOMElementTag?: string | undefined;
  /** Whether contained text selections also select the framework node view. */
  readonly selectedOnTextSelection?: boolean | undefined;
  /** Whether position changes should rerender framework node views. */
  readonly trackNodeViewPosition?: boolean | undefined;
}

/**
 * Creates a renderer-specific node view instance.
 *
 * @param props - Node, editor, view, decorations, and rendered attributes.
 * @returns Renderer-specific node view instance.
 */
export type QuireNodeViewRenderer = (
  props: QuireNodeViewRendererProps
) => unknown;

/**
 * Renderer-neutral mark view constructor consumed by mounted QuireKit views.
 *
 * @param mark - ProseMirror mark represented by the view.
 * @param view - Mounted editor view that owns the mark view.
 * @param inline - Whether the mark view appears in inline content.
 * @returns Renderer-specific mark view instance.
 */
export type QuireMarkViewConstructor = (
  mark: PMMark,
  view: QuireMountedEditorView,
  inline: boolean
) => unknown;

/** Maps mark names to renderer-neutral mark view constructors. */
export type QuireMarkViewMap = Readonly<Record<string, QuireMarkViewConstructor>>;

/** Props passed to a renderer-neutral mark view renderer. */
export interface QuireMarkViewRendererProps {
  /** ProseMirror mark represented by the mark view. */
  readonly mark: PMMark;
  /** Mounted editor view that owns the mark view. */
  readonly view: QuireMountedEditorView;
  /** Whether the mark view appears in inline content. */
  readonly inline: boolean;
  /** Editor instance that owns the mounted view. */
  readonly editor: QuireEditor;
  /** Extension that contributed this mark view renderer. */
  readonly extension: QuireAnyExtension;
  /** Resolved rendered HTML attributes for the mark. */
  readonly HTMLAttributes: Record<string, unknown>;
  /**
   * Updates attributes for the represented mark through editor commands.
   *
   * @param attrs - Partial attributes to merge into the mark.
   */
  readonly updateAttributes: (attrs: Record<string, unknown>) => void;
}

/** Tiptap-compatible alias passed to mark view renderers. */
export interface QuireMarkViewProps extends QuireMarkViewRendererProps {}

/** Optional mark view renderer options reserved for framework integrations. */
export interface QuireMarkViewRendererOptions {
  /** Function used by framework integrations to stop handling selected events. */
  readonly stopEvent?: ((props: QuireViewStopEventProps) => boolean) | null | undefined;
  /** Function used by framework integrations to ignore selected DOM mutations. */
  readonly ignoreMutation?: ((props: QuireViewIgnoreMutationProps) => boolean) | null | undefined;
}

/**
 * Creates a renderer-specific mark view instance.
 *
 * @param props - Mark, editor, view, inline flag, and rendered attributes.
 * @returns Renderer-specific mark view instance.
 */
export type QuireMarkViewRenderer = (
  props: QuireMarkViewRendererProps
) => unknown;

/** Defines a Tiptap-compatible node extension before resolution. */
export interface QuireNodeConfig<
  Options extends object = object,
  Storage extends object = object
> extends QuireMarkdownConfigFields {
  /** ProseMirror node type name contributed by this extension. */
  readonly name: string;
  /** Higher priority extensions run their commands before lower priority extensions. */
  readonly priority?: number;
  /**
   * Orders only keyboard shortcut handlers without changing the extension's
   * schema, command, plugin, or lifecycle order.
   */
  readonly keyboardShortcutPriority?: number;
  /**
   * Declares the base canvas text style for this node's inline content.
   *
   * @param node - Node instance whose base text style should be resolved.
   * @returns Base canvas text style delta, or null for no contribution.
   */
  readonly canvasTextStyle?: QuireNodeCanvasTextStyleResolver;
  /** Hook that can intercept transactions before core applies them. */
  readonly dispatchTransaction?: QuireExtensionDispatchTransactionHook<
    Options,
    Storage
  >;
  /** Hook that transforms pasted HTML before parsing. */
  readonly transformPastedHTML?: QuireTransformPastedHTMLHook<Options, Storage>;
  /** Hook that adds schema fields to node extensions. */
  readonly extendNodeSchema?: QuireExtendNodeSchemaHook<Options, Storage>;
  /** Hook that adds schema fields to mark extensions. */
  readonly extendMarkSchema?: QuireExtendMarkSchemaHook<Options, Storage>;
  /**
   * Creates model-neutral DOCX contributions owned by this node extension.
   *
   * @returns DOCX codecs, feature compilers, or package passes.
   */
  readonly addDocx?: QuireDocxContributionFactory<Options, Storage>;
  /**
   * Creates renderer-neutral layout-provider registrations.
   *
   * @returns Provider registrations owned by the node extension.
   */
  readonly addLayoutProviders?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireExtensionThisContext<Options, Storage>
  ) => readonly QuireLayoutProviderRegistration[];
  /**
   * Creates document-profile registrations that supply document-model
   * semantics to a layout engine.
   *
   * @returns Profile registrations owned by the extension.
   */
  readonly addDocumentProfiles?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireExtensionThisContext<Options, Storage>
  ) => readonly QuireDocumentProfileRegistration[];
  /**
   * Creates high-level structured-range selection contributions.
   *
   * Use `selectionPreset.*` for common behavior. Infrastructure packages that
   * introduce a new crossing model may use `addSelectionAdapters()` instead.
   *
   * @returns Selection contributions owned by the node extension.
   */
  readonly addSelection?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireExtensionThisContext<Options, Storage>
  ) => readonly QuireSelectionContribution[];
  /**
   * Creates renderer-neutral structured-range selection adapter registrations.
   *
   * @returns Selection adapter registrations owned by the node extension.
   */
  readonly addSelectionAdapters?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireExtensionThisContext<Options, Storage>
  ) => readonly QuireSelectionAdapterRegistration[];
  /** Static qkView event handlers contributed by this node extension. */
  readonly viewEventHandlers?: QuireExtensionViewEventHandlerMap;
  /** Whether this node should become the schema top node. */
  readonly topNode?: QuireConfigValue<boolean, Options, Storage>;
  /** Content expression for this node. */
  readonly content?: QuireConfigValue<NodeSpec["content"], Options, Storage>;
  /** Mark expression for content inside this node. */
  readonly marks?: QuireConfigValue<NodeSpec["marks"], Options, Storage>;
  /** Schema group or groups this node belongs to. */
  readonly group?: QuireConfigValue<NodeSpec["group"], Options, Storage>;
  /** Whether this node is inline. */
  readonly inline?: QuireConfigValue<NodeSpec["inline"], Options, Storage>;
  /** Whether this node should be treated as an atom. */
  readonly atom?: QuireConfigValue<NodeSpec["atom"], Options, Storage>;
  /** Whether this node can be selected as a node selection. */
  readonly selectable?: QuireConfigValue<NodeSpec["selectable"], Options, Storage>;
  /** Whether this node can be dragged without being selected. */
  readonly draggable?: QuireConfigValue<NodeSpec["draggable"], Options, Storage>;
  /** Whether this node contains code content. */
  readonly code?: QuireConfigValue<NodeSpec["code"], Options, Storage>;
  /** Whitespace parsing mode for this node. */
  readonly whitespace?: QuireConfigValue<NodeSpec["whitespace"], Options, Storage>;
  /** Whether this inline leaf node is the schema linebreak replacement. */
  readonly linebreakReplacement?: QuireConfigValue<
    NodeSpec["linebreakReplacement"],
    Options,
    Storage
  >;
  /** Whether this node is defining during replace operations. */
  readonly defining?: QuireConfigValue<NodeSpec["defining"], Options, Storage>;
  /** Whether this node is defining as replacement context. */
  readonly definingAsContext?: QuireConfigValue<
    NodeSpec["definingAsContext"],
    Options,
    Storage
  >;
  /** Whether defining parents in inserted content should be preserved. */
  readonly definingForContent?: QuireConfigValue<
    NodeSpec["definingForContent"],
    Options,
    Storage
  >;
  /** Whether this node isolates regular editing operations. */
  readonly isolating?: QuireConfigValue<NodeSpec["isolating"], Options, Storage>;
  /** Lifecycle hook called before extension create hooks run. */
  readonly onBeforeCreate?: QuireExtensionBeforeCreateHook<Options, Storage>;
  /** Lifecycle hook called after the editor is created. */
  readonly onCreate?: QuireExtensionCreateHook<Options, Storage>;
  /** Lifecycle hook called after the editor state changes. */
  readonly onUpdate?: QuireExtensionUpdateHook<Options, Storage>;
  /** Lifecycle hook called when the editor is destroyed. */
  readonly onDestroy?: QuireExtensionDestroyHook<Options, Storage>;
  /** Lifecycle hook called when the editor receives focus. */
  readonly onFocus?: QuireExtensionFocusHook<Options, Storage>;
  /** Lifecycle hook called when the editor loses focus. */
  readonly onBlur?: QuireExtensionBlurHook<Options, Storage>;
  /**
   * Creates the default option object for this extension.
   *
   * @returns Default options used before caller-provided overrides are merged.
   */
  readonly addOptions?: (
    this: QuireExtensionOptionsThisContext<Options>
  ) => Options;
  /**
   * Creates the storage object owned by this extension.
   *
   * @param context - Extension context containing the extension name and
   * resolved options.
   * @returns Storage object owned by this extension.
   */
  readonly addStorage?: (
    this: QuireExtensionStorageThisContext<Options>
  ) => Storage;
  /**
   * Creates named commands from the resolved options and storage.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Command handlers keyed by command name.
   */
  readonly addCommands?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => AnyCommands;
  /**
   * Creates keyboard shortcuts from the resolved options and storage.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Shortcut handlers keyed by ProseMirror keymap shortcut name.
   */
  readonly addKeyboardShortcuts?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => QuireKeyboardShortcutMap;
  /**
   * Creates input rules from the resolved options and storage.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Input rules contributed by the extension.
   */
  readonly addInputRules?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => QuireInputRuleList;
  /**
   * Creates paste rules from the resolved options and storage.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Paste rules contributed by the extension.
   */
  readonly addPasteRules?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => QuirePasteRuleList;
  /**
   * Creates child extensions bundled by this node extension.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Child extensions that should be installed with this extension.
   */
  readonly addExtensions?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => readonly QuireAnyExtension[];
  /**
   * Creates ProseMirror plugins from the resolved options and storage.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns ProseMirror plugins contributed by the extension.
   */
  readonly addProseMirrorPlugins?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => QuirePluginList;
  /**
   * Creates declarative node, inline, and widget decorations.
   *
   * @returns Decoration policy and factories, or null when disabled.
   */
  readonly addDecorations?: QuireAddDecorationsFactory<Options, Storage>;
  /**
   * Creates named qkView event handlers from the resolved options and storage.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns qkView event handlers keyed by handler id.
   */
  readonly addViewEventHandlers?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => QuireExtensionViewEventHandlerMap;
  /**
   * Creates a renderer-neutral node view renderer for this node type.
   *
   * @returns Node view renderer, or nullish when this node has no custom view.
   */
  readonly addNodeView?: (
    this: QuireExtensionThisContext<Options, Storage> & {
      /** Editor instance that owns the extension manager. */
      readonly editor: QuireEditor;
      /** ProseMirror node type represented by this extension. */
      readonly type: PMNodeType;
    }
  ) => QuireNodeViewRenderer | null | undefined;
  /**
   * Creates node-owned attribute specs.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Attribute specs to install on this node type.
   */
  readonly addAttributes?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => QuireSchemaAttributeMap;
  /**
   * Creates global attribute contributions for existing node or mark types.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Attribute contributions to merge into matching node or mark types.
   */
  readonly addGlobalAttributes?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => readonly QuireSchemaAttributeContribution[];
  /**
   * Creates DOM parse rules for this node.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Tag parse rules for this node type.
   */
  readonly parseHTML?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => readonly TagParseRule[];
  /**
   * Serializes this node to a DOM output spec.
   *
   * @param context - Node render context containing the node and HTML
   * attributes.
   * @returns DOM output spec used by ProseMirror serialization.
   */
  readonly renderHTML?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireNodeRenderHTMLContext<Options, Storage>
  ) => DOMOutputSpec;
  /**
   * Serializes this node to plain text.
   *
   * @param context - Text serializer context containing the node and range.
   * @returns Plain text for this node.
   */
  readonly renderText?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireNodeRenderTextContext<Options, Storage>
  ) => string;
}

/** Defines a Tiptap-compatible mark extension before resolution. */
export interface QuireMarkConfig<
  Options extends object = object,
  Storage extends object = object
> extends QuireMarkdownConfigFields {
  /** ProseMirror mark type name contributed by this extension. */
  readonly name: string;
  /** Higher priority extensions run their commands before lower priority extensions. */
  readonly priority?: number;
  /**
   * Orders only keyboard shortcut handlers without changing the extension's
   * schema, command, plugin, or lifecycle order.
   */
  readonly keyboardShortcutPriority?: number;
  /** Hook that can intercept transactions before core applies them. */
  readonly dispatchTransaction?: QuireExtensionDispatchTransactionHook<
    Options,
    Storage
  >;
  /** Hook that transforms pasted HTML before parsing. */
  readonly transformPastedHTML?: QuireTransformPastedHTMLHook<Options, Storage>;
  /** Hook that adds schema fields to node extensions. */
  readonly extendNodeSchema?: QuireExtendNodeSchemaHook<Options, Storage>;
  /** Hook that adds schema fields to mark extensions. */
  readonly extendMarkSchema?: QuireExtendMarkSchemaHook<Options, Storage>;
  /**
   * Creates model-neutral DOCX contributions owned by this mark extension.
   *
   * @returns DOCX codecs, feature compilers, or package passes.
   */
  readonly addDocx?: QuireDocxContributionFactory<Options, Storage>;
  /** Static qkView event handlers contributed by this mark extension. */
  readonly viewEventHandlers?: QuireExtensionViewEventHandlerMap;
  /** Whether this mark remains active at its edges. */
  readonly inclusive?: QuireConfigValue<MarkSpec["inclusive"], Options, Storage>;
  /** Mark or mark group names excluded by this mark. */
  readonly excludes?: QuireConfigValue<MarkSpec["excludes"], Options, Storage>;
  /** Schema group or groups this mark belongs to. */
  readonly group?: QuireConfigValue<MarkSpec["group"], Options, Storage>;
  /** Whether this mark can span multiple adjacent nodes when serialized. */
  readonly spanning?: QuireConfigValue<MarkSpec["spanning"], Options, Storage>;
  /** Whether this mark represents code content. */
  readonly code?: QuireConfigValue<MarkSpec["code"], Options, Storage>;
  /** Whether ArrowRight can exit this mark at its right edge. */
  readonly exitable?: QuireConfigValue<boolean, Options, Storage>;
  /** Whether this mark should stay active after splitting a block or list item. */
  readonly keepOnSplit?: QuireConfigValue<boolean, Options, Storage>;
  /** Lifecycle hook called before extension create hooks run. */
  readonly onBeforeCreate?: QuireExtensionBeforeCreateHook<Options, Storage>;
  /** Lifecycle hook called after the editor is created. */
  readonly onCreate?: QuireExtensionCreateHook<Options, Storage>;
  /** Lifecycle hook called after the editor state changes. */
  readonly onUpdate?: QuireExtensionUpdateHook<Options, Storage>;
  /** Lifecycle hook called when the editor is destroyed. */
  readonly onDestroy?: QuireExtensionDestroyHook<Options, Storage>;
  /** Lifecycle hook called when the editor receives focus. */
  readonly onFocus?: QuireExtensionFocusHook<Options, Storage>;
  /** Lifecycle hook called when the editor loses focus. */
  readonly onBlur?: QuireExtensionBlurHook<Options, Storage>;
  /**
   * Creates the default option object for this extension.
   *
   * @returns Default options used before caller-provided overrides are merged.
   */
  readonly addOptions?: (
    this: QuireExtensionOptionsThisContext<Options>
  ) => Options;
  /**
   * Creates the storage object owned by this extension.
   *
   * @param context - Extension context containing the extension name and
   * resolved options.
   * @returns Storage object owned by this extension.
   */
  readonly addStorage?: (
    this: QuireExtensionStorageThisContext<Options>
  ) => Storage;
  /**
   * Creates named commands from the resolved options and storage.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Command handlers keyed by command name.
   */
  readonly addCommands?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => AnyCommands;
  /**
   * Creates keyboard shortcuts from the resolved options and storage.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Shortcut handlers keyed by ProseMirror keymap shortcut name.
   */
  readonly addKeyboardShortcuts?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => QuireKeyboardShortcutMap;
  /**
   * Creates input rules from the resolved options and storage.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Input rules contributed by the extension.
   */
  readonly addInputRules?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => QuireInputRuleList;
  /**
   * Creates paste rules from the resolved options and storage.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Paste rules contributed by the extension.
   */
  readonly addPasteRules?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => QuirePasteRuleList;
  /**
   * Creates child extensions bundled by this mark extension.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Child extensions that should be installed with this extension.
   */
  readonly addExtensions?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => readonly QuireAnyExtension[];
  /**
   * Creates ProseMirror plugins from the resolved options and storage.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns ProseMirror plugins contributed by the extension.
   */
  readonly addProseMirrorPlugins?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => QuirePluginList;
  /**
   * Creates declarative node, inline, and widget decorations.
   *
   * @returns Decoration policy and factories, or null when disabled.
   */
  readonly addDecorations?: QuireAddDecorationsFactory<Options, Storage>;
  /**
   * Creates named qkView event handlers from the resolved options and storage.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns qkView event handlers keyed by handler id.
   */
  readonly addViewEventHandlers?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => QuireExtensionViewEventHandlerMap;
  /**
   * Creates a renderer-neutral mark view renderer for this mark type.
   *
   * @returns Mark view renderer, or nullish when this mark has no custom view.
   */
  readonly addMarkView?: (
    this: QuireExtensionThisContext<Options, Storage> & {
      /** Editor instance that owns the extension manager. */
      readonly editor: QuireEditor;
      /** ProseMirror mark type represented by this extension. */
      readonly type: PMMarkType;
    }
  ) => QuireMarkViewRenderer | null | undefined;
  /**
   * Creates mark-owned attribute specs.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Attribute specs to install on this mark type.
   */
  readonly addAttributes?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => QuireSchemaAttributeMap;
  /**
   * Creates global attribute contributions for existing node or mark types.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Attribute contributions to merge into matching node or mark types.
   */
  readonly addGlobalAttributes?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => readonly QuireSchemaAttributeContribution[];
  /**
   * Creates DOM parse rules for this mark.
   *
   * @param context - Extension context containing resolved options and storage.
   * @returns Parse rules for this mark type.
   */
  readonly parseHTML?: (
    this: QuireExtensionThisContext<Options, Storage>
  ) => readonly ParseRule[];
  /**
   * Serializes this mark to a DOM output spec.
   *
   * @param context - Mark render context containing the mark and HTML
   * attributes.
   * @returns DOM output spec used by ProseMirror serialization.
   */
  readonly renderHTML?: (
    this: QuireExtensionThisContext<Options, Storage>,
    context: QuireMarkRenderHTMLContext<Options, Storage>
  ) => DOMOutputSpec;
  /**
   * Declares how this mark styles text on the Canvas/SVG track.
   *
   * @param mark - Mark instance whose style should be resolved.
   * @returns Canvas text style delta, or null for no contribution.
   */
  readonly canvasStyle?: QuireMarkCanvasStyleResolver;
}

/** Common Tiptap-compatible config fields shared by extension classes. */
export interface ExtendableConfig<
  Options extends object = object,
  Storage extends object = object,
  Config = unknown,
  PMType = unknown
> extends QuireExtensionConfig<Options, Storage> {}

/** Tiptap-compatible behavior extension config. */
export interface ExtensionConfig<
  Options extends object = object,
  Storage extends object = object
> extends ExtendableConfig<
    Options,
    Storage,
    ExtensionConfig<Options, Storage>,
    null
  > {}

/** Tiptap-compatible node extension config with a DOM node-view contract. */
export type NodeConfig<
  Options extends object = object,
  Storage extends object = object
> = Omit<QuireNodeConfig<Options, Storage>, "addNodeView"> & {
  /** Creates a ProseMirror DOM node view renderer for this node type. */
  addNodeView?:
    | ((this: {
        /** Extension name. */
        name: string;
        /** Resolved node extension options. */
        options: Options;
        /** Resolved node extension storage. */
        storage: Storage;
        /** Editor instance that owns the extension manager. */
        editor: QuireEditor;
        /** ProseMirror node type represented by this extension. */
        type: PMNodeType;
        /** Parent implementation available through an extension chain. */
        parent: ParentConfig<NodeConfig<Options, Storage>>["addNodeView"];
      }) => NodeViewRenderer | null)
    | null;
};

/** Tiptap-compatible mark extension config with a DOM mark-view contract. */
export type MarkConfig<
  Options extends object = object,
  Storage extends object = object
> = Omit<QuireMarkConfig<Options, Storage>, "addMarkView"> & {
  /** Creates a ProseMirror DOM mark view renderer for this mark type. */
  addMarkView?:
    | ((this: {
        /** Extension name. */
        name: string;
        /** Resolved mark extension options. */
        options: Options;
        /** Resolved mark extension storage. */
        storage: Storage;
        /** Editor instance that owns the extension manager. */
        editor: QuireEditor;
        /** ProseMirror mark type represented by this extension. */
        type: PMMarkType;
        /** Parent implementation available through an extension chain. */
        parent: ParentConfig<MarkConfig<Options, Storage>>["addMarkView"];
      }) => MarkViewRenderer | null)
    | null;
};

/** Defines a resolved QuireKit editor extension. */
export interface QuireExtension<
  Options extends object = object,
  Storage extends object = object
> {
  /** Original config object used for Tiptap-compatible field lookup. */
  readonly config: Readonly<Record<string, unknown>>;
  /** Parent extension config source used by `extend()` chains. */
  readonly parent?: QuireExtensionFieldSource | undefined;
  /** Unique extension name used for ordering, debugging, and command ownership. */
  readonly name: string;
  /** Authoring family used to create this extension. */
  readonly kind: QuireExtensionKind;
  /** Tiptap-compatible authoring family alias. */
  readonly type: QuireExtensionKind;
  /** Higher priority extensions run their commands before lower priority extensions. */
  readonly priority?: number | undefined;
  /**
   * Keyboard-only execution priority, falling back to the extension priority
   * when omitted.
   */
  readonly keyboardShortcutPriority?: number | undefined;
  /** Resolved extension options. */
  readonly options: Readonly<Options>;
  /** Storage object owned by this extension. */
  readonly storage: Storage;
  /** Named commands contributed by this extension. */
  readonly commands?: AnyCommands | undefined;
  /** Keyboard shortcuts contributed by this extension. */
  readonly keyboardShortcuts?: QuireKeyboardShortcutMap | undefined;
  /** Input rules contributed by this extension. */
  readonly inputRules: QuireInputRuleList;
  /** Paste rules contributed by this extension. */
  readonly pasteRules: QuirePasteRuleList;
  /** Node specs contributed by this extension. */
  readonly nodes: QuireNodeSpecMap;
  /** Mark specs contributed by this extension. */
  readonly marks: QuireMarkSpecMap;
  /** ProseMirror plugins contributed by this extension. */
  readonly plugins: QuirePluginList;
  /** Layout-provider registrations contributed by this extension. */
  readonly layoutProviders?: readonly QuireLayoutProviderEntry[] | undefined;
  /** Document-profile registrations contributed by this extension. */
  readonly documentProfiles?: readonly QuireDocumentProfileEntry[] | undefined;
  /** Structured-range selection adapters contributed by this extension. */
  readonly selectionAdapters?: readonly QuireSelectionAdapterEntry[] | undefined;
  /** Canvas text style resolvers contributed by mark extensions. */
  readonly canvasStyle?: QuireMarkCanvasStyleMap | undefined;
  /** Base canvas text style resolvers contributed by node extensions. */
  readonly canvasTextStyle?: QuireNodeCanvasTextStyleMap | undefined;
  /** Default HTML serialization transforms contributed for existing nodes. */
  readonly htmlSerializationTransforms?:
    | QuireNodeHTMLSerializationTransformMap
    | undefined;
  /** Default Markdown serialization transforms contributed for existing nodes. */
  readonly markdownSerializationTransforms?:
    | QuireNodeMarkdownSerializationTransformMap
    | undefined;
  /** Mounted view adapters contributed by this extension. */
  readonly viewAdapters?: readonly QuireViewAdapter[] | undefined;
  /** qkView event handlers contributed by this extension. */
  readonly viewEventHandlers?: QuireExtensionViewEventHandlerMap | undefined;
  /** Child extensions bundled by this extension. */
  readonly extensions?: readonly QuireAnyExtension[] | undefined;
  /** Optional schema top node name contributed by this extension. */
  readonly topNodeName?: string | undefined;
  /** Lifecycle hook called before extension create hooks run. */
  readonly onBeforeCreate?: QuireExtensionBeforeCreateHook<Options, Storage> | undefined;
  /** Lifecycle hook called after the editor is created. */
  readonly onCreate?: QuireExtensionCreateHook<Options, Storage> | undefined;
  /** Lifecycle hook called after the editor state changes. */
  readonly onUpdate?: QuireExtensionUpdateHook<Options, Storage> | undefined;
  /** Lifecycle hook called when the editor is destroyed. */
  readonly onDestroy?: QuireExtensionDestroyHook<Options, Storage> | undefined;
  /** Lifecycle hook called when the editor receives focus. */
  readonly onFocus?: QuireExtensionFocusHook<Options, Storage> | undefined;
  /** Lifecycle hook called when the editor loses focus. */
  readonly onBlur?: QuireExtensionBlurHook<Options, Storage> | undefined;
  /** Hook that can intercept transactions before core applies them. */
  readonly dispatchTransaction?: QuireExtensionDispatchTransactionHook<
    Options,
    Storage
  > | undefined;
  /** Hook that transforms pasted HTML before parsing. */
  readonly transformPastedHTML?: QuireTransformPastedHTMLHook<
    Options,
    Storage
  > | undefined;
  /** Marked token name used for parsing and rendering this extension. */
  readonly markdownTokenName?: string | undefined;
  /** Markdown parser contributed by this extension. */
  readonly parseMarkdown?: QuireMarkdownConfigFields["parseMarkdown"] | undefined;
  /** Markdown renderer contributed by this extension. */
  readonly renderMarkdown?: QuireMarkdownConfigFields["renderMarkdown"] | undefined;
  /** Custom Markdown tokenizer contributed by this extension. */
  readonly markdownTokenizer?: MarkdownTokenizer | undefined;
  /** Markdown rendering behavior contributed by this extension. */
  readonly markdownOptions?: QuireMarkdownOptions | undefined;
  /** Attribute contributions for existing node or mark types. */
  readonly attributes: readonly QuireSchemaAttributeContribution[];
  /**
   * Creates a new extension instance with merged options.
   *
   * @param options - Option overrides to merge with the current extension
   * options.
   * @returns A new extension instance with merged options.
   */
  configure(options: Partial<Options>): QuireExtension<Options, Storage>;
}

/** Any resolved extension regardless of option or storage shape. */
export type QuireAnyExtension = QuireExtension<any, any>;

/** Source object accepted by `getExtensionField()`. */
export interface QuireExtensionFieldSource {
  /** Config object to inspect. */
  readonly config: Readonly<Record<string, unknown>>;
  /** Parent source to inspect when this config omits the field. */
  readonly parent?: QuireExtensionFieldSource | undefined;
}

/** Diagnostic emitted while resolving extensions. */
export interface QuireExtensionDiagnostic {
  /** Machine-readable diagnostic code. */
  readonly code: string;
  /** Human-readable diagnostic message. */
  readonly message: string;
  /** Diagnostic severity. */
  readonly severity: QuireExtensionDiagnosticSeverity;
  /** Extension name associated with the diagnostic. */
  readonly extensionName?: string;
  /** Command name associated with the diagnostic. */
  readonly commandName?: string;
}

/** Diagnostic emitted when extension names are duplicated. */
export interface QuireDuplicateExtensionNameDiagnostic
  extends QuireExtensionDiagnostic {
  /** Machine-readable diagnostic code. */
  readonly code: "duplicate-extension-name";
  /** Diagnostic severity. */
  readonly severity: "error";
  /** Extension name associated with the diagnostic. */
  readonly extensionName: string;
}

/** Diagnostic emitted when command names are duplicated. */
export interface QuireDuplicateCommandNameDiagnostic
  extends QuireExtensionDiagnostic {
  /** Machine-readable diagnostic code. */
  readonly code: "duplicate-command-name";
  /** Diagnostic severity. */
  readonly severity: "warning";
  /** Extension name associated with the diagnostic. */
  readonly extensionName: string;
  /** Command name associated with the diagnostic. */
  readonly commandName: string;
}

/** Diagnostic emitted when top node declarations are duplicated. */
export interface QuireDuplicateTopNodeDiagnostic
  extends QuireExtensionDiagnostic {
  /** Machine-readable diagnostic code. */
  readonly code: "duplicate-top-node";
  /** Diagnostic severity. */
  readonly severity: "error";
  /** Extension name associated with the diagnostic. */
  readonly extensionName: string;
}

/** Diagnostic emitted when layout-provider ids are duplicated. */
export interface QuireDuplicateLayoutProviderIdDiagnostic
  extends QuireExtensionDiagnostic {
  /** Machine-readable diagnostic code. */
  readonly code: "duplicate-layout-provider-id";
  /** Diagnostic severity. */
  readonly severity: "error";
  /** Extension name associated with the first registration. */
  readonly extensionName: string;
  /** Duplicated provider id. */
  readonly providerId: string;
}

/** Diagnostic emitted when a node type has multiple layout providers. */
export interface QuireAmbiguousNodeLayoutProviderDiagnostic
  extends QuireExtensionDiagnostic {
  /** Machine-readable diagnostic code. */
  readonly code: "ambiguous-node-layout-provider";
  /** Diagnostic severity. */
  readonly severity: "error";
  /** Extension name associated with the first registration. */
  readonly extensionName: string;
  /** Ambiguous node type. */
  readonly nodeType: string;
}

/** Diagnostic emitted when document-profile ids are duplicated. */
export interface QuireDuplicateDocumentProfileIdDiagnostic
  extends QuireExtensionDiagnostic {
  /** Machine-readable diagnostic code. */
  readonly code: "duplicate-document-profile-id";
  /** Diagnostic severity. */
  readonly severity: "error";
  /** Extension name associated with the first registration. */
  readonly extensionName: string;
  /** Duplicated profile id. */
  readonly profileId: string;
}

/** Diagnostic emitted when a document-profile facet has multiple owners. */
export interface QuireAmbiguousDocumentProfileFacetDiagnostic
  extends QuireExtensionDiagnostic {
  /** Machine-readable diagnostic code. */
  readonly code: "ambiguous-document-profile-facet";
  /** Diagnostic severity. */
  readonly severity: "error";
  /** Extension name associated with the first registration. */
  readonly extensionName: string;
  /** Facet claimed by multiple profiles. */
  readonly facet: string;
}

/** Diagnostic emitted when selection-adapter ids are duplicated. */
export interface QuireDuplicateSelectionAdapterIdDiagnostic
  extends QuireExtensionDiagnostic {
  /** Machine-readable diagnostic code. */
  readonly code: "duplicate-selection-adapter-id";
  /** Diagnostic severity. */
  readonly severity: "error";
  /** Extension name associated with the first registration. */
  readonly extensionName: string;
  /** Duplicated selection adapter id. */
  readonly adapterId: string;
}

/** Diagnostic emitted for equal-priority selection adapters on one node type. */
export interface QuireAmbiguousNodeSelectionAdapterDiagnostic
  extends QuireExtensionDiagnostic {
  /** Machine-readable diagnostic code. */
  readonly code: "ambiguous-node-selection-adapter";
  /** Diagnostic severity. */
  readonly severity: "error";
  /** Extension name associated with the first registration. */
  readonly extensionName: string;
  /** Node type with ambiguous selection semantics. */
  readonly nodeType: string;
  /** Priority tier with more than one selection adapter. */
  readonly priority: number;
}

/** Built-in diagnostics emitted by the extension manager. */
export type QuireBuiltInExtensionDiagnostic =
  | QuireDuplicateExtensionNameDiagnostic
  | QuireDuplicateCommandNameDiagnostic
  | QuireDuplicateLayoutProviderIdDiagnostic
  | QuireAmbiguousNodeLayoutProviderDiagnostic
  | QuireDuplicateDocumentProfileIdDiagnostic
  | QuireAmbiguousDocumentProfileFacetDiagnostic
  | QuireDuplicateSelectionAdapterIdDiagnostic
  | QuireAmbiguousNodeSelectionAdapterDiagnostic
  | QuireDuplicateTopNodeDiagnostic;

/** Keyboard shortcut entry resolved from an extension. */
export interface QuireKeyboardShortcutEntry {
  /** Extension that contributed the shortcut. */
  readonly extension: QuireAnyExtension;
  /** ProseMirror keymap-compatible shortcut name such as `Mod-z`. */
  readonly shortcut: string;
  /** Command handler contributed by the extension. */
  readonly command: Command;
}

/** HTML content accepted by Tiptap-compatible content APIs. */
export type HTMLContent = string;

/** QuireKit compatibility alias for HTML content. */
export type QuireHTMLContent = HTMLContent;

/** One format-neutral font set used by a document typography role. */
export interface QuireDocumentFontSet {
  /** Preferred family for Latin and high-ANSI text. */
  readonly latin?: string | undefined;
  /** Preferred family for East Asian text. */
  readonly eastAsia?: string | undefined;
  /** Preferred family for complex-script text. */
  readonly complexScript?: string | undefined;
  /** Additional ordered CSS-compatible fallback families. */
  readonly fallbacks?: readonly string[] | undefined;
}

/**
 * Optional document-owned override for a character's font slot.
 * @param character - One Unicode scalar, preserving the source's UTF-16 extent.
 * @returns An explicit slot, or undefined to retain neutral script classification.
 */
export type QuireFontSlotResolver = (character: string) => "latin" | "eastAsia" | "complexScript" | undefined;

/**
 * Compiles a document-owned font selector once per styled source run.
 * @param styles - Effective inherited style followed by direct style deltas.
 * @returns A character selector, or undefined when neutral selection suffices.
 */
export type QuireFontSelectionResolver = (styles: readonly QuireMarkCanvasStyle[]) => QuireFontSlotResolver | undefined;

/** Format-neutral language set aligned with Word's three run-language slots. */
export interface QuireDocumentLanguageSet {
  /** BCP 47 language for Latin and other non-East-Asian text. */
  readonly latin?: string | undefined;
  /** BCP 47 language for East Asian text. */
  readonly eastAsia?: string | undefined;
  /** BCP 47 language for complex-script text. */
  readonly complexScript?: string | undefined;
}

/** Format-neutral document font roles shared by import, layout, and export. */
export interface QuireDocumentFontTheme {
  /** Inherited body and normal-paragraph font set. */
  readonly body: QuireDocumentFontSet;
  /** Optional heading font set; display falls back to body when absent. */
  readonly heading?: QuireDocumentFontSet | undefined;
}

/** One logical document font and the names tried before host substitution. */
export interface QuireDocumentFontTableEntry {
  /** Primary case-insensitive family name referenced by document content. */
  readonly family: string;
  /** Ordered document-provided alternate family names. */
  readonly alternates?: readonly string[] | undefined;
}

/** Format-neutral projection of the document's font-table metadata. */
export interface QuireDocumentFontTable {
  /** Font entries in source order. */
  readonly fonts: readonly QuireDocumentFontTableEntry[];
}

/** One deterministic host substitution rule. */
export interface QuireFontSubstitutionRule {
  /** Logical family matched case-insensitively. */
  readonly requestedFamily: string;
  /** Ordered metric-compatible or product-approved substitutes. */
  readonly substitutes: readonly string[];
}

/** Origin of a family considered before generic glyph fallback. */
export type QuireFontSubstitutionCandidateSource =
  | "requested"
  | "document-alternate"
  | "metric-compatible";

/** One exact family candidate in substitution precedence order. */
export interface QuireFontSubstitutionCandidate {
  /** Exact family name passed to availability and rendering services. */
  readonly family: string;
  /** Authority that contributed this candidate. */
  readonly source: QuireFontSubstitutionCandidateSource;
}

/** Inputs for deterministic logical-to-rendered font candidate resolution. */
export interface ResolveQuireFontSubstitutionCandidatesOptions {
  /** Logical family stored by the document. */
  readonly requestedFamily: string;
  /** Optional document-provided alternate-name table. */
  readonly fontTable?: QuireDocumentFontTable | null | undefined;
  /** Optional host policy; defaults to QuireKit's open metric-compatible rules. */
  readonly rules?: readonly QuireFontSubstitutionRule[] | undefined;
}

/** Tiptap-compatible JSON node or document content. */
export interface JSONContent {
  /** Node type name registered in the editor schema. */
  type?: string | undefined;
  /** Optional node attributes. */
  attrs?: Record<string, any> | undefined;
  /** Optional child node JSON. */
  content?: JSONContent[] | undefined;
  /** Marks applied to this node when the schema allows marks. */
  marks?: Array<{
    /** Mark type name registered in the editor schema. */
    type: string;
    /** Optional mark attributes. */
    attrs?: Record<string, any> | undefined;
    /** Extra JSON fields preserved for Tiptap compatibility. */
    [key: string]: any;
  }> | undefined;
  /** Text content for text nodes. */
  text?: string | undefined;
  /** Extra JSON fields preserved for Tiptap compatibility. */
  [key: string]: any;
}

/** Immutable QuireKit JSON content used by renderer-neutral APIs. */
export interface QuireJSONContent extends JSONContent {
  /** Node type name registered in the editor schema. */
  readonly type?: string | undefined;
  /** Optional node attributes. */
  readonly attrs?: Record<string, unknown> | undefined;
  /** Optional child node JSON. */
  readonly content?: QuireJSONContent[] | undefined;
  /** Marks applied to this node when the schema allows marks. */
  readonly marks?: Array<{
    /** Mark type name registered in the editor schema. */
    readonly type: string;
    /** Optional mark attributes. */
    readonly attrs?: Record<string, unknown> | undefined;
    /** Extra JSON fields preserved for Tiptap compatibility. */
    readonly [key: string]: unknown;
  }> | undefined;
  /** Text content for text nodes. */
  readonly text?: string | undefined;
  /** Extra JSON fields preserved for Tiptap compatibility. */
  readonly [key: string]: unknown;
}

/**
 * Transforms the default DOM serialization of one schema node.
 *
 * @param node - ProseMirror node being serialized.
 * @param output - DOM output produced by the owning node extension.
 * @returns Transformed DOM output without mutating the document node.
 */
export type QuireNodeHTMLSerializationTransform = (
  node: PMNode,
  output: DOMOutputSpec
) => DOMOutputSpec;

/** Maps schema node names to default HTML serialization transforms. */
export type QuireNodeHTMLSerializationTransformMap = Readonly<
  Record<string, QuireNodeHTMLSerializationTransform>
>;

/** Markdown token shape consumed by Tiptap-compatible Markdown specs. */
export type MarkdownToken = QuireMarkdownToken;

/** Helpers passed to Markdown parse callbacks. */
export type MarkdownParseHelpers = QuireMarkdownParseHelpers;

/** Markdown mark parse result returned by inline mark handlers. */
export type MarkdownMarkParseResult = QuireMarkdownMarkParseResult;

/** Result returned by Markdown parse callbacks. */
export type MarkdownParseResult = QuireMarkdownParseResult;

/** Markdown render context passed to render callbacks. */
export type RenderContext = QuireMarkdownRenderContext;

/**
 * Transforms the default Markdown serialization of one JSON node.
 *
 * @param node - JSON node being serialized.
 * @param output - Markdown produced by the owning node renderer or fallback.
 * @param context - Rendering context for the node.
 * @returns Transformed Markdown without mutating the JSON node.
 */
export type QuireNodeMarkdownSerializationTransform = (
  node: QuireJSONContent,
  output: string,
  context: RenderContext
) => string;

/** Maps schema node names to default Markdown serialization transforms. */
export type QuireNodeMarkdownSerializationTransformMap = Readonly<
  Record<string, QuireNodeMarkdownSerializationTransform>
>;

/** Lexer methods exposed to custom Markdown tokenizers. */
export type MarkdownLexerConfiguration = QuireMarkdownLexerConfiguration;

/** Custom tokenizer descriptor accepted by Markdown-capable extensions. */
export type MarkdownTokenizer = QuireMarkdownTokenizer;

/** Helpers passed to Markdown render callbacks. */
export type MarkdownRendererHelpers = QuireMarkdownRendererHelpers;

/** Markdown behavior fields shared by Extension, Node, and Mark configs. */
export interface QuireMarkdownConfigFields {
  /** Marked token name used for parsing and rendering this extension. */
  readonly markdownTokenName?: string | undefined;
  /**
   * Parses a Markdown token into JSON content.
   *
   * @param token - Markdown token to parse.
   * @param helpers - Parse helpers.
   * @returns Parsed Markdown result.
   */
  readonly parseMarkdown?: (
    token: MarkdownToken,
    helpers: MarkdownParseHelpers
  ) => MarkdownParseResult;
  /**
   * Renders JSON content into Markdown.
   *
   * @param node - JSON node being rendered.
   * @param helpers - Render helpers.
   * @param context - Render context.
   * @returns Rendered Markdown.
   */
  readonly renderMarkdown?: (
    node: QuireJSONContent,
    helpers: MarkdownRendererHelpers,
    context: RenderContext
  ) => string;
  /** Custom tokenizer for non-standard Markdown syntax. */
  readonly markdownTokenizer?: MarkdownTokenizer | undefined;
  /** Optional Markdown rendering behavior. */
  readonly markdownOptions?: QuireMarkdownOptions | undefined;
}

/** Markdown rendering options for an extension. */
export type QuireMarkdownOptions = QuireMarkdownExtensionOptions;

/** Tiptap-compatible Markdown extension contract. */
export interface MarkdownExtensionSpec {
  /** Token name used while parsing Markdown. */
  readonly tokenName?: string | undefined;
  /** Node or mark name used while rendering Markdown. */
  readonly nodeName?: string | undefined;
  /**
   * Parses a Markdown token into JSON content.
   *
   * @param token - Markdown token to parse.
   * @param helpers - Parse helpers.
   * @returns Parsed Markdown result.
   */
  readonly parseMarkdown?: (
    token: MarkdownToken,
    helpers: MarkdownParseHelpers
  ) => MarkdownParseResult;
  /**
   * Renders JSON content into Markdown.
   *
   * @param node - JSON node being rendered.
   * @param helpers - Render helpers.
   * @param context - Render context.
   * @returns Rendered Markdown.
   */
  readonly renderMarkdown?: (
    node: QuireJSONContent,
    helpers: MarkdownRendererHelpers,
    context: RenderContext
  ) => string;
  /** Whether this extension indents child content. */
  readonly isIndenting?: boolean | undefined;
  /** Custom tokenizer for non-standard Markdown syntax. */
  readonly tokenizer?: MarkdownTokenizer | undefined;
}

/** Content accepted by Tiptap-compatible content APIs. */
export type Content = HTMLContent | JSONContent | JSONContent[] | null;

/** Immutable QuireKit content accepted by renderer-neutral APIs. */
export type QuireContent =
  | HTMLContent
  | QuireJSONContent
  | QuireJSONContent[]
  | null;

/** Content accepted by editor creation and `setContent()`. */
export type QuireEditorContent = QuireContent | PMNode;

/** Options used when parsing content for `setContent()`. */
export interface SetContentOptions {
  /** Options forwarded to HTML parsing. */
  parseOptions?: ParseOptions | undefined;
  /** Whether invalid content should throw instead of falling back. */
  errorOnInvalidContent?: boolean | undefined;
  /** Whether extension update hooks should run after replacing content. */
  emitUpdate?: boolean | undefined;
}

/** QuireKit setContent options with explicit Markdown content selection. */
export interface QuireSetContentOptions extends SetContentOptions {
  /** Explicit content type for string content. */
  readonly contentType?: QuireMarkdownContentType | undefined;
  /** Options forwarded to HTML parsing once HTML content parsing is available. */
  readonly parseOptions?: ParseOptions;
  /** Whether invalid content should throw instead of falling back. */
  readonly errorOnInvalidContent?: boolean;
  /** Whether extension update hooks should run after replacing content. */
  readonly emitUpdate?: boolean;
}

/** View backend mode mounted by an editor runtime. */
export type QuireViewMode = "canvas" | "svg" | "html" | "dom";

/** Presentation policy for Word hidden text in one mounted view. */
export type QuireHiddenTextViewMode = "normal" | "formatting-inspection";

/** Lifecycle status for a mounted editor view. */
export type QuireEditorViewStatus = "primary" | "lock" | "sync";

/** Reason why a mounted view should refresh itself from shared editor state. */
export type QuireMountedViewUpdateReason =
  | "transaction"
  | "document-replace"
  | "selection"
  | "composition"
  | "resize"
  | "mode-change";

/** Context passed to extension-owned mounted view events. */
export interface QuireExtensionViewEventContext {
  /** Editor whose mounted view received the renderer event. */
  readonly editor: QuireEditor;
  /** Mounted view that owns the renderer event scope. */
  readonly view: QuireMountedEditorView;
  /** View backend mode that received the event. */
  readonly mode: QuireViewMode;
  /** Mounted view status that controls mutability for this event. */
  readonly status: QuireEditorViewStatus;
}

/** Handler invoked when a qkView target resolves an extension event handler. */
export interface QuireExtensionViewEventHandler {
  /**
   * Handles an editor-owned qkView event.
   *
   * @param context - Editor and mounted view context supplied by the view runtime.
   * @param event - Renderer-specific event object supplied by the view runtime.
   * @returns False when the event should be treated as unhandled.
   */
  (context: QuireExtensionViewEventContext, event: unknown): boolean | void;
}

/** Named qkView event handlers contributed by an extension. */
export type QuireExtensionViewEventHandlerMap = Readonly<
  Record<string, QuireExtensionViewEventHandler>
>;

/**
 * Browser elements shared by every mounted editor view.
 *
 * This base describes only the shared geometry and lifecycle anchors: the root
 * element, the optional overlay host, and the optional input proxy. Surface
 * realization (how document pixels are produced) is per-backend and lives in each
 * backend's own elements type, so the shared contract must not mandate a single
 * content or overlay surface.
 */
export interface QuireMountedEditorViewElements {
  /** Root element owned by this mounted view. */
  readonly root: HTMLElement;
  /** Optional DOM host for node views and other positioned overlays. */
  readonly overlayHost?: HTMLElement | undefined;
  /** Optional text input proxy used by IME, keyboard, and clipboard events. */
  readonly inputProxy?: HTMLTextAreaElement | undefined;
}

/** Options used to mount a mode-specific editor view. */
export interface QuireMountedEditorViewOptions {
  /** Editor whose state and transactions drive the mounted view. */
  readonly editor: QuireEditor;
  /** Stable view identity used to isolate focus, selection, and transient state. */
  readonly id: string;
  /** View mode being mounted. */
  readonly mode: QuireViewMode;
  /** Runtime status that controls whether the view may edit shared state. */
  readonly status: QuireEditorViewStatus;
  /** Element supplied by the consumer as this view's mount container. */
  readonly element: HTMLElement;
  /** DOM document used to create child elements. */
  readonly ownerDocument?: Document | undefined;
}

/** PM-style direct props snapshot exposed by a mounted QuireKit view. */
export interface QuireMountedEditorViewProps extends Partial<QuireEditorProps> {
  /** Current ProseMirror state synchronized from the owning editor. */
  readonly state: PMEditorState;
}

/** Options passed to a mounted view update. */
export interface QuireMountedEditorViewUpdateOptions {
  /** Editor whose latest state should be rendered. */
  readonly editor: QuireEditor;
  /** Why the mounted view is being refreshed. */
  readonly reason: QuireMountedViewUpdateReason;
  /** Applied transactions that contributed to this update, when available. */
  readonly transactions?: readonly Transaction[] | undefined;
}

/** Optional retained occurrence used to disambiguate one mounted object instance. */
export interface QuireMountedObjectAnchorOccurrence {
  /** Exact retained target id, when the caller already owns one. */
  readonly targetId?: string | undefined;
  /** Exact repeated visual-instance id, when the source renders more than once. */
  readonly visualInstanceId?: string | undefined;
}

/** Client-space rectangle returned by mounted object-anchor resolution. */
export interface QuireMountedObjectAnchorRect {
  /** Horizontal origin in client CSS pixels. */
  readonly x: number;
  /** Vertical origin in client CSS pixels. */
  readonly y: number;
  /** Rectangle width in client CSS pixels. */
  readonly width: number;
  /** Rectangle height in client CSS pixels. */
  readonly height: number;
}

/** Successfully resolved mounted object geometry. */
export interface QuireMountedReadyObjectAnchor {
  /** Optional accepted document-space placement origins, independent of client projection. */
  readonly placement?: {
    /** Explicit coordinate space of every origin in this tuple. */
    readonly coordinateSpace: "document";
    /** Untransformed destination rectangle. */
    readonly rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
    /** Receiving page origin. */
    readonly page: { readonly x: number; readonly y: number };
    /** Receiving column origin. */
    readonly column: { readonly x: number; readonly y: number };
    /** Source paragraph origin. */
    readonly paragraph: { readonly x: number; readonly y: number };
  } | undefined;
  /** Ready-result discriminator. */
  readonly status: "ready";
  /** Object-anchor discriminator. */
  readonly kind: "object";
  /** Coordinate space owned by a mounted view. */
  readonly coordinateSpace: "client";
  /** Retained snapshot version that produced the geometry. */
  readonly snapshotVersion: number;
  /** Stable object identity represented by the geometry. */
  readonly objectId: string;
  /** Complete visible rectangles in deterministic order. */
  readonly rects: readonly QuireMountedObjectAnchorRect[];
  /** Bounding rectangle used as the default placement reference. */
  readonly referenceRect: QuireMountedObjectAnchorRect;
  /** Retained hit-target ids that supplied semantic geometry. */
  readonly sourceTargetIds: readonly string[];
}

/** Object geometry rejected because the mounted snapshot changed. */
export interface QuireMountedStaleObjectAnchor {
  /** Stale-result discriminator. */
  readonly status: "stale";
  /** Object-anchor discriminator. */
  readonly kind: "object";
  /** Snapshot version expected by the resolution request. */
  readonly expectedSnapshotVersion: number;
  /** Current authoritative retained snapshot version. */
  readonly snapshotVersion: number;
}

/** Object geometry unavailable from the current mounted snapshot. */
export interface QuireMountedUnsupportedObjectAnchor {
  /** Unsupported-result discriminator. */
  readonly status: "unsupported";
  /** Object-anchor discriminator. */
  readonly kind: "object";
  /** Current retained snapshot version, when one exists. */
  readonly snapshotVersion?: number | undefined;
  /** Stable machine-readable reason for the unavailable geometry. */
  readonly reason: string;
}

/** Client-space outcome of resolving one retained object from a mounted view. */
export type QuireMountedObjectAnchorResolution =
  | QuireMountedReadyObjectAnchor
  | QuireMountedStaleObjectAnchor
  | QuireMountedUnsupportedObjectAnchor;

/** Viewport rectangle used by mounted capability chrome. */
export interface QuireMountedCapabilityRect {
  /** Left edge in viewport CSS pixels. */
  readonly left: number;
  /** Right edge in viewport CSS pixels. */
  readonly right: number;
  /** Top edge in viewport CSS pixels. */
  readonly top: number;
  /** Bottom edge in viewport CSS pixels. */
  readonly bottom: number;
}

/** Semantic affordances exposed by mounted Table chrome. */
export type QuireMountedTableChromeAnchorKind =
  | "row-bar"
  | "column-bar"
  | "table-corner"
  | "insert-row"
  | "insert-column"
  | "resize-row"
  | "resize-column"
  | "menu";

/** One viewport-projected Table affordance. */
export interface QuireMountedTableChromeAnchor {
  /** Stable identity within the owning table fragment. */
  readonly id: string;
  /** Semantic affordance represented by this anchor. */
  readonly kind: QuireMountedTableChromeAnchorKind;
  /** Viewport-space geometry in browser CSS pixels. */
  readonly rect: QuireMountedCapabilityRect;
  /** Absolute ProseMirror position immediately before the table node. */
  readonly tablePos: number;
  /** Optional zero-based source row addressed by the affordance. */
  readonly rowIndex?: number | undefined;
  /** Optional zero-based grid column addressed by the affordance. */
  readonly columnIndex?: number | undefined;
  /** Optional zero-based insertion boundary before an axis item. */
  readonly boundaryIndex?: number | undefined;
  /** Semantic cells covered by this affordance in stable layout order. */
  readonly semanticCellIds: readonly string[];
}

/** One viewport-projected missing-border Table editing guide. */
export interface QuireMountedTableChromeGuide {
  /** Stable identity within the owning Table fragment. */
  readonly id: string;
  /** Physical guide orientation used by the product overlay. */
  readonly orientation: "horizontal" | "vertical";
  /** Viewport-space zero-thickness line rectangle. */
  readonly rect: QuireMountedCapabilityRect;
}

/** Viewport-projected chrome for one page-local Table fragment. */
export interface QuireMountedTableChromeFragment {
  /** Stable page-local fragment identity. */
  readonly fragmentId: string;
  /** Viewport-space table bounds for this visual occurrence. */
  readonly tableRect: QuireMountedCapabilityRect;
  /** Editor-only guides for cell edges without effective border paint. */
  readonly guides: readonly QuireMountedTableChromeGuide[];
  /** Whole-table selection affordance. */
  readonly corner: QuireMountedTableChromeAnchor;
  /** Source-row affordances in visual fragment order. */
  readonly rows: readonly QuireMountedTableChromeAnchor[];
  /** Grid-column affordances in physical track order. */
  readonly columns: readonly QuireMountedTableChromeAnchor[];
  /** Insertion affordances for every row and column boundary. */
  readonly insertions: readonly QuireMountedTableChromeAnchor[];
  /** Trailing-edge row and column resize affordances. */
  readonly resizes: readonly QuireMountedTableChromeAnchor[];
  /** Stable toolbar anchor for this fragment. */
  readonly menu: QuireMountedTableChromeAnchor;
}

/** Structural Table selection facts optionally projected into mounted chrome. */
export interface QuireMountedTableSelectionChrome {
  /** Structural selection mode. */
  readonly mode: "cell" | "row" | "column" | "table";
  /** Zero-based first selected row. */
  readonly startRow: number;
  /** Number of selected rows. */
  readonly rowSpan: number;
  /** Zero-based first selected grid column. */
  readonly startColumn: number;
  /** Number of selected grid columns. */
  readonly columnSpan: number;
}

/** In-progress resize facts optionally projected into mounted Table chrome. */
export interface QuireMountedTableResizeSession {
  /** Axis controlled by the captured resize gesture. */
  readonly axis: "row" | "column";
  /** Zero-based source row or grid-column index being resized. */
  readonly index: number;
  /** Preview delta in document-space CSS pixels. */
  readonly delta: number;
}

/** Retained table measurements in unscaled CSS pixels, before pagination. */
export interface QuireMountedTableSizing {
  /** Actual outer table width. */
  readonly width: number;
  /** Logical column widths, excluding separated-border gaps. */
  readonly columnWidths: readonly number[];
  /** Source row heights, without page gaps or repeated headers. */
  readonly rowHeights: readonly number[];
  /** Minimum content-plus-inset heights of semantic cells. */
  readonly cellMinimumHeights: readonly {
    /** First source row covered by the cell. */
    readonly startRow: number;
    /** Number of source rows covered by the cell. */
    readonly rowSpan: number;
    /** Required outer cell height, excluding alignment slack. */
    readonly height: number;
  }[];
}

/** Viewport-projected headless chrome for one semantic Table. */
export interface QuireMountedTableChromeModel {
  /** Document identity that produced the retained geometry; absent on legacy hosts. */
  readonly sourceDocument?: PMNode | undefined;
  /** Complete source-flow measurements; unlike anchors these are never zoomed. */
  readonly sizing?: QuireMountedTableSizing | undefined;
  /** Stable semantic table identity retained by layout. */
  readonly tableId: string;
  /** Absolute ProseMirror position immediately before the table node. */
  readonly tablePos: number;
  /** Fragment selected by retained visual-instance context. */
  readonly activeFragmentId: string;
  /** Page-local visual occurrences in stable layout order. */
  readonly fragments: readonly QuireMountedTableChromeFragment[];
  /** Optional structural selection projection. */
  readonly selection: QuireMountedTableSelectionChrome | null;
  /** Optional captured resize projection. */
  readonly resizeSession: QuireMountedTableResizeSession | null;
}

/** Policy for refreshing host font metrics. */
export interface QuireFontMetricsRefreshOptions {
  /** Skip the refresh when the loaded font faces match those of the last measurement reset. */
  readonly onlyIfFontSetChanged?: boolean | undefined;
}

/** Mounted view instance owned by an editor session. */
export interface QuireMountedEditorView {
  /**
   * Resolves the retained outer DOM node at an exact source boundary when this backend realizes document DOM.
   * @param position - Position immediately before the canonical node.
   * @returns Retained DOM owner, or null when the node is not realized.
   */
  nodeDOM?(position: number): globalThis.Node | null;
  /**
   * Reads the latest presented caret, including IME preview, independently of blink visibility.
   * Subscribe to onGeometryUpdate to observe committed frame changes; this does not map canonical positions.
   * @returns Client CSS-pixel rectangle, or null before a frame or when it has no caret.
   */
  getCaretRect?(): import("./mounted-geometry/types").QuireMountedCaretRect | null;
  /**
   * Queries passive text-range line bands without changing local selection or focus.
   * @param range - Half-open canonical document range.
   * @param sourceDocument - Exact immutable source identity; stale frames are refused.
   * @returns Actual client CSS-pixel line segments, or null without matching geometry.
   */
  getTextRangeRects?(range: QuireCanvasDocumentRange, sourceDocument: PMNode): readonly import("./mounted-geometry/types").QuireMountedTextRangeRect[] | null;
  /**
   * Queries passive boxes of the structured targets inside a range, such as table cells, without changing local selection.
   * @param range - Half-open canonical document range.
   * @param sourceDocument - Exact immutable source identity; stale frames are refused.
   * @returns Client CSS-pixel boxes of the targets whose source lies in the range, empty when there are none, or null without matching geometry.
   */
  getStructuredRangeRects?(range: QuireCanvasDocumentRange, sourceDocument: PMNode): readonly import("./mounted-geometry/types").QuireMountedTextRangeRect[] | null;
  /**
   * Queries exact nearby block occurrences without changing selection.
   * @param clientY - Vertical client coordinate used to narrow visible pages.
   * @returns Nearby source-backed body fragments; none before layout or while an auxiliary story owns editing.
   */
  queryBlockFragments?(clientY: number): readonly import("./block-interaction").QuireMountedBlockFragment[];
  /**
   * Queries complete block occurrences intersecting a client CSS rectangle.
   * @param rect - Current client rectangle, including document portions outside the viewport.
   * @returns Source-backed occurrences from the retained spatial index; absent backends do not support marquee selection.
   */
  queryBlockFragmentsInRect?(rect: import("./block-interaction").QuireMountedBlockFragment["rect"]): readonly import("./block-interaction").QuireMountedBlockFragment[];
  /**
   * Acquires the shared mounted pointer continuation for a block handle.
   * @param event - Initiating primary pointer event.
   * @param lease - Feature-owned semantic drag callbacks.
   * @returns Idempotent cancellation, or null when another owner is active.
   */
  beginBlockDrag?(event: PointerEvent, lease: import("./block-interaction").QuireBlockPointerLease): (() => void) | null;
  /** Stable view identity used for registries and diagnostics. */
  readonly id: string;
  /** View backend mode implemented by this mounted view. */
  readonly mode: QuireViewMode;
  /** Runtime status that controls whether this view may edit shared state. */
  readonly status: QuireEditorViewStatus;
  /** Current ProseMirror editor state exposed to plugin props. */
  readonly state: PMEditorState;
  /** Current direct props snapshot exposed by this mounted view. */
  readonly props: QuireMountedEditorViewProps;
  /** PM-compatible root DOM element for plugins that read `view.dom`. */
  readonly dom: HTMLElement;
  /** Whether this mounted view currently accepts editing input. */
  readonly editable: boolean;
  /** Active hidden-text presentation policy. */
  readonly hiddenTextViewMode: QuireHiddenTextViewMode;
  /** Elements created or claimed by this mounted view. */
  readonly elements: QuireMountedEditorViewElements;
  /** Document or shadow root that owns the mounted view. */
  readonly root: Document | ShadowRoot;
  /**
   * Focuses the view's editable input target when editing is allowed.
   */
  focus(): void;
  /**
   * Dispatches a ProseMirror transaction through the owning editor.
   *
   * @param transaction - Transaction to apply to the shared editor state.
   */
  dispatch(transaction: Transaction): void;
  /**
   * Reports whether this mounted view owns keyboard focus.
   *
   * @returns Whether the mounted view input target is focused.
   */
  hasFocus(): boolean;
  /**
   * Resolves a ProseMirror-style view prop contributed by installed plugins.
   *
   * @param propName - View prop name to read.
   * @param f - Optional callback invoked for each defined prop value until it
   * returns a truthy result.
   * @returns Callback result or undefined when no prop handles the request.
   */
  someProp<PropName extends keyof QuireEditorProps, Result>(
    propName: PropName,
    f: (value: NonNullable<QuireEditorProps[PropName]>) => Result
  ): Result | undefined;
  /**
   * Resolves the first defined ProseMirror-style view prop contributed by
   * installed plugins.
   *
   * @param propName - View prop name to read.
   * @returns First truthy prop value, or undefined when none is available.
   */
  someProp<PropName extends keyof QuireEditorProps>(
    propName: PropName
  ): NonNullable<QuireEditorProps[PropName]> | undefined;
  /**
   * Updates view-local direct props and refreshes this mounted view.
   *
   * @param props - ProseMirror-style view props to merge into this mounted view.
   */
  setProps(props: Partial<QuireEditorProps>): void;
  /**
   * Clears cached root information after the mounted view moves across DOM roots.
   */
  updateRoot(): void;
  /**
   * Refreshes this mounted view from the current shared editor state.
   *
   * @param state - ProseMirror state expected to be the editor's current state.
   */
  updateState(state: PMEditorState): void;
  /**
   * Switches hidden-text presentation without remounting the editor view.
   *
   * @param mode - Normal collapsed layout or formatting-inspection paint.
   */
  setHiddenTextViewMode(mode: QuireHiddenTextViewMode): void;
  /**
   * Clears host font metrics and refreshes layout after external font registration.
   *
   * @param options - Refresh policy; by default the refresh always relayouts.
   */
  refreshFontMetrics?(options?: QuireFontMetricsRefreshOptions): void;
  /**
   * Routes a DOM event through ProseMirror-style direct and plugin event props.
   *
   * @param event - DOM event to dispatch through mounted view handlers.
   * @returns Whether a handler consumed the event.
   */
  dispatchEvent(event: Event): boolean;
  /**
   * Runs the mounted view paste pipeline with an HTML payload.
   *
   * @param html - HTML clipboard payload to parse and paste.
   * @param event - Optional clipboard event that initiated the paste.
   * @returns Whether the paste was handled.
   */
  pasteHTML(html: string, event?: ClipboardEvent): boolean;
  /**
   * Runs the mounted view paste pipeline with plain text.
   *
   * @param text - Plain text clipboard payload to paste.
   * @param event - Optional clipboard event that initiated the paste.
   * @returns Whether the paste was handled.
   */
  pasteText(text: string, event?: ClipboardEvent): boolean;
  /**
   * Scrolls the current selection into view.
   *
   * @param options - Alignment and margin; omitted keeps the ProseMirror default of revealing the nearest edge.
   * @returns Whether scrolling was handled or a selection rectangle was available.
   */
  scrollToSelection(options?: QuireScrollIntoViewOptions): boolean;
  /**
   * Scrolls a document range into view without changing the selection.
   *
   * A range on a page that is not rendered yet first scrolls to that page, then
   * aligns precisely once the page renders.
   *
   * @param range - Document range to reveal.
   * @param options - Alignment and margin.
   * @returns Whether geometry for the range was found and scrolling started.
   */
  scrollRangeIntoView(range: { readonly from: number; readonly to: number }, options?: QuireScrollIntoViewOptions): boolean;
  /**
   * Serializes a slice using the mounted view clipboard pipeline.
   *
   * @param slice - Slice to serialize for external clipboard consumers.
   * @returns DOM, text, and transformed slice payloads.
   */
  serializeForClipboard(slice: Slice): {
    /** DOM wrapper containing serialized clipboard HTML. */
    readonly dom: HTMLElement;
    /** Plain text clipboard fallback. */
    readonly text: string;
    /** Slice after copy transforms have been applied. */
    readonly slice: Slice;
  };
  /**
   * Maps viewport coordinates to a document position.
   *
   * @param coords - Viewport coordinates in CSS pixels.
   * @returns Document position near the coordinates, or null when no position
   * is available.
   */
  posAtCoords(coords: {
    /** Viewport-left coordinate. */
    readonly left: number;
    /** Viewport-top coordinate. */
    readonly top: number;
  }): {
    /** Nearest document text position. */
    readonly pos: number;
    /** Inner node position containing the coordinates. */
    readonly inside: number;
    /** Exact retained floating-object source anchor, when an object owns the hit. */
    readonly objectPosition?: number | undefined;
  } | null;
  /**
   * Maps a document position to viewport coordinates.
   *
   * @param pos - Document position to map.
   * @param side - Side preference when the position sits between boxes.
   * @returns Viewport rectangle for the requested document position.
   */
  coordsAtPos(pos: number, side?: number): {
    /** Viewport-left coordinate. */
    readonly left: number;
    /** Viewport-right coordinate. */
    readonly right: number;
    /** Viewport-top coordinate. */
    readonly top: number;
    /** Viewport-bottom coordinate. */
    readonly bottom: number;
  };
  /**
   * Resolves one retained object anchor against the current committed snapshot.
   *
   * @param objectId - Stable object identity carried by the retained hit target.
   * @param occurrence - Optional exact target or repeated visual occurrence.
   * @returns Client-space object geometry or explicit stale/unsupported state.
   */
  getObjectAnchor?(
    objectId: string,
    occurrence?: QuireMountedObjectAnchorOccurrence
  ): QuireMountedObjectAnchorResolution;
  /**
   * Reads the realized textblock width at an inline insertion position.
   * @param position - Source document coordinate.
   * @param sourceDocument - Exact immutable source identity; stale geometry is rejected.
   * @returns Document CSS-pixel content width, or null when not realized.
   */
  getTextblockContentWidth?(position: number, sourceDocument: PMNode): number | null;
  /**
   * Resolves page-fragment-aware Table chrome through mounted geometry.
   *
   * @param tablePos - Absolute ProseMirror position immediately before the table.
   * @param activePosition - Canonical position used to choose the active visual occurrence.
   * @returns Viewport-projected Table chrome, or null when unavailable.
   */
  getTableChrome?(
    tablePos: number,
    activePosition: number
  ): QuireMountedTableChromeModel | null;
  /**
   * Reads the retained pointer target that currently owns command routing.
   *
   * @returns Clone-safe target snapshot, or null without retained ownership.
   */
  getInteractionTargetSnapshot(): QuireMountedInteractionTargetSnapshot | null;
  /**
   * Subscribes to committed mounted geometry revisions.
   *
   * @param listener - Callback invoked after retained geometry becomes authoritative.
   * @returns Release function for the subscription.
   */
  onGeometryUpdate?(
    listener: () => void
  ): () => void;
  /**
   * Reports whether movement would leave the current textblock.
   *
   * @param direction - Movement direction to test.
   * @returns Whether the selection sits at the textblock boundary.
   */
  endOfTextblock(
    direction: "up" | "down" | "left" | "right" | "forward" | "backward"
  ): boolean;
  /**
   * Reads virtual widget objects for the latest render result.
   *
   * @returns Widgets in compiler output order.
   */
  getWidgets(): readonly QuireViewWidget[];
  /**
   * Finds a widget by id.
   *
   * @param id - Widget id to search.
   * @returns Widget with the requested id, or undefined.
   */
  getWidgetById(id: string): QuireViewWidget | undefined;
  /**
   * Finds widgets with a semantic role.
   *
   * @param role - Role to search.
   * @returns Widgets with the requested role in compiler output order.
   */
  getWidgetsByRole(role: string): readonly QuireViewWidget[];
  /**
   * Finds widgets with a semantic part name.
   *
   * @param part - Part name to search.
   * @returns Widgets with the requested part in compiler output order.
   */
  getWidgetsByPart(part: string): readonly QuireViewWidget[];
  /**
   * Finds widgets whose document range contains a position.
   *
   * @param position - Document position to search.
   * @returns Widgets containing the position in compiler output order.
   */
  getWidgetsByPosition(position: number): readonly QuireViewWidget[];
  /**
   * Finds widgets whose document range overlaps another range.
   *
   * @param range - Document range to search.
   * @returns Widgets overlapping the range in compiler output order.
   */
  getWidgetsByRange(range: QuireCanvasDocumentRange): readonly QuireViewWidget[];
  /**
   * Hit-tests one renderer-space point against the latest widgets.
   *
   * @param point - Renderer-space point to test.
   * @returns Hit widget result, or null when no widget is hit.
   */
  widgetAtPoint(point: QuireCanvasPoint): QuireViewWidgetHit | null;
  /** Whether this mounted view has already been destroyed. */
  readonly isDestroyed: boolean;
  /**
   * Renders the latest shared editor state into this mounted view.
   *
   * @param options - Shared editor state and update reason.
   */
  update(options: QuireMountedEditorViewUpdateOptions): void;
  /**
   * Tears down event listeners and DOM owned by this mounted view.
   */
  destroy(): void;
}

/** Adapter that creates mounted views for one backend mode. */
export interface QuireViewAdapter {
  /** View mode handled by this adapter. */
  readonly mode: QuireViewMode;
  /**
   * Mounts a view instance into a consumer element.
   *
   * @param options - Editor state, mount element, identity, and runtime status.
   * @returns Mounted editor view instance.
   */
  mount(options: QuireMountedEditorViewOptions): QuireMountedEditorView;
}

/** Options used to mount an editor view surface. */
export interface QuireEditorMountOptions {
  /** Element supplied by the consumer as this editor view mount container. */
  readonly element: HTMLElement;
  /** View mode mounted into the element. */
  readonly mode: QuireViewMode;
  /** Optional stable view identity used for diagnostics. */
  readonly id?: string;
  /**
   * Whether an additional mounted view can edit the shared editor state.
   *
   * The first mounted view is the primary surface and follows editor-level
   * editability. Additional mounted views default to read-only previews.
   * Editable additional views update synchronously while focused; sibling views
   * refresh outside the input transaction.
   */
  readonly editable?: boolean | undefined;
  /** DOM document used to create child elements. */
  readonly ownerDocument?: Document | undefined;
}

/** Options used to switch the currently mounted primary view mode. */
export interface QuireEditorChangeModeOptions {
  /** Optional stable view identity for the replacement primary view. */
  readonly id?: string;
  /** DOM document used to create child elements. */
  readonly ownerDocument?: Document | undefined;
}

/** Tiptap-compatible editor event payload map. */
export interface EditorEvents {
  /** Emitted after the editor view is mounted. */
  mount: {
    /** Mounted editor instance. */
    editor: QuireEditor;
  };
  /** Emitted after the editor view is unmounted. */
  unmount: {
    /** Unmounted editor instance. */
    editor: QuireEditor;
  };
  /** Emitted before extension create hooks run. */
  beforeCreate: {
    /** Editor instance being created. */
    editor: QuireEditor;
  };
  /** Emitted after the editor is created. */
  create: {
    /** Created editor instance. */
    editor: QuireEditor;
  };
  /** Emitted when editor content cannot be parsed. */
  contentError: {
    /** Editor that encountered the content error. */
    editor: QuireEditor;
    /** Content parsing error. */
    error: Error;
    /** Disables collaboration before the editor is reinitialized. */
    disableCollaboration: () => void;
  };
  /** Emitted after editor content changes. */
  update: {
    /** Editor instance that applied the update. */
    editor: QuireEditor;
    /** Initial transaction that caused the update. */
    transaction: Transaction;
    /** Transactions appended by ProseMirror plugins. */
    appendedTransactions: Transaction[];
  };
  /** Emitted after the editor selection changes. */
  selectionUpdate: {
    /** Editor instance whose selection changed. */
    editor: QuireEditor;
    /** Transaction that caused the selection change. */
    transaction: Transaction;
  };
  /** Emitted before a transaction is applied. */
  beforeTransaction: {
    /** Editor instance about to apply the transaction. */
    editor: QuireEditor;
    /** Transaction about to be applied. */
    transaction: Transaction;
    /** State produced by applying the transaction. */
    nextState: PMEditorState;
  };
  /** Emitted after a transaction and its appended transactions are applied. */
  transaction: {
    /** Editor instance that applied the transaction. */
    editor: QuireEditor;
    /** Initial transaction that was dispatched. */
    transaction: Transaction;
    /** Transactions appended by ProseMirror plugins. */
    appendedTransactions: Transaction[];
  };
  /** Emitted when the editor receives focus. */
  focus: {
    /** Editor instance that received focus. */
    editor: QuireEditor;
    /** Native focus event. */
    event: FocusEvent;
    /** Transaction that recorded focus. */
    transaction: Transaction;
  };
  /** Emitted when the editor loses focus. */
  blur: {
    /** Editor instance that lost focus. */
    editor: QuireEditor;
    /** Native focus event. */
    event: FocusEvent;
    /** Transaction that recorded blur. */
    transaction: Transaction;
  };
  /** Emitted before the editor is destroyed. */
  destroy: void;
  /** Emitted when a mounted view handles paste. */
  paste: QuireEditorPasteEvent;
  /** Emitted when a mounted view handles drop. */
  drop: QuireEditorDropEvent;
  /** Emitted when the delete extension observes removed content. */
  delete: QuireEditorDeleteEvent;
}

/** Options for built-in Tiptap-compatible editor extensions. */
export interface CoreExtensionOptions {
  /** Plain-text clipboard serializer configuration. */
  clipboardTextSerializer?: {
    /** Text inserted between serialized block nodes. */
    blockSeparator?: string | undefined;
  } | undefined;
  /** Tab-index extension configuration. */
  tabindex?: {
    /** Value written to the editor's tabindex attribute. */
    value?: string | undefined;
  } | undefined;
  /** Delete-event extension configuration. */
  delete?: {
    /** Whether delete events are delivered asynchronously. */
    async?: boolean | undefined;
    /** Returns true when a transaction should be ignored by delete tracking. */
    filterTransaction?: ((transaction: Transaction) => boolean) | undefined;
  } | undefined;
}

/** Built-in extension names that can be disabled independently. */
export type CoreExtensionName =
  | "editable"
  | "clipboardTextSerializer"
  | "commands"
  | "focusEvents"
  | "keymap"
  | "tabindex"
  | "drop"
  | "paste"
  | "delete"
  | "textDirection";

/** Complete Tiptap-compatible editor option contract. */
export interface EditorOptions {
  /** Element, mount wrapper, or callback used to attach the DOM editor. */
  element: Element | { mount: HTMLElement } | ((editor: HTMLElement) => void) | null;
  /** Initial HTML or JSON content. */
  content: Content;
  /** Extensions installed into the editor. */
  extensions: QuireAnyExtension[];
  /** Whether Tiptap base CSS should be injected. */
  injectCSS: boolean;
  /** Optional CSP nonce used by injected CSS. */
  injectNonce: string | undefined;
  /** Initial focus target. */
  autofocus: FocusPosition;
  /** Whether the editor accepts editing input. */
  editable: boolean;
  /** Default text direction for editor content. */
  textDirection?: "ltr" | "rtl" | "auto" | undefined;
  /** Direct ProseMirror view props. */
  editorProps: PMEditorProps;
  /** Default options used while parsing content. */
  parseOptions: ParseOptions;
  /** Configuration for built-in extensions. */
  coreExtensionOptions?: CoreExtensionOptions | undefined;
  /** Whether input rules are enabled globally or for selected extensions. */
  enableInputRules: EnableRules;
  /** Whether paste rules are enabled globally or for selected extensions. */
  enablePasteRules: EnableRules;
  /** Whether built-in extensions are enabled. */
  enableCoreExtensions?: boolean | Partial<Record<CoreExtensionName, false>> | undefined;
  /** Whether invalid initial content is checked. */
  enableContentCheck: boolean;
  /** Whether invalid content emits an error when initial checking is disabled. */
  emitContentError: boolean;
  /** Called before extension create hooks run. */
  onBeforeCreate: (props: EditorEvents["beforeCreate"]) => void;
  /** Called after editor creation. */
  onCreate: (props: EditorEvents["create"]) => void;
  /** Called after mounting the editor view. */
  onMount: (props: EditorEvents["mount"]) => void;
  /** Called after unmounting the editor view. */
  onUnmount: (props: EditorEvents["unmount"]) => void;
  /** Called when content parsing fails. */
  onContentError: (props: EditorEvents["contentError"]) => void;
  /** Called after editor content changes. */
  onUpdate: (props: EditorEvents["update"]) => void;
  /** Called after the editor selection changes. */
  onSelectionUpdate: (props: EditorEvents["selectionUpdate"]) => void;
  /** Called after a transaction is applied. */
  onTransaction: (props: EditorEvents["transaction"]) => void;
  /** Called when the editor receives focus. */
  onFocus: (props: EditorEvents["focus"]) => void;
  /** Called when the editor loses focus. */
  onBlur: (props: EditorEvents["blur"]) => void;
  /** Called before the editor is destroyed. */
  onDestroy: (props: EditorEvents["destroy"]) => void;
  /** Called when content is pasted into the editor. */
  onPaste: (event: ClipboardEvent, slice: Slice) => void;
  /** Called when content is dropped into the editor. */
  onDrop: (event: DragEvent, slice: Slice, moved: boolean) => void;
  /** Called when editor content is deleted. */
  onDelete: (props: EditorEvents["delete"]) => void;
  /** Whether extensions can intercept transaction dispatch. */
  enableExtensionDispatchTransaction?: boolean | undefined;
}

/** Base payload for editor events. */
export interface QuireEditorEventPayload {
  /** Editor instance that emitted the event. */
  readonly editor: QuireEditor;
}

/** Payload emitted before a transaction is applied. */
export interface QuireEditorBeforeTransactionEvent extends QuireEditorEventPayload {
  /** Transaction about to be applied. */
  readonly transaction: Transaction;
  /** State produced by applying the initial transaction. */
  readonly nextState: PMEditorState;
}

/** Payload emitted after a transaction is applied. */
export interface QuireEditorTransactionEvent extends QuireEditorEventPayload {
  /** Initial transaction that was applied. */
  readonly transaction: Transaction;
  /** Transactions appended by ProseMirror plugins. */
  readonly appendedTransactions: Transaction[];
}

/** Payload emitted when the editor receives focus. */
export interface QuireEditorFocusEvent extends QuireEditorEventPayload {
  /** Native focus event supplied by the view. */
  readonly event: FocusEvent;
  /** Transaction that carried the focus metadata. */
  readonly transaction: Transaction;
}

/** Payload emitted when the editor loses focus. */
export interface QuireEditorBlurEvent extends QuireEditorEventPayload {
  /** Native focus event supplied by the view. */
  readonly event: FocusEvent;
  /** Transaction that carried the blur metadata. */
  readonly transaction: Transaction;
}

/** Payload emitted when pasted content is handled by a view runtime. */
export interface QuireEditorPasteEvent extends QuireEditorEventPayload {
  /** Native clipboard event that initiated the paste. */
  readonly event: ClipboardEvent;
  /** ProseMirror slice parsed from the pasted content. */
  readonly slice: Slice;
}

/** Payload emitted when dropped content is handled by a view runtime. */
export interface QuireEditorDropEvent extends QuireEditorEventPayload {
  /** Native drag event that initiated the drop. */
  readonly event: DragEvent;
  /** ProseMirror slice parsed from the dropped content. */
  readonly slice: Slice;
  /** Whether the drop moved an existing editor selection. */
  readonly moved: boolean;
}

/** Node deletion payload emitted by the Tiptap-compatible delete extension. */
export interface QuireEditorNodeDeleteEvent extends QuireEditorEventPayload {
  /** Discriminator for deleted node payloads. */
  readonly type: "node";
  /** Deleted node. */
  readonly node: PMNode;
  /** Old start position of the deleted node content. */
  readonly from: number;
  /** Old end position of the deleted node content. */
  readonly to: number;
  /** Mapped start position after deletion. */
  readonly newFrom: number;
  /** Mapped end position after deletion. */
  readonly newTo: number;
  /** Old document range that was deleted. */
  readonly deletedRange: QuireRange;
  /** New document range after deletion. */
  readonly newRange: QuireRange;
  /** Whether only part of the node was deleted. */
  readonly partial: boolean;
  /** Transaction that initiated the deletion. */
  readonly transaction: Transaction;
  /** Combined transform containing the primary and appended transactions. */
  readonly combinedTransform: Transform;
}

/** Mark deletion payload emitted by the Tiptap-compatible delete extension. */
export interface QuireEditorMarkDeleteEvent extends QuireEditorEventPayload {
  /** Discriminator for deleted mark payloads. */
  readonly type: "mark";
  /** Removed mark. */
  readonly mark: PMMark;
  /** Old start position of the removed mark step. */
  readonly from: number;
  /** Old end position of the removed mark step. */
  readonly to: number;
  /** Old document range that lost the mark. */
  readonly deletedRange: QuireRange;
  /** New document range after mark removal. */
  readonly newRange: QuireRange;
  /** Whether the removed mark continues adjacent to the changed range. */
  readonly partial: boolean;
  /** Transaction that initiated the deletion. */
  readonly transaction: Transaction;
  /** Combined transform containing the primary and appended transactions. */
  readonly combinedTransform: Transform;
}

/** Payload emitted when content or marks are deleted. */
export type QuireEditorDeleteEvent =
  | QuireEditorNodeDeleteEvent
  | QuireEditorMarkDeleteEvent;

/** Payload emitted after the document or selection changes. */
export interface QuireEditorUpdateEvent extends QuireEditorEventPayload {
  /** Previous editor state snapshot. */
  readonly previousState: QuireEditorState;
  /** Initial transaction that caused the update. */
  readonly transaction: Transaction;
  /** Transactions appended by ProseMirror plugins. */
  readonly appendedTransactions: Transaction[];
}

/** Payload emitted after the selection changes. */
export interface QuireEditorSelectionUpdateEvent extends QuireEditorUpdateEvent {
  /** Transaction that caused the selection change. */
  readonly transaction: Transaction;
}

/** Editor events exposed through Tiptap-compatible event methods. */
export interface QuireEditorEvents {
  /** Emitted after the primary editor view is mounted. */
  readonly mount: EditorEvents["mount"];
  /** Emitted after the primary editor view is unmounted. */
  readonly unmount: EditorEvents["unmount"];
  /** Emitted after options are registered and before create hooks run. */
  readonly beforeCreate: QuireEditorEventPayload;
  /** Emitted after the editor has created its initial state. */
  readonly create: QuireEditorEventPayload;
  /** Emitted when editor content cannot be parsed. */
  readonly contentError: EditorEvents["contentError"];
  /** Emitted before a transaction is applied. */
  readonly beforeTransaction: QuireEditorBeforeTransactionEvent;
  /** Emitted after a transaction is applied. */
  readonly transaction: QuireEditorTransactionEvent;
  /** Emitted after the selection changes. */
  readonly selectionUpdate: QuireEditorSelectionUpdateEvent;
  /** Emitted when the editor receives focus. */
  readonly focus: QuireEditorFocusEvent;
  /** Emitted when the editor loses focus. */
  readonly blur: QuireEditorBlurEvent;
  /** Emitted when a view runtime handles paste. */
  readonly paste: QuireEditorPasteEvent;
  /** Input-owned result, including refused transactions that cannot emit update. */
  readonly clipboardPasteResult: QuireClipboardPasteResult;
  /** Emitted when a view runtime handles drop. */
  readonly drop: QuireEditorDropEvent;
  /** Emitted when the delete extension observes removed content. */
  readonly delete: QuireEditorDeleteEvent;
  /** Emitted after document or selection state changes. */
  readonly update: QuireEditorUpdateEvent;
  /** Emitted before the editor is destroyed. */
  readonly destroy: void;
}

/** Outcome of the shared clipboard transaction, not a second mutation protocol. */
export interface QuireClipboardPasteResult extends QuireEditorEventPayload {
  /** Whether the prepared transaction entered editor state. */
  readonly status: "applied" | "rejected";
  /** Input refusal class; feature-specific details remain in transaction metadata. */
  readonly reason: "prevent-dispatch" | "filtered" | null;
  /** Prepared transaction, never to be dispatched by result listeners. */
  readonly transaction: Transaction;
}

/** Editor event callback map used by editor creation options. */
export type QuireEditorEventCallbacks = Omit<{
  /** Event callback registered through an `onX` editor option. */
  readonly [EventName in keyof QuireEditorEvents as `on${Capitalize<string & EventName>}`]?:
    (event: QuireEditorEvents[EventName]) => void;
}, "onPaste" | "onDrop"> & {
  /** Called when content is pasted into the editor. */
  readonly onPaste?: ((event: ClipboardEvent, slice: Slice) => void) | undefined;
  /** Called when content is dropped into the editor. */
  readonly onDrop?: ((event: DragEvent, slice: Slice, moved: boolean) => void) | undefined;
};

/** Diagnostic emitted by the DOCX Manager owned by one Quire editor. */
export type QuireDocxManagerDiagnosticEvent = DocxManagerDiagnosticEvent;

/**
 * DOCX Manager configuration accepted by a Quire editor.
 *
 * Contribution entries and the JSON model adapter remain Core-owned so every
 * extension participates in the same deterministic instance registry.
 */
export type QuireDocxManagerOptions = Omit<
  DocxManagerOptions<
    QuireJSONContent,
    NonNullable<QuireJSONContent["marks"]>[number],
    QuireJSONContent
  >,
  "entries" | "adapter"
>;

/** Options used to create a QuireKit editor instance. */
export interface QuireEditorOptions extends QuireEditorEventCallbacks {
  /** Initial editor content as a ProseMirror document or JSON document. */
  readonly content?: QuireEditorContent;
  /** Explicit content type for initial string content. */
  readonly contentType?: QuireMarkdownContentType | undefined;
  /** Markdown parser and serializer options used by markdown content APIs. */
  readonly markdown?: QuireMarkdownManagerOptions | undefined;
  /** Instance-owned DOCX defaults, runtime loader, and diagnostic listener. */
  readonly docx?: QuireDocxManagerOptions | undefined;
  /** Schema used to create the default document when content is omitted. */
  readonly schema?: Schema;
  /** Direct ProseMirror-style view props applied before plugin props. */
  readonly editorProps?: QuireEditorProps | undefined;
  /** Default options used while parsing editor content. */
  readonly parseOptions?: ParseOptions | undefined;
  /** Initial focus target applied after mounting. */
  readonly autofocus?: FocusPosition | undefined;
  /** Whether the editor should accept editing input. */
  readonly editable?: boolean | undefined;
  /** Default text direction for editor content. */
  readonly textDirection?: "ltr" | "rtl" | "auto" | undefined;
  /** Whether Tiptap-compatible base CSS should be injected. */
  readonly injectCSS?: boolean | undefined;
  /** Optional CSP nonce used by injected CSS. */
  readonly injectNonce?: string | undefined;
  /** Configuration forwarded to built-in extensions. */
  readonly coreExtensionOptions?: CoreExtensionOptions | undefined;
  /** Whether built-in extensions are enabled. */
  readonly enableCoreExtensions?:
    | boolean
    | Partial<Record<CoreExtensionName, false>>
    | undefined;
  /** Whether initial content should be validated strictly. */
  readonly enableContentCheck?: boolean | undefined;
  /** Whether invalid initial content should emit a contentError event. */
  readonly emitContentError?: boolean | undefined;
  /** Whether extensions can intercept transaction dispatch. */
  readonly enableExtensionDispatchTransaction?: boolean | undefined;
  /** Whether input rules are enabled globally or for specific extensions. */
  readonly enableInputRules?: QuireEnableRules | undefined;
  /** Whether paste rules are enabled globally or for specific extensions. */
  readonly enablePasteRules?: QuireEnableRules | undefined;
  /** Extensions installed into the editor. */
  readonly extensions?: readonly QuireAnyExtension[];
  /** Element, mount wrapper, callback, or null used for the primary view. */
  readonly element?:
    | Element
    | { readonly mount: HTMLElement }
    | ((editor: HTMLElement) => void)
    | null
    | undefined;
  /** View mode mounted into `element`. */
  readonly mode?: QuireViewMode;
  /** Optional stable identity for the primary mounted view. */
  readonly viewId?: string;
}

/** Options accepted by Tiptap-compatible text export helpers. */
export interface QuireGetTextOptions {
  /** Text inserted between block nodes. */
  readonly blockSeparator?: string | undefined;
  /** Node-type-specific text serializers. */
  readonly textSerializers?: Readonly<Record<string, QuireTextSerializer>> | undefined;
  /** Text returned for leaf nodes without text content. */
  readonly leafText?: string | undefined;
}

/** Serializable editor state owned by the core package. */
export interface QuireEditorState {
  /** Current ProseMirror editor state. */
  readonly pm: PMEditorState;
  /** Current ProseMirror document. */
  readonly doc: PMNode;
  /** Schema associated with the current document. */
  readonly schema: Schema;
  /** Extensions installed into the editor in execution order. */
  readonly extensions: readonly QuireAnyExtension[];
  /** Storage objects keyed by extension name. */
  readonly storage: Readonly<Record<string, unknown>>;
}

/** Where a revealed target sits in the visible area, as in `Element.scrollIntoView`. */
export type QuireScrollBlock = "nearest" | "start" | "center" | "end";

/** Alignment and spacing for scrolling a target into view. */
export interface QuireScrollIntoViewOptions {
  /** Vertical alignment; `nearest` leaves a visible target in place. Defaults to `nearest`. */
  readonly block?: QuireScrollBlock | undefined;
  /** Space kept between the target and the edge of the visible area, in CSS pixels. */
  readonly margin?: number | undefined;
}
