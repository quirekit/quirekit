import { mindMapPreviewSource } from "@quirekit/mind-map";
import { bindImageSource, type ComponentViewRenderer, type MsfeEditor } from "@quirekit/msfe-core";
import type { MsfeMindMapOptions, MsfeMindMapPreviewProps } from "./types";
import { openMsfeMindMap } from "./session";

/** @param editor - Mounted source owner. @param open - Product dialog composition. @param resolve - Host mapping of stored preview addresses. @returns Lightweight preview without an inner editor. */
export function mindMapPreview(editor: MsfeEditor, open: MsfeMindMapOptions["open"], resolve?: MsfeMindMapOptions["resolve"]): ComponentViewRenderer<MsfeMindMapPreviewProps> {
  return ({ dom, props, requestMeasure }) => {
    const figure = dom.ownerDocument.createElement("figure"), image = dom.ownerDocument.createElement("img");
    figure.dataset.qkMindMap = "true"; figure.tabIndex = 0;
    figure.style.cssText = "margin:16px 0;border:1px solid var(--qk-color-border-subtle,#e2e8f0);border-radius:8px;overflow:hidden;background:white;cursor:pointer";
    image.style.cssText = "display:block;max-width:100%;max-height:460px;width:auto;height:auto;margin:auto;object-fit:contain";
    figure.append(image); dom.append(figure);
    const source = bindImageSource(image, resolve);
    let current = props, anchor = editor.captureAnchor(props.range);
    /** @param next - Accepted semantic source. */
    function update(next: MsfeMindMapPreviewProps): void {
      if (current.mind !== next.mind) { anchor.release(); anchor = editor.captureAnchor(next.range); }
      current = next; image.hidden = !next.mind.preview; source.set(mindMapPreviewSource(next.mind));
      if (next.mind.preview) { image.width = next.mind.preview.width; image.height = next.mind.preview.height; }
      // The title and double-click hint stay accessible; host selection UI owns the visible actions.
      image.alt = next.mind.title; figure.setAttribute("aria-label", `${next.mind.title}${next.readOnly ? "" : " · 双击编辑"}`); requestMeasure();
    }
    /** @param event - Pointer or keyboard preview activation. */
    function activate(event: Event): void {
      if (event.type === "keydown" && (event as KeyboardEvent).key !== "Enter") return;
      const range = anchor.getRange();
      if (!range || !anchor.target() || current.readOnly) return;
      if (openMsfeMindMap(editor, open, range, current.mind)) { event.preventDefault(); event.stopPropagation(); }
    }
    figure.addEventListener("dblclick", activate); figure.addEventListener("keydown", activate); image.addEventListener("load", requestMeasure); update(props);
    return { update,
      /** @returns Preview interaction never becomes source text input. */
      ignoreEvent: () => true,
      /** Releases the source anchor and every native listener. */
      destroy() { source.destroy(); anchor.release(); figure.removeEventListener("dblclick", activate); figure.removeEventListener("keydown", activate); image.removeEventListener("load", requestMeasure); figure.remove(); }
    };
  };
}
