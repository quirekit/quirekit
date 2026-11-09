import { createWordStylesHtmlPlugin } from "./serialization/plugin";
import { resolveWordNamedCharacterStyle } from "./model/character";
import { resolveWordDocumentStyleRegistry } from "./model/theme/context";
import { declareQuireLayoutDependency } from "@quirekit/core";
import {
  Extension,
  type QuireNodeCanvasTextStyle,
  type QuireNodeCanvasTextStyleMap
} from "@quirekit/core";
import {
  resolveWordParagraphFormatting,
  wordHeadingCanvasFontScales
} from "@quirekit/classic-paragraph-model";
import { createWordParagraphStyleCommands } from "./commands";
import {
  createDefaultWordParagraphStyleRegistry,
  resolveWordParagraphAppearance,
  type WordParagraphStyleRegistry,
  type WordTableStyleTextLayer
} from "./model";
import { createWordStylesRuntimePlugin } from "./runtime";
import { defaultWordParagraphStyleNodeNames } from "./selection";
import { createWordStylesHTMLSerializationTransforms } from "./serialization";
import type { WordStylesOptions, WordStylesStorage } from "./types";
import { wordStylesAiCapabilities } from "./ai/facts";
import { WordCharacterStyle } from "./character/extension";
import type {} from "@quirekit/collab-contract";

/** Document-level named Word paragraph style registry and inheritance behavior. */
export const WordStyles = Extension.create<WordStylesOptions, WordStylesStorage>({
  name: "wordStyles",
  priority: 120,
  /** @returns Identity-preserving character style support. */
  addExtensions() { return [WordCharacterStyle]; },
  /** @returns Collaboration rules: styles are keyed by id, so concurrent edits merge style by style and field by field. */
  addCollabRules() {
    return [
      { kind: "version", version: "1" },
      { kind: "root", attribute: "wordStyleRegistry", strategy: "merge" }
    ];
  },

  /**
   * Supplies the textblock types that participate in named paragraph styles.
   *
   * @returns Default Word paragraph style options.
   */
  addOptions() {
    return { types: defaultWordParagraphStyleNodeNames };
  },

  /**
   * Creates the document-aware style registry used by renderer closures.
   *
   * @returns Mutable style resolver storage.
   */
  addStorage() {
    return { registry: createDefaultWordParagraphStyleRegistry() };
  },

  /**
   * Adds the canonical document-level named style registry attribute.
   *
   * @returns Global document attribute declaration.
   */
  addGlobalAttributes() {
    return [{
      types: ["doc"],
      attributes: {
        wordStyleRegistry: { default: null, rendered: false }
      }
    }];
  },

  /**
   * Installs named paragraph style registry and application commands.
   *
   * @returns Word paragraph style commands.
   */
  addAiCapabilities() {
    return wordStylesAiCapabilities;
  },

  addCommands() {
    return createWordParagraphStyleCommands(this.options.types);
  },

  /**
   * Synchronizes style resolver storage before mounted views observe updates.
   *
   * @returns Runtime plugin that applies registry changes pre-render.
   */
  addProseMirrorPlugins() {
    return [createWordStylesRuntimePlugin(this.storage), createWordStylesHtmlPlugin(this.options.types)];
  },


  /**
   * Projects effective named style typography into Canvas and SVG layout.
   *
   * @returns Node text-style resolvers keyed by textblock node name.
   */
  addNodeCanvasTextStyles() {
    const storage = this.storage;
    return Object.fromEntries(
      this.options.types.map((type) => [
        type,
        (node) => resolveWordStylesNodeTextStyle(
          storage.registry,
          node.attrs.wordParagraph
        )
      ])
    ) as QuireNodeCanvasTextStyleMap;
  },

  /**
   * Projects the latest effective named-style appearance into retained HTML.
   *
   * @returns Document-aware HTML transforms keyed by textblock node name.
   */
  addNodeHTMLSerializationTransforms() {
    const storage = this.storage;
    return createWordStylesHTMLSerializationTransforms(
      this.options.types,
      () => storage.registry
    );
  },

  /**
   * Resolves imported registry data before the first mounted view layout.
   */
  onBeforeCreate() {
    if (this.editor === undefined) return;
    this.storage.registry = resolveWordDocumentStyleRegistry(this.editor.state.doc.attrs);
  },

});

/**
 * Resolves one paragraph's node-level typography from styles and direct outline.
 *
 * @param registry - Active document paragraph style registry.
 * @param formattingValue - Candidate paragraph formatting node attribute.
 * @param tableLayer - Table-style layer for paragraphs inside a styled table cell.
 * @returns Effective Canvas/SVG text style.
 */
export function resolveWordStylesNodeTextStyle(
  registry: WordParagraphStyleRegistry,
  formattingValue: unknown,
  tableLayer?: WordTableStyleTextLayer
): QuireNodeCanvasTextStyle {
  const formatting = resolveWordParagraphFormatting(formattingValue);
  const appearance = resolveWordParagraphAppearance(registry, formatting, tableLayer);
  const outlineLevel = appearance.paragraph.outlineLevel;
  const text = { ...appearance.text, ...(registry.defaultCharacterStyleId ? { defaultInlineStyle: resolveWordNamedCharacterStyle(registry, null, appearance.text).text } : {}) };
  if (outlineLevel === 9) delete text.documentOutlineLevel;
  const headingLevel = appearance.namedStyle.style.role === "heading"
    ? appearance.namedStyle.style.headingLevel
    : null;
  if (headingLevel === null) {
    return outlineLevel === null || outlineLevel === 9
      ? text
      : {
          ...text,
          documentOutlineLevel: outlineLevel + 1
        };
  }
  return {
    ...text,
    documentFontRole: "heading",
    ...(outlineLevel === 9 ? {} : { documentOutlineLevel: outlineLevel === null ? headingLevel : outlineLevel + 1 }),
    fontScale:
      appearance.text.fontScale ?? (registry.textPropertiesVersion === 1 ? 1 : wordHeadingCanvasFontScales[headingLevel]),
    lineHeightScale:
      appearance.text.lineHeightScale ?? (registry.textPropertiesVersion === 1 ? 1 : wordHeadingCanvasFontScales[headingLevel]),
    fontWeight: appearance.text.fontWeight ?? (registry.textPropertiesVersion === 1 ? "normal" : "bold"),
    ...(appearance.text.fontStyle !== undefined
      ? { fontStyle: appearance.text.fontStyle }
      : {}),
    ...(appearance.text.fontFamily !== undefined
      ? { fontFamily: appearance.text.fontFamily }
      : {})
  };
}

// The declaration belongs to this implementation; overriding the field requires
// its own proof. Engine still validates document, geometry and font inputs.
declareQuireLayoutDependency(WordStyles.config.addNodeCanvasTextStyles!, {
  kind: "document",
  /** @param context - Current configured owner. @returns Live non-document dependencies. */
  getVersion: ({ extension }) => [extension?.storage.registry, ...(extension?.options.types ?? [])]
});
