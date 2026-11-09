import { Node, type QuireJSONContent } from "@quirekit/core";
import { createMindMapDocxCodec } from "@quirekit/mind-map-docx";
import { NodeSelection, Plugin, type EditorView, type Node as PMNode } from "@quirekit/pm";
import { readMindMapEmbed, serializeMindMapEmbed, mindMapPreviewSource } from "@quirekit/mind-map";
import { mindMapCommands } from "./commands";
import { mindMapLayout } from "./layout";
import { mindMapNodeView } from "./view";
import { openMindMap } from "./session";
import { forkMindMapSlice } from "./clipboard";
import { createMindMapRevisionPlugin } from "./revision";
import type { MindMapOptions, MindMapStorage } from "./types";
import { describeMindMapCommands } from "./ai/commands";
import { mindMapAiCapabilities } from "./ai/facts";

/** Generic source-backed atom; hosts supply their task UI through options. */
export const MindMap = Node.create<MindMapOptions, MindMapStorage>({
  name: "mindMap", group: "block", atom: true, selectable: true, draggable: true,
  /** @returns Product-owned UI hook, absent in headless consumers. */
  addOptions() { return { open: null, render: null }; },
  /** @returns Editor slot for Agent command preparation. */
  addStorage() { return { editor: undefined }; },
  /** Binds descriptors only after Core has allocated this editor. */
  onBeforeCreate() { this.storage.editor = this.editor; },
  /** Releases the editor reference. */
  onDestroy() { this.storage.editor = undefined; },
  /** @returns Opaque portable source, never split among presentation attributes. */
  addAttributes() { return { mind: { default: null, rendered: false } }; },
  /** @returns Pure typed host transactions. */
  addCommands() { return describeMindMapCommands(mindMapCommands(), () => this.storage.editor, this.options); },
  /** @returns Facts describing the source to the AI document view. */
  addAiCapabilities() { return mindMapAiCapabilities; },
  /** @returns Standard Word image projection and validated source recovery. */
  addDocx() { return createMindMapDocxCodec<QuireJSONContent, NonNullable<QuireJSONContent["marks"]>[number]>(); },
  /** @returns Generic retained-region layout without Word semantics. */
  addLayoutProviders() { return [mindMapLayout()]; },
  /** @returns Inert HTML preview with explicit edit activation. */
  addNodeView() { return props => mindMapNodeView(props, this.options); },
  /** @returns Source-preserving clipboard/HTML decoder. */
  parseHTML() { return [{ tag: "figure[data-qk-mind-map-source]",
    /** @param element - Imported figure. @returns Validated source or refusal. */
    getAttrs(element) {
    try { return { mind: readMindMapEmbed(JSON.parse(element.getAttribute("data-qk-mind-map-source") ?? "null")) }; } catch { return false; }
  } }]; },
  /** @param props - Current node. @returns HTML containing editable source and a safe raster preview. */
  renderHTML({ node }) {
    const mind = readMindMapEmbed(node.attrs.mind);
    const width = Math.min(720, 460 * (mind.preview ? mind.preview.width / mind.preview.height : 12 / 7));
    return ["figure", { "data-qk-mind-map-source": serializeMindMapEmbed(mind), style: `width:100%;max-width:${width}px` },
      mind.preview ? ["img", { src: mindMapPreviewSource(mind)!, alt: mind.title, width, style: "display:block;width:100%;height:auto" }] : ["figcaption", {}, mind.title]];
  },
  /** @param props - Current node. @returns Plain-text fallback for unsupported consumers. */
  renderText({ node }) { return `[思维导图：${node.attrs.mind?.title ?? "未命名"}]`; },
  /** @returns Canvas-compatible object activation through public PM handlers. */
  addProseMirrorPlugins() {
    const editor = this.editor, open = this.options.open;
    if (!editor) return [createMindMapRevisionPlugin()];
    return [createMindMapRevisionPlugin(), new Plugin({ props: {
      transformPasted: forkMindMapSlice,
      /** @param _view - Mounted view. @param _pos - Pointer position. @param node - Hit node. @param pos - Atom start. @param _event - Native activation. @param direct - Direct object hit. @returns Whether the task opened. */
      handleDoubleClickOn(_view: EditorView, _pos: number, node: PMNode, pos: number, _event: MouseEvent, direct: boolean) { return direct && node.type.name === "mindMap" && openMindMap(editor, open, pos); },
      /** @param view - Current selection owner. @returns Whether the selected object opened. */
      handleDoubleClick(view: EditorView) { const selection = view.state.selection; return selection instanceof NodeSelection && selection.node.type.name === "mindMap" && openMindMap(editor, open, selection.from); },
      /** @param view - Current selection owner. @param event - Native key. @returns Whether Enter activated the selected mindMap. */
      handleKeyDown(view, event) { const selection = view.state.selection; return event.key === "Enter" && !event.ctrlKey && !event.metaKey && selection instanceof NodeSelection && selection.node.type.name === "mindMap" && openMindMap(editor, open, selection.from); }
    } })];
  },
});
