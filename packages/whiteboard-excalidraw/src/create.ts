/// <reference path="./styles.d.ts" />
import type { ExcalidrawImperativeAPI, ExcalidrawInitialDataState, ExcalidrawProps } from "@excalidraw/excalidraw/types";
import { WhiteboardError, readWhiteboardDocument, readWhiteboardScene, whiteboardMaximumBytes } from "@quirekit/whiteboard";
import type { WhiteboardEditor, WhiteboardEditorOptions } from "./types";
import { captureScene, snapshotScene } from "./snapshot";
import { trackDraftInput } from "./input";
import { whiteboardLanguage } from "./locale";
import { commonJsExports } from "./interop";

/** @param options - One host and independent source. @returns Ready, disposable runtime loaded on demand. */
export async function createExcalidrawWhiteboard(options: WhiteboardEditorOptions): Promise<WhiteboardEditor> {
  const document = readWhiteboardDocument(options.document);
  options.signal?.throwIfAborted();
  const [reactModule, clientModule, upstream] = await Promise.all([import("react"), import("react-dom/client"), import("@excalidraw/excalidraw"), import("@excalidraw/excalidraw/index.css")]);
  const React = commonJsExports(reactModule, "createElement"), { createRoot } = commonJsExports(clientModule, "createRoot");
  options.signal?.throwIfAborted();
  const container = options.container, owner = container.ownerDocument;
  const draftInput = trackDraftInput(container);
  const root = createRoot(container);
  let api: ExcalidrawImperativeAPI | undefined, dead = false, composing = false, readOnly = !!options.readOnly, theme = options.theme ?? "light";
  let locale = whiteboardLanguage(options.locale);
  let previousElements: unknown, previousBackground: unknown, initialized = false;
  let resolveReady: () => void = () => {}, rejectReady: (error: unknown) => void = () => {};
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const initialData = { ...document.scene, scrollToContent: true, appState: { ...document.scene.appState, currentItemFontFamily: 2 } } as unknown as ExcalidrawInitialDataState;
  const observer = new ResizeObserver(() => api?.refresh());
  observer.observe(container);

  /** @param event - Native input owned by the inner editor. */
  function isolate(event: Event): void { event.stopPropagation(); }
  /** @param event - Native IME phase. */
  function composition(event: Event): void { composing = event.type === "compositionstart"; }
  for (const name of ["keydown", "keyup", "copy", "cut", "paste"]) container.addEventListener(name, isolate);
  container.addEventListener("compositionstart", composition); container.addEventListener("compositionend", composition);

  /** Reprojects permission/theme/language without replacing the scene or React root. */
  function render(): void {
    const props: ExcalidrawProps = { initialData, theme, langCode: locale, viewModeEnabled: readOnly, handleKeyboardGlobally: false, autoFocus: true,
      validateEmbeddable: false, UIOptions: { canvasActions: { loadScene: false, saveToActiveFile: false, export: false, toggleTheme: false } },
      /** @param value - Public upstream API after mount. */
      excalidrawAPI(value) { api = value; resolveReady(); },
      /** @param elements - Upstream scene reference. @param state - Small viewport/tool projection. */
      onChange(elements, state) {
        if (dead) return;
        if (initialized && (previousElements !== elements || previousBackground !== state.viewBackgroundColor)) options.onChange?.();
        previousElements = elements; previousBackground = state.viewBackgroundColor; initialized = true;
        options.onStateChange?.({ tool: state.activeTool.type, zoom: state.zoom.value, composing });
      } };
    root.render(React.createElement(upstream.Excalidraw, props));
  }

  /** @returns Live upstream API; late work cannot resurrect a destroyed editor. */
  function current(): ExcalidrawImperativeAPI { if (dead || !api) throw new WhiteboardError("closed", "白板已经关闭"); return api; }
  /** @returns Completion of the browser input boundary before serialization. */
  async function flush(): Promise<void> {
    current();
    if (composing) throw new WhiteboardError("composing", "请先完成当前文字输入");
    const active = owner.activeElement;
    if (active && container.contains(active) && "blur" in active) (active as HTMLElement).blur();
    await new Promise<void>(resolve => owner.defaultView!.requestAnimationFrame(() => owner.defaultView!.requestAnimationFrame(() => resolve())));
    current();
  }
  /** Releases every resource, including cancellation before React calls its API ref. */
  function destroy(): void {
    if (dead) return; dead = true;
    draftInput.destroy(); observer.disconnect(); root.unmount();
    for (const name of ["keydown", "keyup", "copy", "cut", "paste"]) container.removeEventListener(name, isolate);
    container.removeEventListener("compositionstart", composition); container.removeEventListener("compositionend", composition);
    options.signal?.removeEventListener("abort", abort);
    rejectReady(new DOMException("Whiteboard closed", "AbortError"));
  }
  /** Cancels in-flight mount and prevents late host writes. */
  function abort(): void { destroy(); }
  options.signal?.addEventListener("abort", abort, { once: true });
  render();
  try { await ready; options.signal?.throwIfAborted(); }
  catch (error) { destroy(); throw error; }
  return {
    /** @returns Detached native source without ending active text editing or changing focus. */
    captureDraft() { return draftInput.stable() ? captureScene(current(), upstream.serializeAsJSON) : null; },
    /** @returns Detached source after native input commits. */
    async getScene() { await flush(); return captureScene(current(), upstream.serializeAsJSON); },
    /** @returns PNG and source from one immutable capture. */
    async snapshot() { await flush(); const scene = captureScene(current(), upstream.serializeAsJSON); const result = await snapshotScene(scene, owner, upstream.exportToCanvas); current(); return result; },
    /** @param source - Local Excalidraw JSON. @returns Validated replacement completion. */
    async importScene(source) {
      if (readOnly) throw new WhiteboardError("boardReadonly", "白板为只读");
      if (source.length > whiteboardMaximumBytes) throw new WhiteboardError("tooLarge", "白板超过 16 MB");
      const scene = readWhiteboardScene(JSON.parse(source));
      await flush();
      if (readOnly) throw new WhiteboardError("boardReadonly", "白板为只读");
      const restored = upstream.restore(scene as unknown as Parameters<typeof upstream.restore>[0], null, null);
      const target = current();
      target.addFiles(Object.values(restored.files ?? {}));
      target.updateScene({ elements: restored.elements, appState: restored.appState, captureUpdate: upstream.CaptureUpdateAction.IMMEDIATELY });
      target.scrollToContent();
    },
    /** @param tool - Explicit drawing tool. */
    setTool(tool) { if (!readOnly || tool === "hand" || tool === "selection") current().setActiveTool({ type: tool }); },
    /** @param value - Current host permission. */
    setReadOnly(value) { if (dead) return; readOnly = value; render(); },
    /** @param value - Current chrome scheme. */
    setTheme(value) { if (dead) return; theme = value; render(); },
    /** @param value - Host UI language; preserves the mounted source, focus and history. */
    setLocale(value) { if (dead) return; const next = whiteboardLanguage(value); if (next === locale) return; locale = next; render(); },
    /** Fits current elements without modifying source. */
    fit() { current().scrollToContent(undefined, { fitToViewport: true }); },
    /** @param factor - Relative viewport multiplier. */
    zoom(factor) { const target = current(); target.updateScene({ appState: { zoom: { value: Math.max(.1, Math.min(4, target.getAppState().zoom.value * factor)) as ReturnType<ExcalidrawImperativeAPI["getAppState"]>["zoom"]["value"] } }, captureUpdate: upstream.CaptureUpdateAction.NEVER }); },
    /** Restores keyboard ownership to the drawing surface. */
    focus() { container.querySelector<HTMLElement>(".excalidraw")?.focus(); },
    destroy
  };
}
