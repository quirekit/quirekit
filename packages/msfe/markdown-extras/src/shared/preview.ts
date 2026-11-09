import type { ComponentViewRenderer } from "@quirekit/msfe-core";
import type { PreviewProps, PreviewControlProps, PreviewTypography, PreviewRendererOptions } from "./types";
import { presentContainer } from "./container";
import { hoistPreviewStyles } from "./styles";

/**
 * Mounts source-derived output and optional host controls under the component lifetime.
 * @param load - Renderer-owned safe HTML generation.
 * @param controls - Host component-library renderer for source actions.
 * @param options - Renderer family's pending presentation and source-bound cache.
 * @returns A retained renderer with source fallback and late-result rejection.
 */
export function previewRenderer(load: (props: PreviewProps, signal: AbortSignal, typography: PreviewTypography, owner: Document) => Promise<string>, controls?: ComponentViewRenderer<PreviewControlProps>, options: PreviewRendererOptions = {}): ComponentViewRenderer<PreviewProps> {
  return mount => {
    const { dom, props, scope, requestMeasure } = mount;
    const output = dom.ownerDocument.createElement("span");
    output.className = `msfe-preview msfe-preview-${props.kind}`;
    output.dataset.msfePreview = props.kind;
    const gesture = props.kind === "inlineMath" ? "click" : options.activation ?? "click";
    const actions = dom.ownerDocument.createElement("span");
    actions.className = "msfe-preview-controls";
    let target = props.target(props.range);
    let status: PreviewControlProps["status"] = "loading";
    let current: PreviewProps | undefined;
    let disposed = false;
    let releaseStyles = () => {};
    /** @param html - Safe rendered output. Shows it with its stylesheets hoisted out of the scrolling content. */
    const present = (html: string) => { releaseStyles(); output.innerHTML = html; releaseStyles = hoistPreviewStyles(output); };
    /** @param next - Current semantic inputs. @returns Actions without source offsets or a product skin. */
    const controlProps = (next: PreviewProps): PreviewControlProps => ({ kind: next.kind, readOnly: next.readOnly, status,
      revealSource: () => !disposed && target.reveal(), retry: () => { if (!disposed && current && status === "error") render(current); } });
    dom.append(output);
    if (controls) dom.append(actions);
    const control = controls?.({ ...mount, dom: actions, props: controlProps(props) });
    let request: ReturnType<typeof scope.fork> | undefined;
    let down: { x: number; y: number; moved: boolean } | undefined;
    output.addEventListener("pointerdown", event => { down = event.button === 0 ? { x: event.clientX, y: event.clientY, moved: false } : undefined; });
    output.addEventListener("pointermove", event => { if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 4) down.moved = true; });
    output.addEventListener("pointercancel", () => { down = undefined; });
    output.addEventListener(gesture, event => {
      const start = down; down = undefined;
      if (start && !start.moved && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 4 && !current?.readOnly) target.reveal();
    });
    if (gesture === "dblclick") output.addEventListener("keydown", event => { if (event.key === "Enter" && !current?.readOnly && target.reveal()) event.preventDefault(); });
    /** @param next - Immutable body; permission-only updates reuse rendered output. */
    function update(next: PreviewProps): void {
      presentContainer(dom, next.container);
      const same = current?.text === next.text && current.kind === next.kind && current.language === next.language;
      if (current && current.source !== next.source) { target.release(); target = next.target(next.range); }
      current = next;
      if (same) { if (status === "error" || status === "loading" && options.loadingSource !== false) output.textContent = next.source; control?.update(controlProps(next)); return; }
      render(next);
    }
    /** @returns The font role inherited at the output's mount point. */
    const typography = (): PreviewTypography => {
      const style = dom.ownerDocument.defaultView!.getComputedStyle(dom);
      return { fontFamily: style.fontFamily, fontSize: parseFloat(style.fontSize) };
    };
    /** @param next - Current source inputs. Starts only for changed content or explicit retry. */
    function render(next: PreviewProps): void {
      let font: PreviewTypography | undefined;
      request?.dispose();
      // Rehydrate only exact successful output before mounting/measurement. No
      // engine request or font measurement is admitted on a source-only cache hit.
      const cached = options.cache?.get(next, dom.ownerDocument, dom.isConnected ? typography() : undefined);
      if (cached !== undefined) {
        present(cached); status = "ready"; output.dataset.status = status; output.setAttribute("aria-busy", "false");
        control?.update(controlProps(next)); requestMeasure(); return;
      }
      releaseStyles(); releaseStyles = () => {};
      output.textContent = options.loadingSource === false ? "" : next.source;
      status = "loading"; output.dataset.status = status;
      output.setAttribute("aria-busy", "true");
      control?.update(controlProps(next));
      request = scope.acquire<string | null>(async signal => {
        try {
          // Acquisition runs after mounting. Read the real inherited role once per render,
          // before diagram measurement, rather than changing its font after SVG layout.
          font = typography();
          // A preview created before mounting could not read its font for the synchronous lookup.
          const mounted = options.cache?.get(next, dom.ownerDocument, font);
          return { value: mounted ?? await load(next, signal, font, dom.ownerDocument) };
        }
        catch { return { value: null }; }
      }, result => {
        status = result === null ? "error" : "ready"; output.dataset.status = status;
        output.setAttribute("aria-busy", "false");
        if (result !== null) { options.cache?.set(next, dom.ownerDocument, result, font); present(result); }
        else output.textContent = current!.source;
        control?.update(controlProps(current!));
        requestMeasure();
      });
    }
    update(props);
    return { update,
      /** @param event - Static output or host control event. @returns Whether the component, rather than native CM selection, owns it. */
      ignoreEvent: event => !output.contains(event.target as globalThis.Node | null),
      destroy() { disposed = true; request?.dispose(); releaseStyles(); target.release(); control?.destroy(); output.remove(); actions.remove(); } };
  };
}
