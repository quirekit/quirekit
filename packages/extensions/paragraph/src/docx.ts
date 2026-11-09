import type { QuireJSONContent } from "@quirekit/core";
import {
  createLitAstNodePreservation,
  defineDocxCodecServiceKey,
  docx,
  readLitAstNodePreservation,
  type LitAstNode
} from "@quirekit/lit-docx-contract";

type QuireMark = NonNullable<QuireJSONContent["marks"]>[number];

/** Host-owned advanced paragraph conversion used by the local structural codec. */
export interface ParagraphDocxService {
  /**
   * Imports one LitAST paragraph with document-level authorities.
   *
   * @param node - Source LitAST paragraph.
   * @param children - Already converted inline children.
   * @param path - Stable structural source path for carrier identity.
   * @returns Canonical paragraph node.
   */
  readonly importParagraph: (
    node: LitAstNode,
    children: readonly QuireJSONContent[],
    path: string
  ) => QuireJSONContent;
  /**
   * Exports one canonical paragraph with document-level authorities.
   *
   * @param node - Canonical paragraph node.
   * @param children - Already converted inline children.
   * @returns LitAST paragraph node.
   */
  readonly exportParagraph: (
    node: QuireJSONContent,
    children: readonly LitAstNode[]
  ) => LitAstNode;
}

/** Typed host-service key consumed by the paragraph structural codec. */
export const paragraphDocxServiceKey =
  defineDocxCodecServiceKey<ParagraphDocxService>(
    "quirekit.paragraph.codec"
  );

/** Bidirectional DOCX codec owned by the paragraph node extension. */
export const paragraphDocxCodec = docx.codec.node<
  QuireJSONContent,
  QuireMark
>({
  id: "extension.paragraph",
  modelType: "paragraph",
  import: {
    from: "paragraph",
    childContentKind: "inline",
    convert: ({ node, path, convertChildren, resolveService }) => {
      const children = convertChildren(node.children ?? []);
      const service = resolveService(paragraphDocxServiceKey);
      return [service?.importParagraph(node, children, path) ?? {
        type: "paragraph",
        attrs: {
          litAstNodePreservation: createLitAstNodePreservation(node)
        },
        content: [...children]
      }];
    }
  },
  export: {
    convert: ({ node, convertChildren, resolveService }) => {
      const children = convertChildren(
        normalizeEmptyParagraphContent(node)
      );
      const service = resolveService(paragraphDocxServiceKey);
      return [service?.exportParagraph(node, children)
        ?? exportPreservedParagraph(node, children)];
    }
  },
  capabilities: {
    fields: [{
      field: "litAstNodePreservation",
      import: {
        disposition: "preserved",
        preservation: {
          authority: "Imported LitAST attrs, rawXml, and metadata.",
          invalidation: "An explicit paragraph source-preservation edit."
        }
      },
      export: {
        disposition: "preserved",
        preservation: {
          authority: "Imported LitAST attrs, rawXml, and metadata.",
          invalidation: "An explicit paragraph source-preservation edit."
        }
      }
    }]
  }
});

/**
 * Removes an unpreserved browser placeholder while retaining imported whitespace.
 *
 * @param node - Canonical paragraph with current inline content and source provenance.
 * @returns Original content or an empty sequence for a placeholder-only paragraph.
 */
function normalizeEmptyParagraphContent(
  node: QuireJSONContent
): readonly QuireJSONContent[] {
  const content = node.content ?? [];
  const source = readRecord(readRecord(node.attrs)?.litAstNodePreservation);
  return source === undefined && content.length === 1
    && content[0]?.type === "text"
    && content[0].text === "\u00A0"
    && (content[0].marks?.length ?? 0) === 0
    ? []
    : content;
}

/**
 * Exports preserved source fields when no advanced host service is installed.
 *
 * @param node - Canonical paragraph node.
 * @param children - Already converted inline children.
 * @returns Raw-preserving LitAST paragraph.
 */
function exportPreservedParagraph(
  node: QuireJSONContent,
  children: readonly LitAstNode[]
): LitAstNode {
  const preserved = readLitAstNodePreservation(
    readRecord(node.attrs)?.litAstNodePreservation
  );
  const attrs = readRecord(preserved.attrs);
  const meta = readRecord(preserved.meta);
  return {
    type: "paragraph",
    ...(attrs === undefined ? {} : { attrs }),
    ...(typeof preserved.rawXml === "string" ? { rawXml: preserved.rawXml } : {}),
    ...(meta === undefined ? {} : { meta }),
    children: [...children]
  };
}

/**
 * Reads one record without accepting arrays.
 *
 * @param value - Candidate record.
 * @returns Record or undefined.
 */
function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}
