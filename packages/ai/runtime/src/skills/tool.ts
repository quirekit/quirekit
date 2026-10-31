import { Type } from "typebox";
import type { QuireDocumentTool } from "../document-tools";
import type { QuireAiSkillEntry, QuireAiSkillLibrary } from "./types";
import { stripQuireAiSkillFrontMatter } from "./validate";

/** Core tool name for reading skills. */
export const QUIRE_AI_SKILL_READ_TOOL_NAME = "skill_read" as const;

/** Skills listed in the tool description; more are found with `query`. */
const catalogLimit = 60;

const skillParameters = Type.Object({
  id: Type.Optional(Type.String({ minLength: 1, description: "Skill to read; omit to list skills." })),
  file: Type.Optional(Type.String({ minLength: 1, description: "File of the skill other than SKILL.md, as its file list shows." })),
  query: Type.Optional(Type.String({ minLength: 1, description: "Without id: list only skills whose name, description or category contain this text." }))
}, { additionalProperties: false });

/**
 * Creates the skill reading tool: the catalog of enabled skills is in its description,
 * and a skill's instructions and files are read when the model decides to use it.
 * @param library - Skill library.
 * @returns Read-only skill tool.
 */
export function createQuireAiSkillTool(library: QuireAiSkillLibrary): QuireDocumentTool<typeof skillParameters, string> {
  const enabled = library.enabledEntries();
  const listed = enabled.slice(0, catalogLimit).map(describeEntry);
  const more = enabled.length > catalogLimit ? [`(${enabled.length - catalogLimit} more; list them with query)`] : [];
  const tool: QuireDocumentTool<typeof skillParameters, string> = {
    name: QUIRE_AI_SKILL_READ_TOOL_NAME,
    label: "Read Skill",
    description: [
      "Skills hold how to make a kind of document well: structure, wording, layout and the editing operations that produce it, sometimes with templates and pictures.",
      "Before writing or reshaping a document of a kind listed here, read its skill and follow it; mention which skill you used in the reply.",
      "Skills:", ...(listed.length === 0 ? ["(none)"] : listed), ...more
    ].join("\n"),
    parameters: skillParameters,
    effect: "read" as const,
    /**
     * Lists skills, or reads one skill or file.
     * @param input - Skill, file or query.
     * @returns Model-visible text.
     */
    async execute(input) {
      const text = await answer(library, input);
      return { value: text, summary: text };
    }
  };
  return Object.freeze(tool);
}

/**
 * @param library - Skill library.
 * @param input - Tool arguments.
 * @returns Listing, instructions or file text.
 */
async function answer(library: QuireAiSkillLibrary, input: { readonly id?: string; readonly file?: string; readonly query?: string }): Promise<string> {
  const enabled = library.enabledEntries();
  if (input.id === undefined) {
    const query = input.query?.toLowerCase();
    const found = query === undefined ? enabled : enabled.filter(entry => `${entry.name} ${entry.description} ${entry.category}`.toLowerCase().includes(query));
    return found.length === 0 ? "No skill matches." : found.map(describeEntry).join("\n");
  }
  const entry = enabled.find(candidate => candidate.id === input.id);
  const record = entry === undefined ? null : await library.read(entry.id);
  if (record === null) return `Skill ${input.id} is not available. Available: ${enabled.map(candidate => candidate.id).join(", ") || "none"}.`;
  if (input.file !== undefined && input.file !== "SKILL.md") {
    const file = record.files.find(candidate => candidate.path === input.file);
    if (file === undefined) return `Skill ${record.id} has no file ${input.file}. Files: ${record.files.map(candidate => candidate.path).join(", ")}.`;
    return typeof file.content === "string" ? file.content : `${file.path} is a binary ${file.mediaType} file and cannot be read as text.`;
  }
  const instructions = record.files.find(file => file.path === "SKILL.md")!.content as string;
  const others = record.files.filter(file => file.path !== "SKILL.md").map(file => `- ${file.path} (${file.mediaType})`);
  return [`# ${record.name}`, stripQuireAiSkillFrontMatter(instructions), ...(others.length === 0 ? [] : ["", "Files:", ...others])].join("\n");
}

/** @param entry - Listed skill. @returns One catalog line. */
function describeEntry(entry: QuireAiSkillEntry): string {
  return `- ${entry.id} (${entry.category}): ${entry.name} — ${entry.description}`;
}
