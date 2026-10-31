import { Type, type TSchema } from "typebox";
import type { QuireAiPicturePort } from "@quirekit/ai-contract";
import type { QuireDocumentTool } from "../document-tools";
import { briefQuireAiSchema } from "../manager/edit/brief";
import type { QuireAiSourceDocument } from "./types";
import { createQuireAiSourceEditOperation } from "./edit/schema";

const helpParameters = Type.Object({
  names: Type.Array(Type.String({ minLength: 1 }), { minItems: 1, maxItems: 20, description: "Operation or command names as document_edit lists them." })
}, { additionalProperties: false });

/**
 * Creates `document_help` of a source document: the full parameters of operations and commands.
 * @param document - Source document port.
 * @param ports - Host resources; `pictures` adds the built-in picture catalog under that name.
 * @returns Read-only reference tool.
 */
export function createQuireAiSourceHelpTool(document: QuireAiSourceDocument, ports: Readonly<Record<string, unknown>> = {}): QuireDocumentTool<typeof helpParameters, string> {
  const pictures = ports.pictures as QuireAiPicturePort | undefined;
  return Object.freeze({
    name: "document_help",
    label: "Editing Reference",
    description: "Returns the full parameters, with explanations, of document_edit operations and commands by name. Use it before a command whose brief signature is not enough."
      + (pictures === undefined ? "" : " The name `pictures` lists the built-in pictures and palettes a picture command can place."),
    parameters: helpParameters,
    effect: "read" as const,
    async execute(input) {
      const commands = new Map([...document.commands()].filter(([, descriptor]) => descriptor.risk !== "read"));
      const branches = createQuireAiSourceEditOperation(commands).anyOf as readonly TSchema[];
      const byName = new Map(branches.map(branch => [String((branch as { properties: { op: { const: unknown } } }).properties.op.const), branch]));
      const found: string[] = [];
      const unknown: string[] = [];
      for (const name of new Set(input.names)) {
        if (name === "pictures" && pictures !== undefined) { found.push(describePictures(pictures)); continue; }
        const branch = byName.get(name);
        if (branch === undefined) { unknown.push(name); continue; }
        const description = commands.get(name)?.description;
        found.push(`${name}${description === undefined ? "" : ` — ${description}`}\n${briefQuireAiSchema(branch, { depth: 6, comments: true })}`);
      }
      const missing = unknown.length === 0 ? [] : [`Unknown: ${unknown.join(", ")}. Known names: ${[...byName.keys()].join(", ")}.`];
      const text = [...found, ...missing].join("\n\n");
      return { value: text, summary: text };
    }
  } satisfies QuireDocumentTool<typeof helpParameters, string>);
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
