import { Type } from "typebox";
import type { QuireAiPicturePort } from "@quirekit/ai-contract";
import type { QuireDocumentTool } from "../document-tools";
import { describeQuireAiEditReference, listQuireAiEditReferenceNames } from "./edit/catalog";
import type { QuireAiEditOperationSchema } from "./edit/schema";
import type { QuireAiManager } from "./types";

const helpParameters = Type.Object({
  names: Type.Array(Type.String({ minLength: 1 }), { minItems: 1, maxItems: 20, description: "Operation, action, format or block kind names as document_edit lists them." })
}, { additionalProperties: false });

/** Core tool name for the editing reference. */
export const QUIRE_AI_DOCUMENT_HELP_TOOL_NAME = "document_help" as const;

/**
 * Creates the editing reference tool: the full parameters of what `document_edit` lists briefly.
 * @param manager - AI manager supplying facts.
 * @param operation - Strict operation union.
 * @param pictures - Host pictures, listed under the name `pictures`.
 * @returns Read-only reference tool.
 */
export function createQuireAiHelpTool(
  manager: QuireAiManager, operation: QuireAiEditOperationSchema, pictures?: QuireAiPicturePort
): QuireDocumentTool<typeof helpParameters, string> {
  const tool: QuireDocumentTool<typeof helpParameters, string> = {
    name: QUIRE_AI_DOCUMENT_HELP_TOOL_NAME,
    label: "Editing Reference",
    description: [
      "Returns the full parameters, with explanations, of document_edit operations, actions, formats and block kinds by name. Use it before an action or block kind whose brief signature is not enough.",
      ...(pictures === undefined ? [] : ["The name `pictures` lists the pictures an insert action can place, such as portraits, icons and decorations."])
    ].join(" "),
    parameters: helpParameters,
    effect: "read" as const,
    /**
     * Looks up each name.
     * @param input - Names to describe.
     * @returns The references, with unknown names and the known ones listed.
     */
    async execute(input) {
      const found: string[] = [];
      const unknown: string[] = [];
      for (const name of new Set(input.names)) {
        const reference = name === "pictures" && pictures !== undefined ? describePictures(pictures) : describeQuireAiEditReference(manager.registry, operation, name);
        if (reference === null) unknown.push(name);
        else found.push(reference);
      }
      const missing = unknown.length === 0 ? [] : [`Unknown: ${unknown.join(", ")}. Known names: ${listQuireAiEditReferenceNames(manager.registry, operation).join(", ")}.`];
      const text = [...found, ...missing].join("\n\n");
      return { value: text, summary: text };
    }
  };
  return Object.freeze(tool);
}

/**
 * @param pictures - Host pictures.
 * @returns Catalog lines grouped by category, with the palettes.
 */
function describePictures(pictures: QuireAiPicturePort): string {
  const byCategory = new Map<string, string[]>();
  for (const asset of pictures.list()) {
    byCategory.set(asset.category, [...(byCategory.get(asset.category) ?? []), `- ${asset.id} (width:height ${Number(asset.aspect.toFixed(2))}): ${asset.description}`]);
  }
  const palettes = pictures.palettes();
  return [
    `Pictures (write the id as \`asset\`; palettes: ${palettes.join(", ")}, default ${palettes[0] ?? "none"}; use one palette across a document):`,
    ...[...byCategory.entries()].flatMap(([category, lines]) => [`${category}:`, ...lines])
  ].join("\n");
}
