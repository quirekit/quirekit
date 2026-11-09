/** Model-independent LitAST mark exposed at the public conversion boundary. */
export interface LitAstMark {
  /** Stable semantic mark type. */
  readonly type: string;
  /** Optional JSON-safe semantic attributes. */
  readonly attrs?: Readonly<Record<string, unknown>> | undefined;
}

/** Model-independent LitAST node exposed at the public conversion boundary. */
export interface LitAstNode {
  /** Stable semantic node type. */
  readonly type: string;
  /** Optional nested semantic children in document order. */
  readonly children?: readonly LitAstNode[] | undefined;
  /** Optional JSON-safe semantic attributes. */
  readonly attrs?: Readonly<Record<string, unknown>> | undefined;
  /** Optional inline marks. */
  readonly marks?: readonly LitAstMark[] | undefined;
  /** Optional text value for text nodes. */
  readonly text?: string | undefined;
  /** Optional preserved XML fragment governed by the conversion loss policy. */
  readonly rawXml?: string | undefined;
  /** Optional JSON-safe parser and package metadata. */
  readonly meta?: Readonly<Record<string, unknown>> | undefined;
}

/** Table-family property-history owners represented by semantic LitAST. */
export type LitAstTablePropertyRevisionKind =
  | "table-properties"
  | "table-grid"
  | "row-properties"
  | "row-table-property-exceptions"
  | "cell-properties";

/** One reversible table-family property snapshot parsed from OOXML. */
export interface LitAstTablePropertyRevision {
  /** Property container that owns the revision. */
  readonly kind: LitAstTablePropertyRevisionKind;
  /** Producer `w:id`; semantic parsing rejects a missing identifier. */
  readonly sourceId: string;
  /** Producer `w:author`, or null for markup-only grid revisions. */
  readonly reviewerName: string | null;
  /** Producer `w:date`, or null when omitted or unsupported by the carrier. */
  readonly createdAt: string | null;
  /** Complete modeled prior direct properties nested inside the change envelope. */
  readonly previousProperties: Readonly<Record<string, unknown>>;
}

/** Row-structure revision directions represented by semantic LitAST. */
export type LitAstTableRowStructuralRevisionKind =
  | "row-insertion"
  | "row-deletion";

/** One complete tracked row action parsed from row and cell OOXML markers. */
export interface LitAstTableRowStructuralRevision {
  /** Whether the current row is pending insertion or deletion. */
  readonly kind: LitAstTableRowStructuralRevisionKind;
  /** Producer `w:id` shared by the row marker and every cell marker. */
  readonly sourceId: string;
  /** Producer `w:author` shared by the complete marker set. */
  readonly reviewerName: string;
  /** Producer `w:date`, or null when omitted on every member. */
  readonly createdAt: string | null;
  /** Number of explicit cells whose matching marker completed the atomic set. */
  readonly cellCount: number;
}

/** Cell-marker directions represented by semantic LitAST. */
export type LitAstTableCellStructuralRevisionKind =
  | "cell-insertion"
  | "cell-deletion"
  | "cell-merge"
  | "cell-horizontal-merge";

/** One isolated-cell or complete column action parsed from cell/grid markup. */
export interface LitAstTableCellInsertDeleteStructuralRevision {
  /** Whether the current cell is pending insertion or deletion. */
  readonly kind: "cell-insertion" | "cell-deletion";
  /** Producer `w:id` shared by all proven action members. */
  readonly sourceId: string;
  /** Producer `w:author` shared by all proven action members. */
  readonly reviewerName: string;
  /** Producer `w:date`, or null when omitted. */
  readonly createdAt: string | null;
  /** Isolated cell or complete grid-aligned column scope. */
  readonly structuralScope: "cell" | "column";
  /** Number of cell members in the proven logical action. */
  readonly memberCount: number;
  /** First affected grid column. */
  readonly gridFrom: number;
  /** Positive affected grid-column count. */
  readonly gridSpan: number;
  /** Exact table row count used for rectangular proof. */
  readonly tableRowCount: number;
  /** Grid widths before the action. */
  readonly beforeColumns: readonly number[];
  /** Grid widths after the action. */
  readonly afterColumns: readonly number[];
}

/** One role in a tracked vertical-merge chain. */
export type LitAstTableVerticalMergeRole = "restart" | "continue" | null;

/** One direct member of a complete tracked vertical merge or split. */
export interface LitAstTableCellMergeStructuralRevision {
  /** Fixed vertical-merge structural operation. */
  readonly kind: "cell-merge";
  /** Producer `w:id` shared by every proven chain member. */
  readonly sourceId: string;
  /** Producer `w:author` shared by every proven chain member. */
  readonly reviewerName: string;
  /** Producer `w:date`, or null when omitted. */
  readonly createdAt: string | null;
  /** Fixed vertical-merge chain scope. */
  readonly structuralScope: "vertical-merge";
  /** Number of direct cells in the proven chain. */
  readonly memberCount: number;
  /** Zero-based member index in row order. */
  readonly memberIndex: number;
  /** First affected grid column. */
  readonly gridFrom: number;
  /** Positive shared grid-column count. */
  readonly gridSpan: number;
  /** Exact table row count used for stale-state validation. */
  readonly tableRowCount: number;
  /** Complete merge-role vector before the tracked operation. */
  readonly beforeMergeRoles: readonly LitAstTableVerticalMergeRole[];
  /** Complete current merge-role vector after the tracked operation. */
  readonly afterMergeRoles: readonly LitAstTableVerticalMergeRole[];
}

/** One direct member of Word's horizontal merge insertion/deletion convention. */
export interface LitAstTableCellHorizontalMergeStructuralRevision {
  /** Fixed horizontal-merge structural operation. */
  readonly kind: "cell-horizontal-merge";
  /** Producer `w:id` shared by the origin and absorbed members. */
  readonly sourceId: string;
  /** Producer `w:author` shared by every member. */
  readonly reviewerName: string;
  /** Producer `w:date`, or null when omitted. */
  readonly createdAt: string | null;
  /** Fixed single-row fragment scope. */
  readonly structuralScope: "horizontal-merge";
  /** Number of current explicit cells in the complete fragment. */
  readonly memberCount: number;
  /** Zero-based member index in direct row order. */
  readonly memberIndex: number;
  /** Standard marker role for this member. */
  readonly memberRole: "origin" | "absorbed";
  /** Direct row containing the fragment. */
  readonly rowIndex: number;
  /** First affected grid column. */
  readonly gridFrom: number;
  /** Positive complete grid-column span. */
  readonly gridSpan: number;
  /** Exact table row count used for stale-state validation. */
  readonly tableRowCount: number;
}

/** One direct member of Word's horizontal split deletion/insertion convention. */
export interface LitAstTableCellHorizontalSplitStructuralRevision {
  /** Fixed horizontal-split structural operation. */
  readonly kind: "cell-horizontal-split";
  /** Producer `w:id` shared by the origin and created members. */
  readonly sourceId: string;
  /** Producer `w:author` shared by every member. */
  readonly reviewerName: string;
  /** Producer `w:date`, or null when omitted. */
  readonly createdAt: string | null;
  /** Fixed single-row fragment scope. */
  readonly structuralScope: "horizontal-merge";
  /** Number of current explicit cells in the complete fragment. */
  readonly memberCount: number;
  /** Zero-based member index in direct row order. */
  readonly memberIndex: number;
  /** Standard marker role for this member. */
  readonly memberRole: "origin" | "created";
  /** Direct row containing the fragment. */
  readonly rowIndex: number;
  /** First affected grid column. */
  readonly gridFrom: number;
  /** Positive complete grid-column span. */
  readonly gridSpan: number;
  /** Exact table row count used for stale-state validation. */
  readonly tableRowCount: number;
}

/** One admitted isolated-cell, column, or vertical-merge action. */
export type LitAstTableCellStructuralRevision =
  | LitAstTableCellInsertDeleteStructuralRevision
  | LitAstTableCellMergeStructuralRevision
  | LitAstTableCellHorizontalMergeStructuralRevision
  | LitAstTableCellHorizontalSplitStructuralRevision;

/** OOXML document-protection editing modes from `ST_DocProtect`. */
export type LitAstDocumentProtectionEdit =
  | "comments"
  | "forms"
  | "none"
  | "readOnly"
  | "trackedChanges";

/** Complete modeled `w:documentProtection` attribute set. */
export interface LitAstDocumentProtection {
  /** Restriction mode applied when enforcement is enabled. */
  readonly edit?: LitAstDocumentProtectionEdit | undefined;
  /** Whether formatting changes are restricted. */
  readonly formatting?: boolean | undefined;
  /** Whether the declared protection policy is active. */
  readonly enforcement?: boolean | undefined;
  /** Named hash algorithm used by modern producers. */
  readonly algorithmName?: string | undefined;
  /** Password-verifier hash encoded by the producer. */
  readonly hash?: string | undefined;
  /** Password-verifier salt encoded by the producer. */
  readonly salt?: string | undefined;
  /** Number of password-verifier hashing iterations. */
  readonly cryptSpinCount?: number | undefined;
  /** Extended algorithm identifier. */
  readonly algIdExt?: string | undefined;
  /** Producer associated with the extended algorithm identifier. */
  readonly algIdExtSource?: string | undefined;
  /** Cryptographic algorithm class. */
  readonly cryptAlgorithmClass?: string | undefined;
  /** Numeric cryptographic algorithm identifier. */
  readonly cryptAlgorithmSid?: number | undefined;
  /** Cryptographic algorithm type. */
  readonly cryptAlgorithmType?: string | undefined;
  /** Named cryptographic provider. */
  readonly cryptProvider?: string | undefined;
  /** Cryptographic provider type. */
  readonly cryptProviderType?: string | undefined;
  /** Extended cryptographic provider type identifier. */
  readonly cryptProviderTypeExt?: string | undefined;
  /** Producer associated with the extended provider type. */
  readonly cryptProviderTypeExtSource?: string | undefined;
}

/** Model-independent document settings preserved by LitAST. */
export interface LitAstDocumentSettings {
  /** Whether justified soft-break lines retain natural spacing. */
  readonly doNotExpandShiftReturn?: boolean | undefined;
  /** Whether subsequent document edits should be recorded as revisions. */
  readonly trackRevisions?: boolean | undefined;
  /** Revision categories selected for display, or null when explicitly cleared. */
  readonly revisionView?: LitAstRevisionView | null | undefined;
  /** Whether move operations must be tracked as ordinary insertions/deletions. */
  readonly doNotTrackMoves?: boolean | undefined;
  /** Whether formatting-only edits must remain outside tracked revisions. */
  readonly doNotTrackFormatting?: boolean | undefined;
  /** Whether facing pages use mirrored inside/outside margins. */
  readonly mirrorMargins?: boolean | undefined;
  /** Whether distinct even-page header/footer variants are enabled. */
  readonly evenAndOddHeaders?: boolean | undefined;
  /** Canonical document-protection policy, or null when explicitly cleared. */
  readonly documentProtection?: LitAstDocumentProtection | null | undefined;
  /** Other JSON-safe document settings. */
  readonly [name: string]: unknown;
}

/** Modeled visibility switches from the WordprocessingML revision view. */
export interface LitAstRevisionView {
  /** Whether revision markup is visible. */
  readonly markup?: boolean | undefined;
  /** Whether comment markup is visible. */
  readonly comments?: boolean | undefined;
  /** Whether insertion and deletion markup is visible. */
  readonly insertionsAndDeletions?: boolean | undefined;
  /** Whether formatting revision markup is visible. */
  readonly formatting?: boolean | undefined;
  /** Whether ink annotation markup is visible. */
  readonly inkAnnotations?: boolean | undefined;
}

/** Model-independent metadata carried by a LitAST document root. */
export interface LitAstDocumentMetadata {
  /** Parsed or authored document settings. */
  readonly settings?: LitAstDocumentSettings | undefined;
  /** Other JSON-safe package metadata. */
  readonly [name: string]: unknown;
}

/** Canonical LitAST document root. */
export interface LitAstDocumentNode extends LitAstNode {
  /** Fixed document discriminator. */
  readonly type: "document";
  /** Document-level settings and package metadata. */
  readonly meta?: LitAstDocumentMetadata | undefined;
}

/** Canonical LitAST section node. */
export interface LitAstSectionNode extends LitAstNode {
  /** Fixed section discriminator. */
  readonly type: "section";
}

/** Header/footer variant represented by LitAST story nodes. */
export type LitAstHeaderFooterVariant = "default" | "first" | "even";

/** Canonical LitAST header story node. */
export interface LitAstHeaderNode extends LitAstNode {
  /** Fixed header discriminator. */
  readonly type: "header";
  /** Story variant and optional adapter-owned stable identity. */
  readonly attrs: Readonly<Record<string, unknown>> & {
    /** Header story variant. */
    readonly headerType: LitAstHeaderFooterVariant;
    /** Optional adapter-owned stable story identity. */
    readonly storyId?: string | undefined;
  };
}

/** Canonical LitAST footer story node. */
export interface LitAstFooterNode extends LitAstNode {
  /** Fixed footer discriminator. */
  readonly type: "footer";
  /** Story variant and optional adapter-owned stable identity. */
  readonly attrs: Readonly<Record<string, unknown>> & {
    /** Footer story variant. */
    readonly footerType: LitAstHeaderFooterVariant;
    /** Optional adapter-owned stable story identity. */
    readonly storyId?: string | undefined;
  };
}

/** Canonical LitAST text-box node. */
export interface LitAstTextBoxNode extends LitAstNode {
  /** Fixed text-box discriminator. */
  readonly type: "textBox";
  /** Optional rich block content. */
  readonly children?: readonly LitAstNode[] | undefined;
  /** Optional logical chain; only its first frame owns author content. */
  readonly attrs?: Readonly<Record<string, unknown>> & {
    /** Shared flow identity and this frame's order, without cached pagination fragments. */
    readonly textBoxLink?: import('./textbox/types.js').LitAstTextBoxLink | undefined;
  };
}

/** Normalized Picture source rectangle expressed as edge fractions. */
export interface LitAstImageSourceCrop {
  /** Positive top inset or negative top outset. */
  readonly top: number;
  /** Positive right inset or negative right outset. */
  readonly right: number;
  /** Positive bottom inset or negative bottom outset. */
  readonly bottom: number;
  /** Positive left inset or negative left outset. */
  readonly left: number;
}

/** Picture-local transform and aspect-lock intent. */
export interface LitAstImagePictureTransform {
  /** Clockwise rotation in degrees. */
  readonly rotation: number;
  /** Whether the Picture is mirrored across its vertical axis. */
  readonly flipHorizontal: boolean;
  /** Whether the Picture is mirrored across its horizontal axis. */
  readonly flipVertical: boolean;
  /** Whether Picture manipulation preserves its authored aspect ratio. */
  readonly lockAspectRatio: boolean;
}

/** Semantic external click hyperlink carried by one Picture. */
export interface LitAstImageClickHyperlink {
  /** Canonical external HTTP or HTTPS target. */
  readonly href: string;
  /** Optional user-visible hover tooltip. */
  readonly tooltip: string | null;
}

/** Semantic movement policy derived from an image's two positioning references. */
export type LitAstImageAnchorMovement = "move-with-text" | "fixed-on-page";

/** Public semantic attributes carried by one LitAST image. */
export interface LitAstImageAttrs {
  /** Other JSON-safe image source, geometry, placement, or producer metadata. */
  readonly [name: string]: unknown;
  /** Complete normalized crop, null for malformed source evidence, or absent in compatible runtimes. */
  readonly sourceCrop?: LitAstImageSourceCrop | null | undefined;
  /** Complete Picture transform, null for malformed source evidence, or absent in compatible runtimes. */
  readonly pictureTransform?: LitAstImagePictureTransform | null | undefined;
  /** Reconciled Picture click hyperlink, null for conflicting source evidence. */
  readonly clickHyperlink?: LitAstImageClickHyperlink | null | undefined;
  /** Semantic anchored movement; fixed placement requires two page-relative positions. */
  readonly anchorMovement?: LitAstImageAnchorMovement | undefined;
}

/** Canonical LitAST image node. */
export interface LitAstImageNode extends LitAstNode {
  /** Fixed image discriminator. */
  readonly type: "image";
  /** Source, authored geometry, placement, and producer metadata. */
  readonly attrs: LitAstImageAttrs;
  /** Images are leaf nodes and never own rich content. */
  readonly children?: undefined;
}
