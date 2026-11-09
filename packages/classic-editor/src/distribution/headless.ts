import "../plugin/augmentation";

export { defineClassicEditorPlugin } from "../plugin/define";
export {
  buildClassicEditorFixedLayoutFrame,
  ClassicEditorFixedLayoutFrameError,
  defaultClassicEditorFixedLayoutPageGeometry,
  resolveClassicEditorFixedLayoutGeometry,
  tryCreateClassicEditorDetachedCanvasTextMeasurer
} from "../export-support";
export {
  classicEditorDocumentServiceReportEvent
} from "../service/events";
export type {
  ClassicEditorDocumentServiceDiagnostic,
  ClassicEditorDocumentServiceReportDetail,
  ClassicEditorDocumentServiceWarning
} from "../service/events";
export type {
  BuildClassicEditorFixedLayoutFrameOptions,
  ClassicEditorFixedLayoutFrame,
  ClassicEditorFixedLayoutFrameErrorCode,
  ClassicEditorFixedLayoutFramePage,
  ClassicEditorFixedLayoutGeometry
} from "../export-support";
export type {
  ClassicEditorPlugin,
  ClassicEditorMountedRenderable,
  ClassicEditorRenderContext,
  ClassicEditorServiceContext,
  ClassicEditorImportContext,
  ClassicEditorImportOptions
} from "../types";
