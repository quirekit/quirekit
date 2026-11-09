import { describe, expect, it, vi } from "vitest";
import { createEditor, type QuireEditor } from "@quirekit/core";
import { StarterKit } from "@quirekit/starter-kit";
import type { QuireViewUpdatePatch } from "@quirekit/view-engine";
import type {
  PrepareQuirePageStackFillRenderOptions,
  QuirePageStackFillRenderWindow
} from "../page-stack";
import { createMountedPaginatedRenderFlow } from "./flow";
import type {
  MountedPaginatedDocumentRenderRequest,
  MountedPaginatedRenderFlow
} from "./types";

/** Render reasons exercised without binding the flow to one backend. */
type TestReason =
  | "initial"
  | "document-replace"
  | "transaction"
  | "selection"
  | "composition"
  | "scroll"
  | "fill";

describe("mounted paginated render flow", () => {
  it("retains preedit and resolves focused fill anchors for document renders", () => {
    const requests: MountedPaginatedDocumentRenderRequest<TestReason>[] = [];
    const prepareFillRender = vi.fn(() => ({
      maxBlocks: 4,
      initialWindowActive: false
    }));
    const flow = createTestFlow({ requests, prepareFillRender });

    flow.renderUpdate({
      reason: "composition",
      imePreedit: { range: { from: 3, to: 3 }, text: "ni" }
    });

    expect(flow.imePreedit?.text).toBe("ni");
    expect(prepareFillRender).toHaveBeenCalledWith({
      totalBlockCount: 8,
      initial: false,
      interactionFirstDirtyBlockIndex: 2
    });
    expect(requests[0]).toMatchObject({
      reason: "composition",
      imePreedit: { text: "ni" },
      layoutDirtyRange: null,
      fillWindow: { maxBlocks: 4 }
    });
  });

  it("clears preedit when composition explicitly ends", () => {
    const requests: MountedPaginatedDocumentRenderRequest<TestReason>[] = [];
    const flow = createTestFlow({ requests });

    flow.renderUpdate({
      reason: "composition",
      imePreedit: { range: { from: 3, to: 3 }, text: "ni" }
    });
    flow.renderUpdate({ reason: "composition" });

    expect(flow.imePreedit).toBeUndefined();
    expect(requests[1]).not.toHaveProperty("imePreedit");
  });

  it("keeps preedit with the caret when another transaction changes text before it", () => {
    const requests: MountedPaginatedDocumentRenderRequest<TestReason>[] = [];
    const flow = createTestFlow({ requests });
    const editor = createParagraphEditor("One", "Two");

    flow.renderUpdate({
      reason: "composition",
      imePreedit: { range: { from: 4, to: 4 }, text: "ni" }
    });
    // A collaborator's text arrives before and exactly at the composing caret.
    flow.renderUpdate({
      reason: "transaction",
      transactions: [editor.state.pm.tr.insertText("AB", 2).insertText("C", 6)]
    });

    expect(flow.imePreedit).toEqual({ range: { from: 7, to: 7 }, text: "ni" });
    expect(requests[1]?.imePreedit).toEqual({ range: { from: 7, to: 7 }, text: "ni" });
  });

  it("projects real transactions into one canonical dirty document request", () => {
    const requests: MountedPaginatedDocumentRenderRequest<TestReason>[] = [];
    const prepareFillRender = vi.fn(() => ({
      maxBlocks: 4,
      initialWindowActive: false
    }));
    const flow = createTestFlow({ requests, prepareFillRender });
    const editor = createParagraphEditor("One", "Two");
    const transaction = editor.state.pm.tr.insertText("A", 2);

    flow.renderUpdate({
      reason: "transaction",
      transactions: [transaction]
    });

    expect(requests[0]).toMatchObject({
      reason: "transaction",
      layoutDirtyRange: {
        reason: "content",
        firstTopLevelBlockIndex: 0,
        textEdit: { from: 2, inserted: 1, deleted: 0 }
      },
      updatePatch: {
        transactionCount: 1,
        docChanged: true,
        invalidatedProducts: ["layout", "content", "overlay"]
      }
    });
    expect(prepareFillRender).toHaveBeenCalledWith({
      totalBlockCount: 8,
      initial: false,
      interactionFirstDirtyBlockIndex: 0
    });
  });

  it("starts a fresh initial fill window for a replacement document", () => {
    const requests: MountedPaginatedDocumentRenderRequest<TestReason>[] = [];
    const prepareFillRender = vi.fn(() => ({
      maxBlocks: 4,
      initialWindowActive: true
    }));
    const flow = createTestFlow({ requests, prepareFillRender });

    flow.renderUpdate({ reason: "document-replace" });

    expect(prepareFillRender).toHaveBeenCalledWith({
      totalBlockCount: 8,
      initial: true
    });
    expect(requests[0]).toMatchObject({
      reason: "document-replace",
      fillWindow: {
        maxBlocks: 4,
        initialWindowActive: true
      },
      updatePatch: {
        invalidatedProducts: ["layout", "content", "overlay"]
      }
    });
  });

  it("keeps selection-only reuse out of document fill planning", () => {
    const requests: MountedPaginatedDocumentRenderRequest<TestReason>[] = [];
    const renderSelectionUpdate = vi.fn();
    const prepareFillRender = vi.fn();
    const flow = createTestFlow({
      requests,
      renderSelectionUpdate,
      prepareFillRender,
      canReuseSelectionUpdate: (reason) => reason === "selection"
    });

    flow.renderUpdate({ reason: "selection" });

    expect(renderSelectionUpdate).toHaveBeenCalledOnce();
    expect(prepareFillRender).not.toHaveBeenCalled();
    expect(requests).toEqual([]);
  });

  it("reuses preedit for viewport refresh and accepted fill advances", () => {
    const requests: MountedPaginatedDocumentRenderRequest<TestReason>[] = [];
    const flow = createTestFlow({ requests });

    flow.renderUpdate({
      reason: "composition",
      imePreedit: { range: { from: 1, to: 1 }, text: "hao" }
    });
    requests.length = 0;
    flow.refreshDocument("scroll");
    flow.applyFillAdvance("fill", {
      complete: false,
      blockLimit: 6,
      render: true
    });
    flow.applyFillAdvance("fill", {
      complete: false,
      blockLimit: 7,
      render: false
    });

    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({
      reason: "scroll",
      imePreedit: { text: "hao" }
    });
    expect(requests[1]).toMatchObject({
      reason: "fill",
      imePreedit: { text: "hao" },
      fillWindow: { maxBlocks: 6, initialWindowActive: false }
    });
  });

  it("suppresses refresh and fill work after destruction or without render state", () => {
    const destroyedRequests: MountedPaginatedDocumentRenderRequest<TestReason>[] = [];
    const destroyedFlow = createTestFlow({
      requests: destroyedRequests,
      readDestroyed: () => true
    });
    const unavailableRequests: MountedPaginatedDocumentRenderRequest<TestReason>[] = [];
    const unavailableFlow = createTestFlow({
      requests: unavailableRequests,
      canRefreshDocument: () => false
    });

    destroyedFlow.renderUpdate({ reason: "initial" });
    destroyedFlow.refreshDocument("scroll");
    destroyedFlow.applyFillAdvance("fill", {
      complete: false,
      blockLimit: 6,
      render: true
    });
    unavailableFlow.refreshDocument("scroll");
    unavailableFlow.applyFillAdvance("fill", {
      complete: false,
      blockLimit: 6,
      render: true
    });

    expect(destroyedRequests).toEqual([]);
    expect(unavailableRequests).toEqual([]);
  });
});

/**
 * Creates a deterministic backend capability harness for flow tests.
 *
 * @param overrides - Optional callbacks replaced by one test.
 * @returns Shared flow configured with deterministic document facts.
 */
function createTestFlow(overrides: {
  /** Collected document render requests. */
  readonly requests: MountedPaginatedDocumentRenderRequest<TestReason>[];
  /** Optional selection-reuse policy. */
  readonly canReuseSelectionUpdate?: ((reason: TestReason) => boolean) | undefined;
  /** Optional retained selection renderer. */
  readonly renderSelectionUpdate?: ((
    reason: TestReason,
    updatePatch: QuireViewUpdatePatch
  ) => void) | undefined;
  /** Optional fill-window projector. */
  readonly prepareFillRender?: ((
    options: PrepareQuirePageStackFillRenderOptions
  ) => QuirePageStackFillRenderWindow | undefined) | undefined;
  /** Optional destruction state reader. */
  readonly readDestroyed?: (() => boolean) | undefined;
  /** Optional document-refresh availability reader. */
  readonly canRefreshDocument?: (() => boolean) | undefined;
}): MountedPaginatedRenderFlow<TestReason> {
  return createMountedPaginatedRenderFlow<TestReason>({
    initialReason: "initial",
    documentReplaceReason: "document-replace",
    transactionReason: "transaction",
    compositionReason: "composition",
    readDestroyed: overrides.readDestroyed ?? (() => false),
    readFocused: () => true,
    readTopLevelBlockCount: () => 8,
    readSelectionHeadTopLevelBlockIndex: () => 2,
    canReuseSelectionUpdate:
      overrides.canReuseSelectionUpdate ?? (() => false),
    renderSelectionUpdate:
      overrides.renderSelectionUpdate ?? vi.fn(),
    prepareFillRender:
      overrides.prepareFillRender ?? (() => undefined),
    canRefreshDocument: overrides.canRefreshDocument ?? (() => true),
    renderDocument: (request) => overrides.requests.push(request)
  });
}

/**
 * Creates a real editor document for transaction-projection coverage.
 *
 * @param texts - Paragraph text values in document order.
 * @returns Editor containing one paragraph for each value.
 */
function createParagraphEditor(...texts: readonly string[]): QuireEditor {
  const editor = createEditor({
    extensions: [StarterKit.configure({ undoRedo: false })]
  });
  const paragraphType = editor.state.schema.nodes.paragraph;
  const docType = editor.state.schema.nodes.doc;

  if (!paragraphType || !docType) {
    throw new Error("Starter kit schema did not provide doc and paragraph nodes.");
  }

  editor.setContent(docType.create(
    null,
    texts.map((text) => paragraphType.create(null, editor.state.schema.text(text)))
  ));
  return editor;
}
