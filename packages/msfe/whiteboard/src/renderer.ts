import { bindImageSource, type ComponentViewRenderer, type MsfeEditor } from "@quirekit/msfe-core";
import { whiteboardPreviewSize, whiteboardPreviewMessages, type WhiteboardActionsHandle, whiteboardPreviewSource } from "@quirekit/whiteboard";
import type { MsfeWhiteboardOptions, MsfeWhiteboardPreviewProps } from "./types";
import { openMsfeWhiteboard } from "./session";

/** @param editor - Source owner; the preview may render before it mounts. @param options - Product dialog and toolbar composition. @returns Lightweight preview without an inner editor. */
export function whiteboardPreview(editor: MsfeEditor, options: MsfeWhiteboardOptions): ComponentViewRenderer<MsfeWhiteboardPreviewProps> {
  return ({ dom, props, requestMeasure }) => {
    const figure = dom.ownerDocument.createElement("figure"), image = dom.ownerDocument.createElement("img");
    const toolbar = dom.ownerDocument.createElement("div");
    toolbar.style.cssText = "position:absolute;top:8px;right:8px;z-index:1;max-width:calc(100% - 16px);border-radius:8px;background:var(--qk-color-surface-page,#fff);box-shadow:0 2px 10px #0002";
    figure.dataset.qkWhiteboard = "true"; figure.tabIndex = 0;
    figure.style.cssText = "position:relative;margin:16px 0;width:100%;border:1px solid var(--qk-color-border-subtle,#e2e8f0);border-radius:8px;overflow:hidden;background:white;cursor:pointer";
    image.style.cssText = "display:block;width:100%;height:auto;max-height:460px;margin:auto;object-fit:contain";
    figure.append(image, toolbar); dom.append(figure);
    const source = bindImageSource(image, options.resolve);
    let current = props, anchor = editor.captureAnchor(props.range);
    let actions: WhiteboardActionsHandle | undefined;
    /** @param open - Explicit task factory. */
    function task(open: MsfeWhiteboardOptions["open"]): void {
      const range = anchor.getRange();
      if (range && anchor.target() && !current.readOnly) openMsfeWhiteboard(editor, open, range, current.board);
    }
    /** Mounts controls only for the focused preview, without editor-wide subscriptions. */
    function showActions(): void {
      const state = { document: current.board, readOnly: current.readOnly, edit() { task(options.open); }, rename() { task(options.rename ?? null); } };
      if (actions) actions.update(state); else actions = options.mountActions?.(toolbar, state);
    }
    /** @param event - Focus leaving the preview and its controls. */
    function blur(event: FocusEvent): void {
      if (!figure.contains(event.relatedTarget as globalThis.Node | null)) { actions?.destroy(); actions = undefined; }
    }
    /** @param next - Accepted semantic source. */
    function update(next: MsfeWhiteboardPreviewProps): void {
      if (current.board !== next.board) { anchor.release(); anchor = editor.captureAnchor(next.range); }
      current = next; image.hidden = !next.board.preview; source.set(whiteboardPreviewSource(next.board));
      figure.style.maxWidth = `${whiteboardPreviewSize(next.board.preview).width}px`;
      if (next.board.preview) { image.width = next.board.preview.width; image.height = next.board.preview.height; }
      image.alt = next.board.title; label();
      if (actions) showActions(); requestMeasure();
    }
    // The preview may render before the editor mounts, so the language comes from the preview's own
    // ancestors; a detached first render uses the default and relabels once attached.
    function label(): void {
      const text = whiteboardPreviewMessages(dom.closest<HTMLElement>("[lang]")?.lang);
      figure.setAttribute("aria-label", `${current.board.title}${current.readOnly ? "" : ` · ${text.edit}`}`);
    }
    /** @param event - Pointer or keyboard preview activation. */
    function activate(event: Event): void {
      if (toolbar.contains(event.target as globalThis.Node)) return;
      if (event.type === "keydown" && (event as KeyboardEvent).key !== "Enter") return;
      const range = anchor.getRange();
      if (!range || !anchor.target() || current.readOnly) return;
      if (openMsfeWhiteboard(editor, options.open, range, current.board)) { event.preventDefault(); event.stopPropagation(); }
    }
    figure.addEventListener("focusin", showActions); figure.addEventListener("focusout", blur);
    figure.addEventListener("dblclick", activate); figure.addEventListener("keydown", activate); image.addEventListener("load", requestMeasure); update(props);
    const relabel = dom.isConnected ? 0 : dom.ownerDocument.defaultView?.requestAnimationFrame(label) ?? 0;
    return { update, ignoreEvent: () => true,
      destroy() { source.destroy(); if (relabel) dom.ownerDocument.defaultView?.cancelAnimationFrame(relabel); actions?.destroy(); anchor.release(); figure.removeEventListener("focusin", showActions); figure.removeEventListener("focusout", blur); figure.removeEventListener("dblclick", activate); figure.removeEventListener("keydown", activate); image.removeEventListener("load", requestMeasure); figure.remove(); }
    };
  };
}
