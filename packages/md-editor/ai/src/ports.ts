import { createQuireAiPicturePort, rasterizeQuireAiSvg } from "@quirekit/ai-assistant";
import { renderFlowchartPicture } from "@quirekit/flow-editor";
import type { MdImageStorage } from "@quirekit/md-editor";
import { renderMindMapPicture } from "@quirekit/mind-editor";
import { msfeFlowchartRenderPort } from "@quirekit/msfe-flowchart";
import { msfeMindMapRenderPort } from "@quirekit/msfe-mind-map";
import { createTheme } from "@quirekit/ui";

/**
 * Host resources the assistant's figure commands use: offscreen renderers for flowcharts and mind
 * maps (the previews their dialogs would save) and, with image storage, the built-in pictures.
 * Text figures use the browser renderer of the editor.
 * @param ownerDocument - Document hosting offscreen renderers.
 * @param images - Host image storage.
 * @returns Ports for the document SDK.
 */
export function createMdEditorAiPorts(ownerDocument: Document, images: MdImageStorage | undefined): Readonly<Record<string, unknown>> {
  const theme = createTheme();
  return {
    [msfeFlowchartRenderPort]: (graph: Parameters<typeof renderFlowchartPicture>[0]) => renderFlowchartPicture(graph, { ownerDocument, theme }),
    [msfeMindMapRenderPort]: (mind: Parameters<typeof renderMindMapPicture>[0]) => renderMindMapPicture(mind, { theme }),
    ...(images === undefined ? {} : {
      pictures: createQuireAiPicturePort({
        rasterize: rasterizeQuireAiSvg,
        store: file => images.upload(new Blob([file.bytes as BlobPart], { type: file.mimeType }), { signal: new AbortController().signal, source: "ai", name: file.fileName })
      })
    })
  };
}
