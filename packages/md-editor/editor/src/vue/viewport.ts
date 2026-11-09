import { EditorView } from "@quirekit/cm-view";
import { Extension, type AnyExtension } from "@quirekit/msfe-core";

/** @param element - Owner's sticky toolbar, if present. @param bar - Visible bottom dock. @param panel - Current physical task. @returns Client-space occlusion inside the visible viewport, without counting the keyboard twice. */
export function documentChromeMargins(element: HTMLElement | null, bar: HTMLElement | null, panel: HTMLElement | null): { top: number; bottom: number } | null {
  const win = (element ?? bar ?? panel)?.ownerDocument.defaultView;
  if (!win) return null;
  const style = element ? win.getComputedStyle(element) : null;
  const top = style?.position === "sticky" ? element!.getBoundingClientRect().height + Math.max(0, Number.parseFloat(style.top) || 0) : 0;
  const visibleBottom = (win.visualViewport?.offsetTop ?? 0) + (win.visualViewport?.height ?? win.innerHeight);
  const rect = bar && win.getComputedStyle(bar).position === "fixed" ? bar.getBoundingClientRect() : null;
  const dockBottom = rect?.height ? Math.max(0, visibleBottom - rect.top) : 0;
  const panelRect = panel?.getBoundingClientRect();
  const bottom = Math.max(dockBottom, panelRect?.height ? Math.max(0, visibleBottom - panelRect.top) + 12 : 0);
  return top || bottom ? { top, bottom } : null;
}

/**
 * Makes product chrome participate in native caret scrolling and core navigation.
 * @param toolbar - Current toolbar element; absent/embedded chrome contributes no occlusion.
 * @param dock - Actual visible bottom dock; embedded chrome contributes no fixed occlusion.
 * @param task - Public active task content; physical exit alone does not keep an obstruction.
 * @returns Host geometry adapter using the existing CodeMirror scroll-margin contract.
 */
export function documentViewport(toolbar: () => HTMLElement | null, dock: () => HTMLElement | null = () => null, task: () => HTMLElement | null = () => null): AnyExtension {
  return Extension.create({
    name: "mdDocumentViewport",
    /** @returns A lazy geometry read, shared by all navigation and input consumers. */
    addCodeMirrorExtensions() {
      return EditorView.scrollMargins.of(view => {
        const chrome = documentChromeMargins(toolbar(), dock(), task()), win = view.dom.ownerDocument.defaultView;
        if (!win || !view.dom.closest('[data-layout="document"]')) return chrome;
        // A page-scrolled document keeps room below the caret instead of typing against the window's bottom edge.
        const writing = Math.min(120, Math.round((win.visualViewport?.height ?? win.innerHeight) * 0.15));
        return { top: chrome?.top ?? 0, bottom: Math.max(chrome?.bottom ?? 0, writing) };
      });
    },
  });
}
