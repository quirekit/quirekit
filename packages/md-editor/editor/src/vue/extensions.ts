import { MsfeDataView } from "@quirekit/msfe-data-view";
import { openMdDataView } from "./data-view/open";
import DataViewInline from "./data-view/inline.vue";
import { MsfeFlowchart } from "@quirekit/msfe-flowchart";
import { MsfeMindMap } from "@quirekit/msfe-mind-map";
import { openMdMindMapDialog } from "./mind-map/open";
import { openMdFlowchartDialog } from "./flowchart/open";
import { VueNodeViewRenderer, VueComponentViewRenderer } from "@quirekit/msfe-vue";
import { TaskItem } from "@quirekit/msfe-prose";
import { Image as ImageFeature } from "@quirekit/msfe-image";
import { createMdEditorExtensions } from "../editor";
import { ProseCodeBlock, ProseHeading } from "../presentation/features";
import { mdContainerTypes } from "../presentation/container";
import { mdEditorMessages } from "./messages";
import type { MdEditorLocale } from "./types";
import type { AnyExtension } from "@quirekit/msfe-core";
import type { MdEditorExtensionOptions } from "../types";
import Task from "./controls/task.vue";
import Code from "./controls/code.vue";
import Disclosure from "./controls/disclosure.vue";
import HighlightIcon from "./highlight/icon.vue";
import HeadingFold from "./controls/heading-fold.vue";
import Preview from "./controls/preview.vue";
import Image from "./controls/image.vue";
import { Math, Mermaid, TextDiagrams, Footnotes, type PreviewOptions } from "@quirekit/msfe-markdown-extras";
import { MsfeWhiteboard } from "@quirekit/msfe-whiteboard";
import { openMdWhiteboardDialog, renameMdWhiteboard } from "./whiteboard/open";

/** @param locale - Control language. @param options - Explicit feature and container overrides. @param edit - Host-owned preview editing dialog. @returns Product preset using the existing Vue/provider host. */
export function vueMdEditorExtensions(locale: MdEditorLocale, options: MdEditorExtensionOptions = {}, edit?: PreviewOptions["edit"]): readonly AnyExtension[] {
  const text = mdEditorMessages[locale];
  // Diagram previews stored by the host resolve through the same mapping as Markdown images.
  const previewSource = options.imageSource ? { resolve: options.imageSource } : {};
  return createMdEditorExtensions({
    ...(options.inlineBoundaries ? { inlineBoundaries: options.inlineBoundaries } : {}),
    ...(options.view ? { view: options.view } : {}),
    features: {
      heading: ProseHeading.configure({ controls: VueComponentViewRenderer(HeadingFold),
        toggleLabel: (expanded, title) => `${expanded ? text.collapse : text.expand} ${title}` }),
      taskItem: TaskItem.extend({ addNodeView: () => VueNodeViewRenderer(Task) }),
      codeBlock: ProseCodeBlock.extend({ addNodeView: () => VueNodeViewRenderer(Code) }).configure({ emptyLineLabel: locale === "en" ? "Enter code" : "输入代码" }),
      image: ImageFeature.extend({ addNodeView: () => VueNodeViewRenderer(Image), addCodeMirrorExtensions: () => [] }).configure({
        ...(options.imageSource ? { resolve: async (source: string, signal: AbortSignal) => {
          const resolved = await options.imageSource!(source, signal);
          return typeof resolved === "string" ? { url: resolved } : resolved;
        } } : {}),
        ...(options.images ? { upload: options.images } : {}),
      }),
      ...options.features,
    },
    containers: options.containers === false ? false : { types: mdContainerTypes,
      controls: VueComponentViewRenderer(Disclosure), detailsOpen: false, highlightIcon: VueComponentViewRenderer(HighlightIcon),
      highlightLabel: emoji => `${text.highlightIcon} ${emoji}`,
      toggleLabel: (expanded, title) => `${expanded ? text.collapse : text.expand} ${title}`, ...options.containers },
    extras: options.extras === false ? false : {
      math: Math.configure({ controls: VueComponentViewRenderer(Preview), activation: "dblclick", ...(edit ? { edit } : {}) }),
      textDiagram: TextDiagrams.configure({ controls: VueComponentViewRenderer(Preview), activation: "dblclick", ...(edit ? { edit } : {}) }),
      mermaid: Mermaid.configure({ controls: VueComponentViewRenderer(Preview), activation: "dblclick", image: true, ...(edit ? { edit } : {}) }),
      footnotes: Footnotes.configure({ referenceLabel: number => locale === "en" ? `Footnote ${number}: go to definition` : `脚注 ${number}：前往定义`,
        definitionLabel: number => locale === "en" ? `Footnote ${number}: return to reference` : `脚注 ${number}：返回引用` }),
      ...options.extras,
    },
    extensions: [MsfeDataView.configure({open: openMdDataView, render: VueComponentViewRenderer(DataViewInline)}), MsfeMindMap.configure({ open: openMdMindMapDialog, ...previewSource }), MsfeFlowchart.configure({ open: openMdFlowchartDialog, ...previewSource }), MsfeWhiteboard.configure({ open: openMdWhiteboardDialog, rename: renameMdWhiteboard, ...previewSource }), ...(options.extensions ?? [])],
  });
}
