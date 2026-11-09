import { BlockFootnotes } from "../notes/extension";
import { BlockRichContent } from "../rich-content/extension";
import { BlockColumns, BlockColumn } from "../columns/extension";
import { BlockAsset, BlockImageGallery } from "../resources/extension";
import { BlockInlineAttachment } from "../attachments/extension";
import { BlockWebCard } from "../web-card/extension";
import { BlockDefinitions } from "../definitions/extension";
import { BlockInlineContent } from "../inline-content/extension";
import { BlockSections } from "../sections/extension";
import { withBlockMedia } from "../media/extension";
import { BlockContextMenus } from "../ui/blocks/extension";
import { withBlockAtomicSelection } from "../selection/atomic";
import { BlockImage } from "../media/image";
import { BlockScriptFonts } from "../typography/script-fonts";
import { DataView } from "@quirekit/extension-data-view";
import { openBlockDataView } from "../data-view/open";
import { renderBlockDataView } from "../data-view/inline/registry";
import { TextDiagram } from "@quirekit/extension-text-diagram";
import { openBlockTextDiagramDialog } from "../text-diagram/open";
import { Flowchart } from "@quirekit/extension-flowchart";
import { MindMap } from "@quirekit/extension-mind-map";
import { openBlockMindMapDialog } from "../mind-map/open";
import { openBlockFlowchartDialog } from "../flowchart/open";
import type { QuireAnyExtension } from "@quirekit/core";
import { BlockCollaboration } from "../collab/extension";
import { Link } from "@quirekit/extension-link";
import { TextStyleKit } from "@quirekit/extension-text-style";
import { BlockInteraction, CharacterCount, Formatting } from "@quirekit/extensions";
import { Search } from "@quirekit/extension-search";
import { StarterKit } from "@quirekit/starter-kit";
import { BlockCode } from "../code/extension";
import { BlockHorizontalRule } from "../rule/extension";
import { BlockContainer } from "../containers/extension";
import { BlockMath } from "../math/extension";
import { createBlockParagraphExtensions } from "../paragraph/extension";
import { BlockWritingHint } from "../ui/insert/placeholder";
import type { BlockEditorPresetOptions } from "./types";
import { Whiteboard } from "@quirekit/extension-whiteboard";
import { openBlockWhiteboardDialog, renderBlockWhiteboardScene, renameBlockWhiteboard, mountWhiteboardActions } from "../whiteboard/open";

/**
 * Composes the generic document profile without a mounted view or product UI.
 *
 * @param options - Existing feature configuration and explicit bundle opt-outs.
 * @returns Fresh extension instances owned by the consuming Core editor.
 */
export function createBlockEditorPreset(
  options: BlockEditorPresetOptions = {}
): readonly QuireAnyExtension[] {
  return [
    BlockCollaboration.configure({}),
    ...(options.richContent === false ? [] : [BlockRichContent.configure(options.richContent ?? {}), BlockColumns.configure({}), BlockColumn.configure({}), BlockAsset.configure({}), BlockInlineAttachment.configure({}), BlockImageGallery.configure({}), BlockWebCard.configure({})]),
    ...(options.bodyContent === false ? [] : [BlockFootnotes.configure({}), BlockDefinitions.configure({}), BlockInlineContent.configure({})]),
    ...(options.math === false ? [] : [BlockMath.configure({})]),
    ...(options.containers === false ? [] : [BlockContainer.configure({})]),
    ...(options.image === false ? [] : [withBlockMedia(BlockImage)]),
    ...(options.starterKit === false ? [] : [BlockWritingHint.configure({})]),
    ...(options.dataView === false ? [] : [withBlockAtomicSelection(DataView.configure({open: openBlockDataView, render: renderBlockDataView, ...options.dataView}))]),
    ...(options.textDiagram === false ? [] : [withBlockMedia(TextDiagram.configure({ open: openBlockTextDiagramDialog, ...options.textDiagram }))]),
    ...(options.mindMap === false ? [] : [withBlockMedia(MindMap.configure({ open: openBlockMindMapDialog, ...options.mindMap }))]),
    ...(options.flowchart === false ? [] : [withBlockMedia(Flowchart.configure({ open: openBlockFlowchartDialog, ...options.flowchart }))]),
    ...(options.whiteboard === false ? [] : [withBlockMedia(Whiteboard.configure({ open: openBlockWhiteboardDialog, rename: renameBlockWhiteboard, mountActions: mountWhiteboardActions, renderScene: renderBlockWhiteboardScene, ...options.whiteboard }))]),
    ...(options.starterKit === false ? [] : [StarterKit.configure({ ...options.starterKit, codeBlock: false, horizontalRule: false }),
      ...(options.starterKit?.horizontalRule === false ? [] : [BlockHorizontalRule.configure(options.starterKit?.horizontalRule ?? {})]),
      ...(options.starterKit?.codeBlock === false ? [] : [BlockCode.configure({ enableTabIndentation: true, ...options.starterKit?.codeBlock })])]),
    ...(options.paragraphFormat === false ? [] : createBlockParagraphExtensions()),
    ...(options.textStyle === false ? [] : [TextStyleKit.configure(options.textStyle), BlockScriptFonts]),
    ...(options.link === false ? [] : [Link.configure(options.link)]),
    ...(options.characterCount === false ? [] : [CharacterCount.configure(options.characterCount)]),
    ...(options.search === false ? [] : [Search.configure(options.search)]),
    ...(options.formatting === false ? [] : [Formatting.configure(options.formatting)]),
    ...(options.blockInteraction === false ? [] : [BlockSections.configure({}), BlockContextMenus.configure({}), BlockInteraction.configure({
      types: ["paragraph", "heading", "blockquote", "blockContainer", "codeBlock", "bulletList", "orderedList", "horizontalRule", "whiteboard", "flowchart", "mindMap", "textDiagram", "image", "dataView", "wordTable", "displayMath", "footnoteDefinition", "definitionList", "blockColumns", "blockAsset", "imageGallery", "webCard"],
      scopes: options.richContent === false ? ["doc"] : ["doc", "blockColumns", "blockColumn"],
      ...options.blockInteraction
    })])
  ];
}
