import { resolveWordDocumentStyleRegistry } from "../model/theme/context";
import type { Node } from "@quirekit/pm";
import { projectWordParagraphLayoutFormatting, resolveWordParagraphFormatting, resolveWordDefaultTabInterval } from "@quirekit/classic-paragraph-model";
import { resolveWordStylesNodeTextStyle } from "../extension";
import {
  resolveWordParagraphAppearance,
  resolveWordTableCellParagraphAppearance
} from "../model";
import type { WordParagraphStyleRegistry, WordTableStyleTextLayer } from "../model";
import type { WordParagraphStyleContextToken, WordStylesParagraphModelSemantics } from "./types";
import { containsParagraphTab } from "./tabs";
import { wordStyleTextSignature } from "./text-signature";
import { resolveWordFontSelection } from "./font-selection";

/**
 * Creates Word named-style semantics for a layout engine's paragraph model.
 *
 * Effective formatting is transient layout input; it is never written back to
 * the node, because the registry and the paragraph-local delta remain separate
 * OOXML authorities for editing and round trips.
 *
 * @returns Paragraph semantics resolving style inheritance for layout.
 */
export function createWordStylesParagraphModelSemantics(): WordStylesParagraphModelSemantics {
  const tabPresence = new WeakMap<Node, boolean>();
  return {
    fontSelection: resolveWordFontSelection,
    styleContext: (doc) => {
      const registry = readRegistry(doc);
      const wordDocument = registry !== undefined || Object.prototype.hasOwnProperty.call(doc.attrs, "wordSettings");
      const defaultTabInterval = resolveWordDefaultTabInterval(doc.attrs.wordSettings);
      return {
        token: wordDocument ? { registry, defaultTabInterval } satisfies WordParagraphStyleContextToken : undefined,
        signature: wordDocument ? `word-paragraph-styles:${JSON.stringify(registry)}|default-tab:${defaultTabInterval}` : null
      };
    },
    resolveParagraph: (node, context, tableLayer) => {
      const authority = context.token as WordParagraphStyleContextToken | undefined;
      const registry = authority?.registry;
      const layer = tableLayer as WordTableStyleTextLayer | undefined;
      const direct = resolveWordParagraphFormatting(node.attrs.wordParagraph);
      const formatting = registry === undefined
        ? layer === undefined ? direct : resolveWordTableCellParagraphAppearance(null, direct, layer).paragraph
        : resolveWordParagraphAppearance(registry, direct, layer).paragraph;
      // PM node identity bounds rescans to changed paragraphs. Plain paragraphs
      // keep undefined tab geometry and remain eligible for retained tail reuse.
      let hasTab = authority === undefined ? false : tabPresence.get(node);
      if (hasTab === undefined) { hasTab = containsParagraphTab(node); tabPresence.set(node, hasTab); }
      return projectWordParagraphLayoutFormatting(formatting, node.attrs.wordParagraph != null,
        hasTab ? authority?.defaultTabInterval : undefined);
    },
    styleTextSignature: (node, context, tableLayer) => {
      const registry = (context.token as WordParagraphStyleContextToken | undefined)?.registry;
      const layer = tableLayer as WordTableStyleTextLayer | undefined;
      if (registry === undefined) return `word-paragraph-style-text:none|${JSON.stringify(layer?.text ?? null)}`;
      return wordStyleTextSignature(node, registry, layer);
    },
    nodeTextStyle: (nodeStyle, node, context, tableLayer) => {
      const registry = (context.token as WordParagraphStyleContextToken | undefined)?.registry;
      const layer = tableLayer as WordTableStyleTextLayer | undefined;
      if (layer?.text == null) return nodeStyle;
      // Without named styles, the table layer is the base below every node style.
      if (registry === undefined) return { ...layer.text, ...nodeStyle };
      if (!Object.prototype.hasOwnProperty.call(node.attrs, "wordParagraph")) return nodeStyle;
      const resolved = resolveWordStylesNodeTextStyle(registry, node.attrs.wordParagraph, layer);
      // The named-style resolver may deliberately remove a default size for
      // the table layer. Do not resurrect it from the earlier node-only pass.
      const retained = { ...nodeStyle };
      delete retained.fontSize; delete retained.fontScale; delete retained.lineHeightScale;
      return { ...retained, ...resolved };
    }
  };
}

/**
 * Reads the active style registry only when the document schema declares it.
 *
 * A document without Word Styles keeps the direct-formatting path; a declared
 * null value resolves to the built-in registry installed by the extension.
 *
 * @param doc - Document node for one layout snapshot.
 * @returns Valid active registry, or undefined outside Word Styles documents.
 */
function readRegistry(doc: Node): WordParagraphStyleRegistry | undefined {
  return Object.prototype.hasOwnProperty.call(doc.attrs, "wordStyleRegistry")
    ? resolveWordDocumentStyleRegistry(doc.attrs)
    : undefined;
}
