import { describe, expect, expectTypeOf, it } from "vitest";
import {
  createEditorUIBlockDropIndicator,
  defaultEditorUIDragThreshold,
  DragSession,
  hasExceededEditorUIDragThreshold,
  NodeRangeSelection,
  projectEditorUIAnchorGeometry,
  resolveEditorUIBlockDragAutoScrollDecision,
  resolveEditorUIBlockDropPlacement,
  resolveEditorUIBlockDropTarget,
  resolveEditorUIDragThreshold,
  resolveEditorUIAnchorGeometry,
  SuggestionController
} from "./index";
import type {
  CreateEditorUINodeRangeSelectionOptions,
  EditorUIBlockDragAutoScrollDecision,
  EditorUIBlockDropPayloadFacts,
  EditorUIBlockDropPolicy,
  EditorUIBlockDropTargetResolution,
  EditorUIBlockFlowAxis,
  EditorUIDragArmInput,
  EditorUIDragArmResult,
  EditorUIDragAutoScrollDecision,
  EditorUIDragAutoScrollEdge,
  EditorUIDragCancelReason,
  EditorUIDragDropResult,
  EditorUIDragIndicator,
  EditorUIDragPlacement,
  EditorUIDragPoint,
  EditorUIDragReadyTarget,
  EditorUIDragRejectedTarget,
  EditorUIDragRemapResult,
  EditorUIDragSessionPorts,
  EditorUIDragSessionState,
  EditorUIDragSource,
  EditorUIDragSourceRemapInput,
  EditorUIDragTargetRejectionReason,
  EditorUIDragTargetResolution,
  EditorUIDragTargetResolverInput,
  EditorUIDragUpdateInput,
  EditorUIDragUpdateResult,
  EditorUIDropIntent,
  EditorUINodeIdentity,
  EditorUINodeOrderFact,
  EditorUINodeRangeDirection,
  EditorUINodeRangeSelectionReady,
  EditorUINodeRangeSelectionRejection,
  EditorUINodeRangeSelectionResult,
  EditorUINodeRangeSelectionSnapshot,
  EditorUIWritingDirection,
  ExtendEditorUINodeRangeSelectionOptions,
  RemapEditorUINodeRangeSelectionOptions,
  EditorUIAnchorGeometryResolution,
  EditorUIAnchorRequest,
  EditorUIClientAnchorResolution,
  EditorUIObjectAnchorGeometry,
  EditorUIObjectAnchorRequest,
  ResolveEditorUIBlockDragAutoScrollDecisionOptions,
  ResolveEditorUIBlockDropTargetOptions,
  ResolvedSuggestionResult,
  SuggestionAcceptIntent,
  SuggestionCancelReason,
  SuggestionControllerOptions,
  SuggestionKeyboardResult,
  SuggestionOverlayPort,
  SuggestionPhase,
  SuggestionProvider,
  SuggestionProviderPhase,
  SuggestionProviderRequest,
  SuggestionProviderState,
  SuggestionResult,
  SuggestionSessionInput,
  SuggestionState,
  SuggestionStateListener,
  SuggestionTarget,
  SuggestionTrigger,
  SuggestionTriggerKind
} from "./index";

type PublicSuggestionTypes = [
  ResolvedSuggestionResult<string>,
  SuggestionAcceptIntent<number, string>,
  SuggestionCancelReason,
  SuggestionControllerOptions<number, string>,
  SuggestionKeyboardResult<number, string>,
  SuggestionOverlayPort,
  SuggestionPhase,
  SuggestionProvider<number, string>,
  SuggestionProviderPhase,
  SuggestionProviderRequest<number>,
  SuggestionProviderState,
  SuggestionResult<string>,
  SuggestionSessionInput<number>,
  SuggestionState<number, string>,
  SuggestionStateListener<number, string>,
  SuggestionTarget<number>,
  SuggestionTrigger,
  SuggestionTriggerKind
];

type PublicAnchorTypes = [
  EditorUIAnchorRequest,
  EditorUIAnchorGeometryResolution,
  EditorUIClientAnchorResolution,
  EditorUIObjectAnchorRequest,
  EditorUIObjectAnchorGeometry<"client">
];

type PublicDragTypes = [
  EditorUIBlockDragAutoScrollDecision,
  EditorUIBlockDropPayloadFacts,
  EditorUIBlockDropPolicy,
  EditorUIBlockDropTargetResolution<string>,
  EditorUIBlockFlowAxis,
  EditorUIDragArmInput<number>,
  EditorUIDragArmResult,
  EditorUIDragAutoScrollDecision,
  EditorUIDragAutoScrollEdge,
  EditorUIDragCancelReason,
  EditorUIDragDropResult<number, string>,
  EditorUIDragIndicator,
  EditorUIDragPlacement,
  EditorUIDragPoint,
  EditorUIDragReadyTarget<string>,
  EditorUIDragRejectedTarget,
  EditorUIDragRemapResult,
  EditorUIDragSessionPorts<number, string>,
  EditorUIDragSessionState<number, string>,
  EditorUIDragSource<number>,
  EditorUIDragSourceRemapInput,
  EditorUIDragTargetRejectionReason,
  EditorUIDragTargetResolution<string>,
  EditorUIDragTargetResolverInput<number>,
  EditorUIDragUpdateInput,
  EditorUIDragUpdateResult<string>,
  EditorUIDropIntent<number, string>,
  ResolveEditorUIBlockDragAutoScrollDecisionOptions,
  ResolveEditorUIBlockDropTargetOptions<string>
];

type PublicNodeRangeTypes = [
  CreateEditorUINodeRangeSelectionOptions,
  EditorUINodeIdentity,
  EditorUINodeOrderFact,
  EditorUINodeRangeDirection,
  EditorUINodeRangeSelectionReady,
  EditorUINodeRangeSelectionRejection,
  EditorUINodeRangeSelectionResult,
  EditorUINodeRangeSelectionSnapshot,
  EditorUIWritingDirection,
  ExtendEditorUINodeRangeSelectionOptions,
  RemapEditorUINodeRangeSelectionOptions
];

describe("@quirekit/editor-ui public surface", () => {
  it("exports only headless controllers, geometry authorities and presentation projections", async () => {
    expect(Object.keys(await import("./index"))).toEqual([
      "projectEditorUIAnchorGeometry",
      "resolveEditorUIAnchorGeometry",
      "resolveEditorUIStructuredRangeRects",
      "resolveEditorUITextRangeRects",
      "createEditorUIBlockDropIndicator",
      "DragSession",
      "defaultEditorUIDragThreshold",
      "hasExceededEditorUIDragThreshold",
      "resolveEditorUIBlockDragAutoScrollDecision",
      "resolveEditorUIBlockDropPlacement",
      "resolveEditorUIBlockDropTarget",
      "resolveEditorUIDragThreshold",
      "NodeRangeSelection",
      "SuggestionController",
      "queryEditorBlockOccurrences",
      "resolveEditorBlockHover",
      "startEditorBlockDrag",
      "canStartEditorBlockMarquee", "startEditorBlockMarquee",
      "prepareEditorBlockMenu",
      "registerEditorBlockMenuProvider",
      "createEditorFontSizeOptions", "resolveEditorFontSizeControlValue", "createEditorFontSizeCustomOption", "resolveEditorFontSizeSelection", "normalizeEditorFontSizeInput",
      "editorUnderlineStyleLabels", "editorUnderlineStyleLabel"
    ]);
    expect(DragSession).toBeTypeOf("function");
    expect(createEditorUIBlockDropIndicator).toBeTypeOf("function");
    expect(NodeRangeSelection).toBeTypeOf("function");
    expect(defaultEditorUIDragThreshold).toBe(5);
    expect(hasExceededEditorUIDragThreshold).toBeTypeOf("function");
    expect(projectEditorUIAnchorGeometry).toBeTypeOf("function");
    expect(resolveEditorUIAnchorGeometry).toBeTypeOf("function");
    expect(resolveEditorUIBlockDragAutoScrollDecision).toBeTypeOf("function");
    expect(resolveEditorUIBlockDropPlacement).toBeTypeOf("function");
    expect(resolveEditorUIBlockDropTarget).toBeTypeOf("function");
    expect(resolveEditorUIDragThreshold).toBeTypeOf("function");
    expect(SuggestionController).toBeTypeOf("function");
  });

  it("retains every named suggestion contract at the package root", () => {
    expectTypeOf<PublicSuggestionTypes>().not.toBeNever();
    expectTypeOf<PublicAnchorTypes>().not.toBeNever();
    expectTypeOf<PublicDragTypes>().not.toBeNever();
    expectTypeOf<PublicNodeRangeTypes>().not.toBeNever();
  });
});
