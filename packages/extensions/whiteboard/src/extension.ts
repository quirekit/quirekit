import { Node, type QuireJSONContent } from "@quirekit/core";
import { NodeSelection, Plugin, type EditorView, type Node as PMNode } from "@quirekit/pm";
import { readWhiteboardDocument, serializeWhiteboard, whiteboardPreviewSource, whiteboardPreviewSize } from "@quirekit/whiteboard";
import { whiteboardCommands } from "./commands";
import { whiteboardLayout } from "./layout";
import { whiteboardNodeView } from "./view";
import { openWhiteboard } from "./session";
import { forkWhiteboardSlice } from "./clipboard";
import { createWhiteboardRevisionPlugin } from "./revision";
import type { WhiteboardOptions, WhiteboardStorage } from "./types";
import { whiteboardAiCapabilities } from "./ai/facts";
import { describeWhiteboardCommands } from "./diagram/commands";
import { createWhiteboardDocxCodec } from "@quirekit/whiteboard-docx";

/** Generic source-backed atom; hosts supply their task UI through options. */
export const Whiteboard = Node.create<WhiteboardOptions, WhiteboardStorage>({
  name: "whiteboard", group: "block", atom: true, selectable: true, draggable: true,
  /** @returns Product-owned UI hook, absent in headless consumers. */
  addOptions() { return { open: null }; },
  /** @returns Isolated owner binding for asynchronous command preparation. */
  addStorage() { return { editor: undefined }; },
  /** Binds descriptors only after Core has allocated this editor. */
  onBeforeCreate() { this.storage.editor = this.editor; },
  /** Releases the source owner with the extension lifecycle. */
  onDestroy() { this.storage.editor = undefined; },
  /** @returns Opaque portable source, never split among presentation attributes. */
  addAttributes() { return { board: { default: null, rendered: false } }; },
  /** @returns Atomic commands with central AI descriptors. */
  addCommands() { return describeWhiteboardCommands(whiteboardCommands(), () => this.storage.editor, this.options); },
  /** @returns Source facts; the core owns all model tools. */
  addAiCapabilities() { return whiteboardAiCapabilities; },
  /** @returns Standard image projection and validated source recovery. */
  addDocx() { return createWhiteboardDocxCodec<QuireJSONContent, NonNullable<QuireJSONContent["marks"]>[number]>(); },
  /** @returns Generic retained-region layout without Word semantics. */
  addLayoutProviders() { return [whiteboardLayout()]; },
  /** @returns Inert HTML preview with explicit edit activation. */
  addNodeView() { return props => whiteboardNodeView(props, this.options); },
  /** @returns Source-preserving clipboard/HTML decoder. */
  parseHTML() { return [{ tag: "figure[data-qk-whiteboard-source]",
    /** @param element - Imported figure. @returns Validated source or refusal. */
    getAttrs(element) {
    try { return { board: readWhiteboardDocument(JSON.parse(element.getAttribute("data-qk-whiteboard-source") ?? "null")) }; } catch { return false; }
  } }]; },
  /** @param props - Current node. @returns HTML containing editable source and a safe raster preview. */
  renderHTML({ node }) {
    const board = readWhiteboardDocument(node.attrs.board);
    const { width } = whiteboardPreviewSize(board.preview);
    return ["figure", { "data-qk-whiteboard-source": serializeWhiteboard(board), style: `width:100%;max-width:${width}px` },
      board.preview ? ["img", { src: whiteboardPreviewSource(board)!, alt: board.title, width, style: "display:block;width:100%;height:auto" }] : ["figcaption", {}, board.title]];
  },
  /** @param props - Current node. @returns Plain-text fallback for unsupported consumers. */
  renderText({ node }) { return `[白板：${node.attrs.board?.title ?? "未命名"}]`; },
  /** @returns Canvas-compatible object activation through public PM handlers. */
  addProseMirrorPlugins() {
    const editor = this.editor, open = this.options.open;
    if (!editor) return [createWhiteboardRevisionPlugin()];
    return [createWhiteboardRevisionPlugin(), new Plugin({ props: {
      transformPasted: forkWhiteboardSlice,
      /** @param _view - Mounted view. @param _pos - Pointer position. @param node - Hit node. @param pos - Atom start. @param _event - Native activation. @param direct - Direct object hit. @returns Whether the task opened. */
      handleDoubleClickOn(_view: EditorView, _pos: number, node: PMNode, pos: number, _event: MouseEvent, direct: boolean) { return direct && node.type.name === "whiteboard" && openWhiteboard(editor, open, pos); },
      /** @param view - Current selection owner. @returns Whether the selected object opened. */
      handleDoubleClick(view: EditorView) { const selection = view.state.selection; return selection instanceof NodeSelection && selection.node.type.name === "whiteboard" && openWhiteboard(editor, open, selection.from); },
      /** @param view - Current selection owner. @param event - Native key. @returns Whether Enter activated the selected whiteboard. */
      handleKeyDown(view, event) { const selection = view.state.selection; return event.key === "Enter" && !event.ctrlKey && !event.metaKey && selection instanceof NodeSelection && selection.node.type.name === "whiteboard" && openWhiteboard(editor, open, selection.from); }
    } })];
  },
});
