import type { ComponentViewRenderer } from "@quirekit/msfe-core";
import { renderTextDiagram } from "@quirekit/text-diagram/browser";
import type { PreviewActivation, PreviewOptions, PreviewTypography, PreviewProps } from "../shared/types";
import { previewRenderer } from "../shared/preview";
import { IMAGE_FONT_FAMILY, svgImageMarkup } from "../shared/image";
import { createTextDiagramPreviewCache } from "../text-diagram/cache";

const caches = { svg: createTextDiagramPreviewCache(), image: createTextDiagramPreviewCache() };

/** @param controls - Optional source controls. @param activation - Editing gesture. @param image - Show an SVG image rendered with system fonts.
 * @returns A cancellable diagram preview shared by all products. */
export function createMermaidRenderer(controls: PreviewOptions["controls"], activation?: PreviewActivation, image = false): ComponentViewRenderer<PreviewProps> {
  return previewRenderer(async (props, signal, typography, ownerDocument) => {
    if (!image) return (await renderTextDiagram("mermaid", props.text, { signal, typography, ownerDocument })).svg;
    const svg = (await renderTextDiagram("mermaid", props.text, { signal, typography: { ...typography, fontFamily: IMAGE_FONT_FAMILY }, ownerDocument })).svg;
    return svgImageMarkup(svg, ownerDocument);
  }, controls, { loadingSource: false, cache: image ? caches.image : caches.svg, ...(activation ? { activation } : {}) });
}
/** @param text - Exact Mermaid source. @param signal - Explicit lifetime. @param typography - Effective host font role.
 * @returns Sanitized SVG from the shared text-diagram owner. */
export async function renderMermaidSvg(text: string, signal: AbortSignal, typography: PreviewTypography): Promise<string> {
  return (await renderTextDiagram("mermaid", text, { signal, typography })).svg;
}
