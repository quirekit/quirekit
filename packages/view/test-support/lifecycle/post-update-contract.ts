import { createEditor, type QuireEditor, type QuireMountedEditorView, type QuireViewMode } from "@quirekit/core";
import { Plugin, TextSelection, type EditorState, type EditorView } from "@quirekit/pm";
import { StarterKit } from "@quirekit/starter-kit";
import type { QuireImePreedit } from "@quirekit/view-engine";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeCanvasMountDocument, FakeCanvasMountWindow } from "../mount/canvas";
import type { QuireMountedEditorViewOptions } from "../../src/mounted-backend";

/** Mounted view surface exercised by the committed post-update contract. */
export interface PostUpdateContractView {
  /** Backend mode reported by the view. */
  readonly mode: string;
  /** Live PM state of the mounted view. */
  readonly state: EditorState;
  /** Backend-owned elements; the pointer surface is resolved by the backend. */
  readonly elements: unknown;
  /** Dispatches a PM transaction through the mounted view. */
  dispatch(transaction: EditorState["tr"]): void;
  /** Applies one mounted update request. */
  update(options: { editor: QuireEditor; reason: "transaction" | "selection" }): void;
  /** Maps a document position to client coordinates. */
  coordsAtPos(pos: number): { left: number; top: number; bottom: number };
  /** Scrolls the current selection into view. */
  scrollToSelection(): boolean;
  /** Subscribes to committed geometry updates. */
  onGeometryUpdate?(listener: () => void): unknown;
  /** Focuses the mounted view. */
  focus(): void;
  /** Releases the mounted view. */
  destroy(): void;
}

/** Backend adapter consumed by the committed post-update contract. */
export interface PostUpdateContractBackend {
  /** Backend mode name used for editor mounting and test labels. */
  readonly kind: QuireViewMode;
  /** Creates the fake owner document for this backend. */
  createDocument(): { createElement(tagName: string): unknown };
  /**
   * Creates a mounted view directly.
   *
   * @param options - Mount options without the backend mode.
   * @returns Mounted view.
   */
  createView(options: Omit<QuireMountedEditorViewOptions, "mode"> & { runtime: object }): PostUpdateContractView;
  /**
   * Creates the view extension that registers this backend with Core.
   *
   * @param options - Extension options carrying the mounted runtime.
   * @returns Core extension.
   */
  extension(options: { runtime: object }): unknown;
  /** Whether rendering schedules frames through the global animation-frame API. */
  readonly usesGlobalFrames: boolean;
  /** Number of completions already committed when a render observer requests a new frame. */
  readonly committedBeforeRenderObserver: number;
  /**
   * Requests one synchronous backend render outside the scheduler.
   *
   * @param view - Mounted view.
   * @param editor - Editor owning the view.
   * @param reason - Render reason.
   * @param imePreedit - Optional speculative preedit.
   */
  renderDirect(view: PostUpdateContractView, editor: QuireEditor, reason: "selection" | "composition", imePreedit?: QuireImePreedit): void;
  /**
   * Flushes the backend update scheduler.
   *
   * @param view - Mounted view.
   */
  flush(view: PostUpdateContractView): void;
  /**
   * Resolves the element that receives pointerdown events.
   *
   * @param view - Mounted view.
   * @returns Pointer target element.
   */
  pointerSurface(view: PostUpdateContractView): { dispatchEvent(event: Event): unknown };
}

/**
 * Declares the committed post-update lifecycle contract shared by every mounted backend.
 *
 * @param backend - Backend adapter under test.
 */
export function describeCommittedPostUpdateContract(backend: PostUpdateContractBackend): void {
  const cleanups: Array<() => void> = [];
  afterEach(() => {
    cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
    vi.unstubAllGlobals();
  });

  describe(`${backend.kind} committed post-update lifecycle`, () => {
    it("does not update plugin views again during initial mounting", () => {
      expect(mountPostUpdateFixture(backend, cleanups).initialPluginUpdateCount).toBe(0);
    });

    it.each(["pointer", "base"] as const)("completes a frame absorbed by a %s sync render once", (origin) => {
      const fixture = mountPostUpdateFixture(backend, cleanups);
      fixture.requestTransaction(4);
      expect(fixture.frames.size).toBe(1);
      if (origin === "pointer") fixture.directSelection();
      else fixture.view.update({ editor: fixture.editor, reason: "selection" });

      expect(fixture.frames.size).toBe(0);
      expect(fixture.pluginUpdates).toHaveBeenCalledTimes(1);
      expect(fixture.scroll).toHaveBeenCalledTimes(1);
      expect(fixture.geometry).toHaveBeenCalledTimes(1);
      fixture.runCanceled();
      expect(fixture.pluginUpdates).toHaveBeenCalledTimes(1);
    });

    it("coalesces multiple accepted frames but leaves direct selection without obligations", () => {
      const fixture = mountPostUpdateFixture(backend, cleanups);
      const previousState = fixture.editor.state.pm;
      fixture.directSelection();
      expect(fixture.pluginUpdates).not.toHaveBeenCalled();
      expect(fixture.geometry).not.toHaveBeenCalled();
      fixture.requestTransaction(3);
      fixture.requestTransaction(5);
      fixture.flush();
      expect(fixture.pluginUpdates).toHaveBeenCalledTimes(1);
      expect(fixture.pluginUpdates.mock.calls[0]?.[1]).toBe(previousState);
      expect(fixture.view.state.selection.to).toBe(5);
      expect(fixture.scroll).toHaveBeenCalledTimes(1);
      expect(fixture.geometry).toHaveBeenCalledTimes(1);
    });

    it("preserves completion for a direct composition frame absorbed by selection", () => {
      const fixture = mountPostUpdateFixture(backend, cleanups);
      fixture.directComposition();
      expect(fixture.frames.size).toBe(1);
      fixture.directSelection();
      expect(fixture.frames.size).toBe(0);
      expect(fixture.pluginUpdates).toHaveBeenCalledTimes(1);
      expect(fixture.geometry).toHaveBeenCalledTimes(1);
      expect(fixture.scroll).not.toHaveBeenCalled();
    });

    it("keeps a render observer's new frame pending until its own commit", () => {
      const fixture = mountPostUpdateFixture(backend, cleanups);
      fixture.requestTransaction(3);
      fixture.onRender.mockImplementationOnce(() => fixture.requestTransaction(5));
      fixture.flush();
      const alreadyCommitted = backend.committedBeforeRenderObserver;
      expect(fixture.pluginUpdates.mock.calls.length).toBe(alreadyCommitted);
      expect(fixture.geometry).toHaveBeenCalledTimes(alreadyCommitted);
      expect(fixture.frames.size).toBe(1);
      fixture.flush();
      expect(fixture.pluginUpdates).toHaveBeenCalledTimes(alreadyCommitted + 1);
      expect(fixture.scroll).toHaveBeenCalledTimes(alreadyCommitted + 1);
      expect(fixture.geometry).toHaveBeenCalledTimes(alreadyCommitted + 1);
    });

    it("keeps a plugin callback's new batch pending and preserves committed previousState", () => {
      const fixture = mountPostUpdateFixture(backend, cleanups);
      const previousState = fixture.editor.state.pm;
      fixture.requestTransaction(3);
      const committedState = fixture.editor.state.pm;
      fixture.pluginUpdates.mockImplementationOnce(() => fixture.requestTransaction(5));
      fixture.flush();
      expect(fixture.pluginUpdates).toHaveBeenCalledTimes(1);
      expect(fixture.scroll).not.toHaveBeenCalled();
      expect(fixture.geometry).not.toHaveBeenCalled();
      // Preserve PM callback order: later hooks see live state, but share this batch's previousState.
      expect(fixture.laterPluginUpdates.mock.calls[0]?.[1]).toBe(previousState);
      expect(fixture.laterPluginStates[0]).toBe(fixture.editor.state.pm);
      fixture.flush();
      expect(fixture.pluginUpdates).toHaveBeenCalledTimes(2);
      expect(fixture.pluginUpdates.mock.calls[1]?.[1]).toBe(committedState);
      expect(fixture.laterPluginUpdates.mock.calls[1]?.[1]).toBe(committedState);
      expect(fixture.scroll).toHaveBeenCalledTimes(1);
      expect(fixture.geometry).toHaveBeenCalledTimes(1);
    });

    it("does not publish stale geometry when scrolling requests another frame", () => {
      const fixture = mountPostUpdateFixture(backend, cleanups);
      fixture.requestTransaction(3);
      fixture.scroll.mockImplementationOnce(() => {
        fixture.requestTransaction(5);
        return true;
      });
      fixture.flush();
      expect(fixture.geometry).not.toHaveBeenCalled();
      fixture.flush();
      expect(fixture.pluginUpdates).toHaveBeenCalledTimes(2);
      expect(fixture.scroll).toHaveBeenCalledTimes(2);
      expect(fixture.geometry).toHaveBeenCalledTimes(1);
    });

    it.each(["update", "destroy"] as const)("stops an obsolete geometry batch after a listener triggers %s", (action) => {
      const fixture = mountPostUpdateFixture(backend, cleanups);
      const laterListener = vi.fn();
      fixture.view.onGeometryUpdate?.(laterListener);
      fixture.geometry.mockImplementationOnce(() => {
        if (action === "update") fixture.requestTransaction(5);
        else fixture.view.destroy();
      });
      fixture.requestTransaction(3);
      fixture.flush();
      expect(laterListener).not.toHaveBeenCalled();
      fixture.flush();
      expect(laterListener).toHaveBeenCalledTimes(action === "update" ? 1 : 0);
    });

    it("discards pending completion on destroy even when a canceled callback fires", () => {
      const fixture = mountPostUpdateFixture(backend, cleanups);
      fixture.requestTransaction(4);
      fixture.view.destroy();
      fixture.runCanceled();
      fixture.flush();
      expect(fixture.pluginUpdates).not.toHaveBeenCalled();
      expect(fixture.scroll).not.toHaveBeenCalled();
      expect(fixture.geometry).not.toHaveBeenCalled();
    });

    it.each(["pointerup", "pointercancel"] as const)("preserves committed transaction obligations through a real %s event", (endType) => {
      const fixture = mountPointerSessionFixture(backend, cleanups);
      fixture.pointer("pointerdown", 2);
      expect(fixture.view.state.selection.from).toBe(2);
      expect(fixture.view.state.selection.empty).toBe(true);
      expect(fixture.renderFrames.size).toBe(0);
      fixture.pluginUpdates.mockClear();
      fixture.geometry.mockClear();
      fixture.scroll.mockClear();

      // Core dispatch commits PM state and schedules its mounted update through the public adapter.
      const transaction = fixture.view.state.tr;
      fixture.view.dispatch(transaction
        .setSelection(TextSelection.create(transaction.doc, 2, 3))
        .scrollIntoView());
      const committedState = fixture.view.state;
      expect(committedState.selection.to).toBe(3);
      expect(fixture.renderFrames.size).toBe(1);
      expect(fixture.pluginUpdates.mock.calls.length).toBe(0);
      fixture.pointer("pointermove", 4);
      // One owner-window frame coalesces selection; another checks drag auto-scroll.
      expect(fixture.pointerFrames.size).toBe(2);
      expect(fixture.view.state).toBe(committedState);

      // The final event either commits its exact coordinate or drops only the queued move.
      fixture.pointer(endType, 5);
      expect(fixture.pointerFrames.size).toBe(0);
      expect(fixture.view.state.selection.from).toBe(2);
      expect(fixture.view.state.selection.to).toBe(endType === "pointerup" ? 5 : 3);
      if (endType === "pointercancel") {
        expect(fixture.view.state).toBe(committedState);
        expect(fixture.pluginUpdates.mock.calls.length).toBe(0);
        expect(fixture.renderFrames.size).toBe(1);
        fixture.runRenderFrame();
      }
      expect(fixture.renderFrames.size).toBe(0);
      expect(fixture.pluginUpdates).toHaveBeenCalledTimes(1);
      expect(fixture.scroll).toHaveBeenCalledTimes(1);
      expect(fixture.geometry).toHaveBeenCalledTimes(1);
      fixture.runCanceledFrames();
      expect(fixture.pluginUpdates).toHaveBeenCalledTimes(1);
      expect(fixture.geometry).toHaveBeenCalledTimes(1);
      fixture.pointer("pointermove", 6);
      expect(fixture.pointerFrames.size).toBe(0);
      expect(fixture.view.state.selection.to).toBe(endType === "pointerup" ? 5 : 3);
    });
  });
}

/**
 * Declares that a composition preview publishes its caret without touching the canonical state.
 *
 * @param backend - Backend whose presented caret is exercised.
 */
export function describePresentedCaretContract(backend: PostUpdateContractBackend): void {
  const cleanups: Array<() => void> = [];
  afterEach(() => cleanups.splice(0).reverse().forEach((cleanup) => cleanup()));

  it(`publishes the ${backend.kind} preview caret with geometry while leaving the canonical document and selection untouched`, () => {
    const f = mountPostUpdateFixture(backend, cleanups);
    const view = f.view as unknown as QuireMountedEditorView;
    const before = f.editor.state.pm;
    const initial = view.getCaretRect?.();
    const presented: ReturnType<NonNullable<QuireMountedEditorView["getCaretRect"]>>[] = [];
    view.onGeometryUpdate?.(() => { presented.push(view.getCaretRect!()); });
    f.directComposition();
    f.flush();
    expect(f.editor.state.pm).toBe(before);
    expect(presented).toHaveLength(1);
    // Canonical positions skip the preedit; the composition point on its far side is where the preview caret stands.
    const preview = view.coordsAtPos(before.selection.head, 1);
    expect(presented[0]).toMatchObject({ left: preview.left, top: preview.top, bottom: preview.bottom });
    expect(presented[0]!.left).toBeGreaterThan(initial!.left);
  });
}

/**
 * Mounts a real backend with controlled frames and PM plugin hooks.
 *
 * @param backend - Backend whose committed render is exercised.
 * @param cleanups - Teardown queue drained after each test.
 * @returns Mounted editor, completion observations, and frame controls.
 */
function mountPostUpdateFixture(backend: PostUpdateContractBackend, cleanups: Array<() => void>) {
  const editor = createEditor({
    extensions: [StarterKit],
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "abcdef" }] }] }
  });
  const pluginUpdates = vi.fn((_view: unknown, _previousState: unknown) => {});
  editor.registerPlugin(new Plugin({ view: () => ({ update: pluginUpdates }) }));
  const laterPluginStates: EditorState[] = [];
  const laterPluginUpdates = vi.fn((view: EditorView, _previousState: EditorState) => {
    laterPluginStates.push(view.state);
  });
  editor.registerPlugin(new Plugin({ view: () => ({ update: laterPluginUpdates }) }));
  const document = backend.createDocument();
  const frames = new Map<number, () => void>();
  const canceled: Array<() => void> = [];
  let nextFrame = 0;
  const requestFrame = (callback: () => void): number => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  };
  const cancelFrame = (handle: number): void => {
    const callback = frames.get(handle);
    if (callback) canceled.push(callback);
    frames.delete(handle);
  };
  if (backend.usesGlobalFrames) {
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);
  }
  const onRender = vi.fn(() => {});
  const view = backend.createView({
    editor,
    id: `post-update-${backend.kind}`,
    status: "primary",
    element: document.createElement("section") as unknown as HTMLElement,
    ownerDocument: document as unknown as Document,
    runtime: {
      width: 320,
      height: 200,
      requestUpdateFrame: requestFrame,
      cancelUpdateFrame: cancelFrame,
      onRender
    }
  });
  cleanups.push(() => { view.destroy(); editor.destroy(); });
  const initialPluginUpdateCount = pluginUpdates.mock.calls.length;
  view.focus();
  pluginUpdates.mockClear();
  laterPluginUpdates.mockClear();
  laterPluginStates.length = 0;
  onRender.mockClear();
  const geometry = vi.fn();
  view.onGeometryUpdate?.(geometry);
  const scroll = vi.spyOn(view, "scrollToSelection");
  return {
    editor, view, frames, pluginUpdates, geometry, scroll, onRender,
    initialPluginUpdateCount, laterPluginUpdates, laterPluginStates,
    directSelection: () => backend.renderDirect(view, editor, "selection"),
    directComposition: () => backend.renderDirect(view, editor, "composition", { text: "ni", range: { from: 1, to: 1 } }),
    flush: () => backend.flush(view),
    runCanceled: () => canceled.splice(0).forEach((callback) => callback()),
    requestTransaction(to: number) {
      const tr = editor.state.pm.tr;
      view.dispatch(tr.setSelection(TextSelection.create(tr.doc, 1, to)).scrollIntoView());
      view.update({ editor, reason: "transaction" });
    }
  };
}

/**
 * Mounts through Core's public adapter so DOM pointer dispatch also drives mounted updates.
 *
 * @param backend - Backend whose pointer completion boundary is exercised.
 * @param cleanups - Teardown queue drained after each test.
 * @returns Real mounted lifecycle with separate controllable pointer and render frame queues.
 */
function mountPointerSessionFixture(backend: PostUpdateContractBackend, cleanups: Array<() => void>) {
  const document = backend.createDocument();
  const pointerFrames = new Map<number, () => void>();
  const renderFrames = new Map<number, () => void>();
  const canceledFrames: Array<() => void> = [];
  let nextFrame = 0;
  const requestFrame = (queue: Map<number, () => void>, callback: () => void): number => {
    queue.set(++nextFrame, callback);
    return nextFrame;
  };
  const cancelFrame = (queue: Map<number, () => void>, handle: number): void => {
    const callback = queue.get(handle);
    if (callback) canceledFrames.push(callback);
    queue.delete(handle);
  };
  // Pointer sessions use the owner window; global-frame backends render through the global scheduler.
  Object.defineProperty(document, "defaultView", {
    value: Object.assign(new FakeCanvasMountWindow(), {
      requestAnimationFrame: (callback: () => void) => requestFrame(pointerFrames, callback),
      cancelAnimationFrame: (handle: number) => cancelFrame(pointerFrames, handle)
    })
  });
  const runtime = {
    width: 320,
    height: 200,
    requestUpdateFrame: (callback: () => void) => requestFrame(renderFrames, callback),
    cancelUpdateFrame: (handle: number) => cancelFrame(renderFrames, handle)
  };
  if (backend.usesGlobalFrames) {
    vi.stubGlobal("requestAnimationFrame", runtime.requestUpdateFrame);
    vi.stubGlobal("cancelAnimationFrame", runtime.cancelUpdateFrame);
  }
  const editor = createEditor({
    extensions: [StarterKit, backend.extension({ runtime }) as typeof StarterKit],
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "abcdef" }] }] }
  });
  const pluginUpdates = vi.fn((_view: EditorView, _previousState: EditorState) => {});
  editor.registerPlugin(new Plugin({ view: () => ({ update: pluginUpdates }) }));
  const view = editor.mount({
    mode: backend.kind,
    element: document.createElement("section") as unknown as HTMLElement,
    ownerDocument: document as unknown as Document
  }) as unknown as PostUpdateContractView;
  cleanups.push(() => editor.destroy());
  view.focus();
  const geometry = vi.fn();
  view.onGeometryUpdate?.(geometry);
  const scroll = vi.spyOn(view, "scrollToSelection");
  return {
    view, pointerFrames, renderFrames, pluginUpdates, geometry, scroll,
    pointer(type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel", position: number) {
      const rect = view.coordsAtPos(position);
      const event = {
        type,
        pointerId: 1,
        button: 0,
        buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1,
        pointerType: "mouse",
        clientX: rect.left + 0.1,
        clientY: (rect.top + rect.bottom) / 2,
        shiftKey: false,
        timeStamp: 100,
        defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }
      };
      const target = type === "pointerdown" ? backend.pointerSurface(view) : document as unknown as { dispatchEvent(event: Event): unknown };
      target.dispatchEvent(event as unknown as Event);
    },
    runRenderFrame() {
      const entry = renderFrames.entries().next().value;
      expect(entry).toBeDefined();
      renderFrames.delete(entry![0]);
      entry![1]();
    },
    runCanceledFrames: () => canceledFrames.splice(0).forEach((callback) => callback())
  };
}
