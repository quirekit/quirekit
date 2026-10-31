import type { QuireAiSkillRecord } from "./types";

/** JSON Schema of a skill in its JSON form, for stores written in any language. */
export const quireAiSkillJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "QuireKit AI skill",
  type: "object",
  required: ["id", "name", "description", "category", "version", "files"],
  properties: {
    id: { type: "string", pattern: "^[a-z0-9]+(?:[-_.][a-z0-9]+)*$", maxLength: 64 },
    name: { type: "string", minLength: 1 },
    description: { type: "string", minLength: 1, description: "What the skill is for and when to use it." },
    category: { type: "string", minLength: 1 },
    version: { type: "string", minLength: 1 },
    source: {
      type: "object",
      properties: { url: { type: "string" }, author: { type: "string" }, license: { type: "string" } },
      additionalProperties: false
    },
    files: {
      type: "array",
      description: "Must contain SKILL.md.",
      items: {
        type: "object",
        required: ["path", "mediaType", "content"],
        properties: {
          path: { type: "string", description: "Relative path such as SKILL.md or templates/resume.docx." },
          mediaType: { type: "string" },
          content: { type: "string", description: "UTF-8 text, or base64 when encoding is base64." },
          encoding: { enum: ["utf8", "base64"], default: "utf8" }
        },
        additionalProperties: false
      }
    }
  },
  additionalProperties: false
} as const;

/** A skill in its JSON form: binary files carry base64 text. */
export type QuireAiSkillJson = Omit<QuireAiSkillRecord, "files"> & {
  /** Files with text content. */
  readonly files: readonly { readonly path: string; readonly mediaType: string; readonly content: string; readonly encoding?: "utf8" | "base64" }[];
};

/**
 * @param record - Skill.
 * @returns Its JSON form.
 */
export function toQuireAiSkillJson(record: QuireAiSkillRecord): QuireAiSkillJson {
  return {
    ...record,
    files: record.files.map(file => typeof file.content === "string"
      ? { path: file.path, mediaType: file.mediaType, content: file.content }
      : { path: file.path, mediaType: file.mediaType, content: encodeBase64(file.content), encoding: "base64" as const })
  };
}

/**
 * @param json - Skill in its JSON form.
 * @returns The skill with binary files as bytes.
 */
export function fromQuireAiSkillJson(json: QuireAiSkillJson): QuireAiSkillRecord {
  return {
    ...json,
    files: json.files.map(file => ({ path: file.path, mediaType: file.mediaType, content: file.encoding === "base64" ? decodeBase64(file.content) : file.content }))
  };
}

/** @param bytes - Binary content. @returns Base64 text. */
function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

/** @param text - Base64 text. @returns Binary content. */
function decodeBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
