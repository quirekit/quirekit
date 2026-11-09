import { declareQuireLayoutDependency } from "@quirekit/core";
import type {} from "@quirekit/collab-contract";
import {
  Extension,
  type QuireNodeCanvasTextStyleMap
} from "@quirekit/core";
import { wordParagraphAiCapabilities } from "./ai/facts";
import { WordColumnBreak } from "./column-break";
import { WordPageBreak } from "./page-break";
import { createWordParagraphCommands } from "./commands";
import { handleWordParagraphShiftTab, handleWordParagraphTab } from "./commands/tab-key";
import { createWordParagraphFormattingProvider } from "./formatting-provider";
import {
  resolveWordHeadingStyleLevel,
  resolveWordParagraphFormatting,
  wordHeadingCanvasFontScales
} from "./model";
import { defaultWordParagraphNodeNames } from "./selection/query";
import {
  createWordParagraphHTMLSerializationTransforms,
  createWordParagraphMarkdownSerializationTransforms
} from "./serialization";

/** Options for Word paragraph schema and commands. */
export interface WordParagraphOptions {
  /** Textblock node names that receive Word paragraph formatting. */
  readonly types: readonly string[];
}

/** Word-compatible paragraph attrs and transaction commands. */
export const WordParagraph = Extension.create<WordParagraphOptions>({
  name: "wordParagraph",

  addOptions() {
    return {
      types: defaultWordParagraphNodeNames
    };
  },

  /** @returns Independent run-level page- and column-break schemas and lifecycles. */
  addExtensions() { return [WordPageBreak, WordColumnBreak]; },
  /** @returns Collaboration rules: the compatibility switches are independent fields. */
  addCollabRules() {
    return [
      { kind: "version", version: "1" },
      { kind: "root", attribute: "wordParagraphCompatibility", strategy: "merge" }
    ];
  },

  addGlobalAttributes() {
    return [{
      types: [...this.options.types],
      attributes: {
        wordParagraph: { default: null, rendered: false }
      }
    }, {
      types: ["doc"],
      attributes: { wordParagraphCompatibility: { default: null, rendered: false } }
    }];
  },

  addCommands() {
    return createWordParagraphCommands(this.options.types);
  },

  /** Tab insertion is the last resort after form, table and list handlers. */
  keyboardShortcutPriority: 40,

  /** @returns Word Tab and Shift+Tab fallbacks for paragraphs. */
  addKeyboardShortcuts() {
    return {
      Tab: (context) => handleWordParagraphTab(context, this.options.types),
      "Shift-Tab": (context) => handleWordParagraphShiftTab(context, this.options.types)
    };
  },

  addFormattingProviders() {
    return [createWordParagraphFormattingProvider(this.options.types)];
  },

  addAiCapabilities() {
    return wordParagraphAiCapabilities;
  },

  addNodeCanvasTextStyles() {
    return Object.fromEntries(
      this.options.types.map((type) => [
        type,
        (node) => {
          const formatting = resolveWordParagraphFormatting(node.attrs.wordParagraph);
          const level = resolveWordHeadingStyleLevel(formatting);
          return level === null
            ? null
            : {
                documentFontRole: "heading" as const,
                ...(formatting.outlineLevel === 9 ? {} : { documentOutlineLevel: level }),
                fontScale: wordHeadingCanvasFontScales[level],
                fontWeight: "bold" as const
              };
        }
      ])
    ) as QuireNodeCanvasTextStyleMap;
  },

  addNodeHTMLSerializationTransforms() {
    return createWordParagraphHTMLSerializationTransforms(this.options.types);
  },

  addNodeMarkdownSerializationTransforms() {
    return createWordParagraphMarkdownSerializationTransforms(
      this.options.types
    );
  }
});

// The declaration belongs to this implementation; overriding the field requires
// its own proof. Engine still validates document, geometry and font inputs.
declareQuireLayoutDependency(WordParagraph.config.addNodeCanvasTextStyles!, {
  kind: "document",
  /** @param context - Current configured owner. @returns Live non-document dependencies. */
  getVersion: ({ extension }) => extension?.options.types
});
