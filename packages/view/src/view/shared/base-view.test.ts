import { createEditor, type QuireEditor } from "@quirekit/core";
import {
  Plugin,
  PluginKey,
  TextSelection,
  type EditorState,
  type Transaction
} from "@quirekit/pm";
import { StarterKit } from "@quirekit/starter-kit";
import { describe, expect, it, vi } from "vitest";
import {
  FakeCanvasMountDocument,
  FakeCanvasMountElement
} from "../../../test-support/mount/canvas";
import { BaseMountedEditorView } from "./base-view";
import type {
  QuireViewCoordsAtPosResult,
  QuireViewPosAtCoordsResult,
  QuireViewTextblockDirection,
  QuireViewViewportCoords
} from "./geometry";
import type {
  QuireMountedEditorViewElements,
  QuireMountedEditorViewUpdateOptions
} from "./types";
import type { MountedViewScrollRect } from "./scroll";
import { createMountedWidgetEventRuntime } from "./widget-events";
import type { MountedWidgetEventRuntime } from "./widget-events";

/** Test mounted view that exposes protected base hooks. */
class TestMountedEditorView extends BaseMountedEditorView<
  "canvas",
  QuireMountedEditorViewElements
> {
  /** Hidden-text mode retained by the test backend. */
  hiddenTextViewMode: "normal" | "formatting-inspection" = "normal";
  /** Number of concrete focus hook calls. */
  focusCallCount = 0;
  /** Number of concrete update hook calls. */
  updateCallCount = 0;
  /** Number of concrete cleanup hook calls. */
  destroyCallCount = 0;
  /** Number of coordinate mapping calls made by scroll fallback. */
  coordsAtPosCallCount = 0;
  /** Document positions requested from the retained position-anchor resolver. */
  positionScrollRequests: number[] = [];
  /** Coordinate rectangle returned by the test view. */
  coordsAtPosResult: QuireViewCoordsAtPosResult = {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0
  };
  /** Retained scroll rectangle returned by the test view. */
  retainedSelectionScrollRect: MountedViewScrollRect | null = null;
  /** Retained position-anchor rectangle returned by the test view. */
  positionScrollRect: MountedViewScrollRect | null = null;

  /**
   * Creates a test mounted editor view.
   *
   * @param options - Editor, status, and element inputs for the base view.
   */
  constructor(options: {
    readonly editor: QuireEditor;
    readonly status: "primary" | "lock" | "sync";
    readonly elements: QuireMountedEditorViewElements;
  }) {
    super({
      editor: options.editor,
      id: "test-view",
      mode: "canvas",
      status: options.status,
      elements: options.elements
    });
  }

  /** @inheritdoc */
  setHiddenTextViewMode(mode: "normal" | "formatting-inspection"): void {
    this.hiddenTextViewMode = mode;
  }

  /**
   * Exposes the protected focus-state setter for tests.
   *
   * @param focused - Whether the test view should report focus.
   */
  setFocusedForTest(focused: boolean): void {
    this.setMountedFocusState(focused);
  }

  /** Initializes plugin view objects for tests. */
  initializePluginViewsForTest(): void {
    this.initializeMountedPluginViews();
  }

  /** Completes one deferred render lifecycle for geometry-listener tests. */
  completeDeferredPostUpdateForTest(): void {
    this.postUpdateGeneration += 1;
    this.completeDeferredMountedPostUpdate();
  }

  /** @param refresh - Independent geometry refresh whose notifications are under test. */
  refreshMountedGeometryForTest(refresh: () => void): void {
    this.refreshMountedGeometry(refresh);
  }

  /**
   * Registers a widget runtime for public query tests.
   *
   * @param runtime - Runtime to expose through the base query API.
   */
  setWidgetRuntimeForTest(
    runtime: MountedWidgetEventRuntime
  ): void {
    this.setMountedWidgetEventRuntime(runtime);
  }

  /** Records a concrete focus request. */
  protected focusEditableTarget(): void {
    this.focusCallCount += 1;
  }

  /**
   * Records a concrete update request.
   *
   * @param options - Shared editor state and update reason.
   */
  protected updateMountedView(options: QuireMountedEditorViewUpdateOptions): void {
    this.updateCallCount += 1;
    void options;
  }

  /** Records concrete cleanup. */
  protected destroyMountedView(): void {
    this.destroyCallCount += 1;
  }

  /**
   * Resolves a retained selection scroll rectangle for base scrolling tests.
   *
   * @returns Retained test rectangle, or null to use the default coordinate fallback.
   */
  protected resolveMountedSelectionScrollRect(): MountedViewScrollRect | null {
    return this.retainedSelectionScrollRect;
  }

  /**
   * Resolves a retained position-anchor scroll rectangle for base scrolling tests.
   *
   * @param position - Document position requested by the shared scroll fallback.
   * @returns Retained test rectangle, or null when no position anchor is available.
   */
  protected resolveMountedPositionScrollRect(
    position: number
  ): MountedViewScrollRect | null {
    this.positionScrollRequests.push(position);

    return this.positionScrollRect;
  }

  /**
   * Maps viewport coordinates to no document position for the test view.
   *
   * @param coords - Viewport coordinates in CSS pixels.
   * @returns Null because geometry is not part of this test view.
   */
  posAtCoords(coords: QuireViewViewportCoords): QuireViewPosAtCoordsResult | null {
    void coords;
    return null;
  }

  /**
   * Maps a document position to a zero rectangle for the test view.
   *
   * @param pos - Document position to map.
   * @param side - Side preference.
   * @returns Zero viewport rectangle.
   */
  coordsAtPos(pos: number, side = 1): QuireViewCoordsAtPosResult {
    this.coordsAtPosCallCount += 1;
    void pos;
    void side;
    return this.coordsAtPosResult;
  }

  /**
   * Reports that the test view is never at a textblock boundary.
   *
   * @param direction - Movement direction to test.
   * @returns Always false for the test view.
   */
  endOfTextblock(direction: QuireViewTextblockDirection): boolean {
    void direction;
    return false;
  }
}

/**
 * Creates fake mounted elements for the base view tests.
 *
 * @returns Mounted element set backed by the fake document.
 */
function createTestElements(): QuireMountedEditorViewElements {
  const ownerDocument = new FakeCanvasMountDocument();
  const root = ownerDocument.createElement("section") as unknown as HTMLElement;
  const inputProxy =
    ownerDocument.createElement("textarea") as unknown as HTMLTextAreaElement;

  return {
    root,
    inputProxy
  };
}

/**
 * Creates a minimal editor object with spies for base view behavior.
 *
 * @returns Fake editor and spies used by the mounted base tests.
 */
function createTestEditor(): {
  readonly editor: QuireEditor;
  readonly dispatchTransaction: ReturnType<typeof vi.fn>;
  readonly setEditorProps: ReturnType<typeof vi.fn>;
  readonly someProp: ReturnType<typeof vi.fn>;
  readonly pmState: EditorState;
} {
  const pmState = {} as EditorState;
  const dispatchTransaction = vi.fn();
  const setEditorProps = vi.fn();
  const someProp = vi.fn((propName: string, callback?: (value: unknown) => unknown) => {
    const value = propName === "handleKeyDown" ? "handled-prop" : undefined;

    return callback === undefined || value === undefined
      ? value
      : callback(value);
  });
  const editor = {
    isEditable: true,
    state: {
      pm: pmState
    },
    dispatchTransaction,
    setEditorProps,
    someProp
  } as unknown as QuireEditor;

  return {
    editor,
    dispatchTransaction,
    setEditorProps,
    someProp,
    pmState
  };
}

describe("BaseMountedEditorView", () => {
  it("publishes a pure geometry refresh after rendering without updating or dispatching state", () => {
    const { editor, dispatchTransaction } = createTestEditor();
    const view = new TestMountedEditorView({ editor, status: "primary", elements: createTestElements() });
    const phases: string[] = [];
    view.onGeometryUpdate(() => phases.push("geometry"));
    view.refreshMountedGeometryForTest(() => phases.push("render"));
    expect(phases).toEqual(["render", "geometry"]);
    expect(view.updateCallCount).toBe(0);
    expect(dispatchTransaction).not.toHaveBeenCalled();
  });

  it("does not publish a stale pure refresh after a newer generation commits", () => {
    const { editor } = createTestEditor();
    const view = new TestMountedEditorView({ editor, status: "primary", elements: createTestElements() });
    const listener = vi.fn();
    view.onGeometryUpdate(listener);
    view.refreshMountedGeometryForTest(() => view.completeDeferredPostUpdateForTest());
    expect(listener).toHaveBeenCalledOnce();
  });

  it("stops pure geometry notifications if a listener destroys the view", () => {
    const { editor } = createTestEditor();
    const view = new TestMountedEditorView({ editor, status: "primary", elements: createTestElements() });
    const later = vi.fn();
    view.onGeometryUpdate(() => view.destroy());
    view.onGeometryUpdate(later);
    view.refreshMountedGeometryForTest(() => {});
    expect(later).not.toHaveBeenCalled();
  });

  it("notifies geometry listeners only after mounted presentation commits", () => {
    const { editor } = createTestEditor();
    const view = new TestMountedEditorView({
      editor,
      status: "primary",
      elements: createTestElements()
    });
    const listener = vi.fn();
    const release = view.onGeometryUpdate(listener);

    expect(listener).not.toHaveBeenCalled();

    view.completeDeferredPostUpdateForTest();

    expect(listener).toHaveBeenCalledTimes(1);

    release();
    view.completeDeferredPostUpdateForTest();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("exposes state, prop lookup, and editable dispatch through the owning editor", () => {
    const { editor, dispatchTransaction, pmState } = createTestEditor();
    const elements = createTestElements();
    const view = new TestMountedEditorView({
      editor,
      status: "primary",
      elements
    });
    const transaction = {} as Transaction;

    view.dispatch(transaction);

    expect(view.state).toBe(pmState);
    expect(view.dom).toBe(elements.root);
    expect(view.editable).toBe(true);
    expect(dispatchTransaction).toHaveBeenCalledWith(transaction);
    expect(view.someProp("handleKeyDown")).toBe("handled-prop");
    expect(view.someProp("handleKeyDown", (value) => `wrapped-${String(value)}`)).toBe(
      "wrapped-handled-prop"
    );
  });

  it("merges view-local props before editor-level props", () => {
    const { editor, setEditorProps } = createTestEditor();
    const view = new TestMountedEditorView({
      editor,
      status: "primary",
      elements: createTestElements()
    });

    view.setProps({
      handleKeyDown() {
        return true;
      }
    });

    expect(
      view.someProp("handleKeyDown", (handler) =>
        handler(view, { key: "Enter" } as KeyboardEvent)
      )
    ).toBe(true);
    expect(view.updateCallCount).toBe(1);
    expect(setEditorProps).not.toHaveBeenCalled();
  });

  it("exposes PM-style props with view-local props and current state", () => {
    const firstState = { plugins: [] } as unknown as EditorState;
    const secondState = { plugins: [] } as unknown as EditorState;
    let currentState = firstState;
    const editor = {
      isEditable: true,
      get state() {
        return {
          pm: currentState
        };
      },
      dispatchTransaction: vi.fn(),
      someProp: vi.fn()
    } as unknown as QuireEditor;
    const view = new TestMountedEditorView({
      editor,
      status: "primary",
      elements: createTestElements()
    });
    const handleKeyDown = () => true;

    view.setProps({ handleKeyDown });
    currentState = secondState;

    expect(view.props.state).toBe(secondState);
    expect(view.props.handleKeyDown).toBe(handleKeyDown);
  });

  it("delegates widget object queries through the registered runtime", () => {
    const { editor } = createTestEditor();
    const view = new TestMountedEditorView({
      editor,
      status: "primary",
      elements: createTestElements()
    });
    const runtime = createMountedWidgetEventRuntime({
      host: {
        kind: "canvas",
        surface: { tagName: "canvas" }
      }
    });

    runtime.setTargets([
      {
        id: "callout",
        nodePath: "0",
        rect: { x: 0, y: 0, width: 100, height: 80 },
        role: "callout",
        pointerEvents: "auto",
        range: { from: 10, to: 30 },
        events: {}
      },
      {
        id: "button",
        nodePath: "0.1",
        rect: { x: 10, y: 10, width: 20, height: 20 },
        role: "button",
        part: "action",
        pointerEvents: "auto",
        range: { from: 20, to: 24 },
        events: {}
      }
    ]);
    view.setWidgetRuntimeForTest(runtime);

    expect(view.getWidgets().map((widget) => widget.id)).toEqual(["callout", "button"]);
    expect(view.getWidgetById("button")?.parent?.id).toBe("callout");
    expect(view.getWidgetsByRole("button").map((widget) => widget.id)).toEqual(["button"]);
    expect(view.getWidgetsByPart("action").map((widget) => widget.id)).toEqual(["button"]);
    expect(view.getWidgetsByPosition(22).map((widget) => widget.id)).toEqual([
      "callout",
      "button"
    ]);
    expect(view.getWidgetsByRange({ from: 28, to: 40 }).map((widget) => widget.id)).toEqual([
      "callout"
    ]);
    expect(view.widgetAtPoint({ x: 12, y: 12 })?.widget.id).toBe("button");

    view.destroy();

    expect(view.getWidgets()).toEqual([]);
    expect(view.widgetAtPoint({ x: 12, y: 12 })).toBeNull();
  });

  it("uses PM-style editable props without disabling selection focus", () => {
    const { editor } = createTestEditor();
    const view = new TestMountedEditorView({
      editor,
      status: "primary",
      elements: createTestElements()
    });

    view.setProps({
      editable() {
        return false;
      }
    });
    view.focus();

    expect(view.editable).toBe(false);
    expect(view.focusCallCount).toBe(1);
  });

  it("caches and refreshes the mounted DOM root", () => {
    const { editor } = createTestEditor();
    const elements = createTestElements();
    const firstRoot = { nodeType: 9 } as Document;
    const secondRoot = { nodeType: 9 } as Document;
    let currentRoot = firstRoot;
    (elements.root as HTMLElement & { getRootNode: () => Node }).getRootNode = () =>
      currentRoot;
    const view = new TestMountedEditorView({
      editor,
      status: "primary",
      elements
    });

    expect(view.root).toBe(firstRoot);
    currentRoot = secondRoot;
    expect(view.root).toBe(firstRoot);

    view.updateRoot();

    expect(view.root).toBe(secondRoot);
  });

  it("dispatches DOM events through view-local props before editor props", () => {
    const { editor, someProp } = createTestEditor();
    const calls: string[] = [];
    const view = new TestMountedEditorView({
      editor,
      status: "primary",
      elements: createTestElements()
    });
    const event = {
      type: "keydown",
      defaultPrevented: false
    } as Event;
    someProp.mockImplementation((propName: string, callback?: (value: unknown) => unknown) => {
      const value =
        propName === "handleDOMEvents"
          ? {
              keydown() {
                calls.push("editor");
                return true;
              }
            }
          : undefined;

      return callback === undefined || value === undefined ? value : callback(value);
    });

    view.setProps({
      handleDOMEvents: {
        keydown() {
          calls.push("view");
          return false;
        }
      }
    });

    expect(view.dispatchEvent(event)).toBe(true);
    expect(calls).toEqual(["view", "editor"]);
  });

  it("runs mounted paste helpers through the shared clipboard pipeline", () => {
    const editor = createEditor({
      extensions: [StarterKit],
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }]
      }
    });
    const view = new TestMountedEditorView({
      editor,
      status: "primary",
      elements: createTestElements()
    });

    editor.dispatchTransaction(
      editor.state.pm.tr.setSelection(TextSelection.create(editor.state.doc, 6))
    );

    expect(view.pasteText(" world")).toBe(true);
    expect(editor.state.doc.textContent).toBe("hello world");

    expect(view.pasteHTML("<p><strong>!</strong></p>")).toBe(true);
    expect(editor.state.doc.textContent).toBe("hello world!");
  });

  it("serializes clipboard data with view-local props", () => {
    const editor = createEditor({
      extensions: [StarterKit],
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }]
      }
    });
    const view = new TestMountedEditorView({
      editor,
      status: "primary",
      elements: createTestElements()
    });

    view.setProps({
      clipboardTextSerializer() {
        return "local-copy";
      }
    });

    const serialized = view.serializeForClipboard(editor.state.doc.slice(1, 6));

    expect(serialized.text).toBe("local-copy");
    expect(serialized.slice.content.textBetween(0, serialized.slice.content.size)).toBe(
      "hello"
    );
  });

  it("runs scroll-to-selection handlers before the retained geometry fallback", () => {
    const { editor } = createTestEditor();
    const handledView = new TestMountedEditorView({
      editor,
      status: "primary",
      elements: createTestElements()
    });
    const fallbackEditor = createEditor({
      extensions: [StarterKit],
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }]
      }
    });
    const unhandledView = new TestMountedEditorView({
      editor: fallbackEditor,
      status: "primary",
      elements: createTestElements()
    });
    const positionView = new TestMountedEditorView({
      editor: fallbackEditor,
      status: "primary",
      elements: createTestElements()
    });
    const retainedView = new TestMountedEditorView({
      editor: fallbackEditor,
      status: "primary",
      elements: createTestElements()
    });
    const calls: string[] = [];

    handledView.setProps({
      handleScrollToSelection(view: typeof handledView) {
        calls.push(view.id);
        return true;
      }
    });

    expect(handledView.scrollToSelection()).toBe(true);
    expect(handledView.coordsAtPosCallCount).toBe(0);
    expect(calls).toEqual(["test-view"]);

    expect(unhandledView.scrollToSelection()).toBe(false);
    expect(unhandledView.coordsAtPosCallCount).toBe(0);
    expect(unhandledView.positionScrollRequests).toEqual([1]);

    positionView.positionScrollRect = {
      left: 14,
      right: 16,
      top: 24,
      bottom: 32
    };

    expect(positionView.scrollToSelection()).toBe(true);
    expect(positionView.coordsAtPosCallCount).toBe(0);
    expect(positionView.positionScrollRequests).toEqual([1]);

    retainedView.retainedSelectionScrollRect = {
      left: 10,
      right: 12,
      top: 20,
      bottom: 28
    };

    expect(retainedView.scrollToSelection()).toBe(true);
    expect(retainedView.coordsAtPosCallCount).toBe(0);
    expect(retainedView.positionScrollRequests).toEqual([]);
  });

  it("scrolls to the selection when the PM scroll counter advances", () => {
    const editor = createEditor({
      extensions: [StarterKit],
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }]
      }
    });
    const view = new TestMountedEditorView({
      editor,
      status: "primary",
      elements: createTestElements()
    });
    const calls: string[] = [];

    view.setProps({
      handleScrollToSelection(activeView: typeof view) {
        calls.push(`${activeView.id}:${activeView.state.doc.textContent}`);
        return true;
      }
    });

    editor.dispatchTransaction(editor.state.pm.tr.scrollIntoView());
    view.update({ editor, reason: "transaction" });
    view.update({ editor, reason: "transaction" });

    expect(calls).toEqual(["test-view:hello"]);
  });

  it("refreshes for the current shared state and rejects replacing state", () => {
    const { editor, pmState } = createTestEditor();
    const view = new TestMountedEditorView({
      editor,
      status: "primary",
      elements: createTestElements()
    });

    view.updateState(pmState);

    expect(view.updateCallCount).toBe(1);
    expect(() => view.updateState({} as EditorState)).toThrow(
      /cannot replace QuireKit shared editor state/
    );
    expect(view.updateCallCount).toBe(1);
  });

  it("owns plugin view creation, update, rebuild, and cleanup", () => {
    const calls: string[] = [];
    const firstPlugin = new Plugin({
      key: new PluginKey("first-view-plugin"),
      view(view) {
        calls.push(`create:first:${view.state === firstState}`);

        return {
          update(activeView, previousState) {
            calls.push(
              `update:first:${activeView.state === secondState}:${previousState === firstState}`
            );
          },
          destroy() {
            calls.push("destroy:first");
          }
        };
      }
    });
    const secondPlugin = new Plugin({
      key: new PluginKey("second-view-plugin"),
      view(view) {
        calls.push(`create:second:${view.state === thirdState}`);

        return {
          destroy() {
            calls.push("destroy:second");
          }
        };
      }
    });
    const firstPlugins = [firstPlugin];
    const secondPlugins = [secondPlugin];
    const firstState = { plugins: firstPlugins } as unknown as EditorState;
    const secondState = { plugins: firstPlugins } as unknown as EditorState;
    const thirdState = { plugins: secondPlugins } as unknown as EditorState;
    let currentState = firstState;
    const editor = {
      get state() {
        return {
          pm: currentState
        };
      },
      dispatchTransaction: vi.fn(),
      someProp: vi.fn()
    } as unknown as QuireEditor;
    const view = new TestMountedEditorView({
      editor,
      status: "primary",
      elements: createTestElements()
    });

    view.initializePluginViewsForTest();
    currentState = secondState;
    view.update({ editor, reason: "transaction" });
    currentState = thirdState;
    view.update({ editor, reason: "transaction" });
    view.destroy();

    expect(calls).toEqual([
      "create:first:true",
      "update:first:true:true",
      "destroy:first",
      "create:second:true",
      "destroy:second"
    ]);
  });

  it("blocks focus and dispatch for locked views", () => {
    const { editor, dispatchTransaction } = createTestEditor();
    const view = new TestMountedEditorView({
      editor,
      status: "lock",
      elements: createTestElements()
    });

    view.focus();
    view.dispatch({} as Transaction);

    expect(view.editable).toBe(false);
    expect(view.focusCallCount).toBe(0);
    expect(dispatchTransaction).not.toHaveBeenCalled();
    expect((view.elements.inputProxy as HTMLTextAreaElement).readOnly).toBe(true);
    expect(view.elements.inputProxy?.getAttribute("aria-readonly")).toBe("true");
  });

  it("allows read-only selection focus but rejects focus after destruction", () => {
    const { editor } = createTestEditor();
    (editor as unknown as { isEditable: boolean }).isEditable = false;
    const view = new TestMountedEditorView({ editor, status: "primary", elements: createTestElements() });
    expect(view.editable).toBe(false);
    view.focus();
    expect(view.focusCallCount).toBe(1);
    view.destroy();
    view.focus();
    expect(view.focusCallCount).toBe(1);
  });

  it("mirrors live editor and plugin editability onto the native input proxy", () => {
    const { editor } = createTestEditor();
    const elements = createTestElements();
    const inputProxy = elements.inputProxy as HTMLTextAreaElement;
    const view = new TestMountedEditorView({
      editor,
      status: "primary",
      elements
    });

    expect(inputProxy.readOnly).toBe(false);
    expect(inputProxy.getAttribute("aria-readonly")).toBe("false");

    (editor as unknown as { isEditable: boolean }).isEditable = false;
    view.update({ editor, reason: "transaction" });

    expect(inputProxy.readOnly).toBe(true);
    expect(inputProxy.getAttribute("aria-readonly")).toBe("true");

    (editor as unknown as { isEditable: boolean }).isEditable = true;
    view.update({ editor, reason: "transaction" });

    expect(inputProxy.readOnly).toBe(false);
    expect(inputProxy.getAttribute("aria-readonly")).toBe("false");

    view.setProps({ editable: () => false });

    expect(inputProxy.readOnly).toBe(true);
    expect(inputProxy.getAttribute("aria-readonly")).toBe("true");
  });

  it("tracks focus from internal state and the input proxy", () => {
    const { editor } = createTestEditor();
    const elements = createTestElements();
    const view = new TestMountedEditorView({
      editor,
      status: "primary",
      elements
    });

    expect(view.hasFocus()).toBe(false);

    view.setFocusedForTest(true);

    expect(view.hasFocus()).toBe(true);

    view.setFocusedForTest(false);
    (elements.inputProxy as unknown as FakeCanvasMountElement).focus();

    expect(view.hasFocus()).toBe(true);
  });

  it("guards update and destroy after teardown", () => {
    const { editor } = createTestEditor();
    const view = new TestMountedEditorView({
      editor,
      status: "primary",
      elements: createTestElements()
    });

    view.update({ editor, reason: "selection" });
    view.destroy();
    view.destroy();
    view.update({ editor, reason: "selection" });
    view.focus();

    expect(view.updateCallCount).toBe(1);
    expect(view.destroyCallCount).toBe(1);
    expect(view.focusCallCount).toBe(0);
    expect(view.isDestroyed).toBe(true);
  });
});
