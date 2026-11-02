import type { MsfeEditor, MsfeImageSourceResolver, MsfeSourceRange, SourceBlock } from "@quirekit/msfe-core";
import type { WhiteboardActionsMount, WhiteboardDocument, WhiteboardEditRequest } from "@quirekit/whiteboard";
/** Product-neutral task composition. */
export interface MsfeWhiteboardOptions {
  /** @param request - Mapped source task. @param editor - Owning source editor. @returns Disposable UI. */
  readonly open: ((request: WhiteboardEditRequest, editor: MsfeEditor) => { close(): void }) | null;
  /** Maps stored preview addresses, such as document-relative paths, to displayable ones; omitted uses them directly. */
  readonly resolve?: MsfeImageSourceResolver;
  /** Product title dialog using the same source transaction. */ readonly rename?: MsfeWhiteboardOptions["open"];
  /** Product controls for the active static preview. */ readonly mountActions?: WhiteboardActionsMount<HTMLElement>;
}
/** Source codec attributes. */
export interface MsfeWhiteboardAttributes {
  /** Validated editable source and its matching preview. */ readonly board: WhiteboardDocument;
}
/** Static block projection inputs. */
export interface MsfeWhiteboardPreviewProps extends MsfeWhiteboardAttributes {
  /** Current mapped source location. */ readonly range: MsfeSourceRange;
  /** Parent editor's read permission. */ readonly readOnly: boolean;
}
/** An admitted complete sibling block or leading whitespace insertion point. */
export interface WhiteboardInsertionTarget extends MsfeSourceRange {
  /** Neighbor owning syntax; null only before the first non-whitespace source. */
  readonly block: SourceBlock | null;
}
/** Identity guard for asynchronous programmatic edits. */
export interface MsfeWhiteboardDiagramTarget {
  /** Whiteboard identity read from canonical source. */ readonly id: string;
  /** Expected revision, preventing overwrite of concurrent edits. */ readonly revision: number;
}
