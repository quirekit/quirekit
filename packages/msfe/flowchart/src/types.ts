import type { MsfeEditor, MsfeImageSourceResolver, MsfeSourceRange, SourceBlock } from "@quirekit/msfe-core";
import type { FlowchartEmbed, FlowchartEditRequest } from "@quirekit/flowchart";
/** Product-neutral task composition. */
export interface MsfeFlowchartOptions {
  /** @param request - Mapped source task. @param editor - Owning source editor. @returns Disposable UI. */
  readonly open: ((request: FlowchartEditRequest, editor: MsfeEditor) => { close(): void }) | null;
  /** Maps stored preview addresses, such as document-relative paths, to displayable ones; omitted uses them directly. */
  readonly resolve?: MsfeImageSourceResolver;
}
/** Source codec attributes. */
export interface MsfeFlowchartAttributes {
  /** Validated editable source and its matching preview. */ readonly flow: FlowchartEmbed;
}
/** Static block projection inputs. */
export interface MsfeFlowchartPreviewProps extends MsfeFlowchartAttributes {
  /** Current mapped source location. */ readonly range: MsfeSourceRange;
  /** Parent editor's read permission. */ readonly readOnly: boolean;
}
/** An admitted complete sibling block or leading whitespace insertion point. */
export interface FlowchartInsertionTarget extends MsfeSourceRange {
  /** Neighbor owning syntax; null only before the first non-whitespace source. */
  readonly block: SourceBlock | null;
}
