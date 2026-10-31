import type { QuireAiSkillRecord } from "./types";

/** Identifier pattern of a skill. */
export const quireAiSkillIdPattern = /^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/u;

/** Largest text file of a skill, in characters. */
const textFileLimit = 200_000;

/** Largest total size of a skill's files, in bytes or characters. */
const totalLimit = 20_000_000;

/**
 * Checks a skill against the data format.
 * @param value - Candidate skill record.
 * @returns Problems in plain words; empty when the record is valid.
 */
export function validateQuireAiSkillRecord(value: unknown): readonly string[] {
  const record = value as Partial<QuireAiSkillRecord> | null;
  if (record === null || typeof record !== "object") return ["a skill must be an object"];
  const problems: string[] = [];
  if (typeof record.id !== "string" || record.id.length > 64 || !quireAiSkillIdPattern.test(record.id)) {
    problems.push("id must be 1-64 lower-case letters and digits, separated by single -, _ or .");
  }
  for (const key of ["name", "description", "category", "version"] as const) {
    if (typeof record[key] !== "string" || record[key].trim() === "") problems.push(`${key} must be a non-empty string`);
  }
  if (!Array.isArray(record.files)) return [...problems, "files must be a list"];
  const paths = new Set<string>();
  let total = 0;
  for (const file of record.files) {
    const path = (file as { path?: unknown } | null)?.path;
    if (typeof path !== "string" || path === "" || path.startsWith("/") || path.split("/").some(part => part === "" || part === "." || part === "..")) {
      problems.push(`file path ${JSON.stringify(path)} must be relative, without empty, . or .. parts`);
      continue;
    }
    if (paths.has(path)) problems.push(`file ${path} appears twice`);
    paths.add(path);
    if (typeof file.mediaType !== "string" || !/^[\w.+-]+\/[\w.+-]+$/u.test(file.mediaType)) problems.push(`file ${path} needs a media type such as text/markdown`);
    if (typeof file.content === "string") {
      if (file.content.length > textFileLimit) problems.push(`file ${path} is longer than ${textFileLimit} characters`);
      total += file.content.length;
    } else if (file.content instanceof Uint8Array) {
      total += file.content.byteLength;
    } else {
      problems.push(`file ${path} content must be text or bytes`);
    }
  }
  if (!paths.has("SKILL.md")) problems.push("SKILL.md is required");
  if (total > totalLimit) problems.push(`files are larger than ${totalLimit} in all`);
  return problems;
}

/**
 * Removes a leading `---` front matter block from Markdown.
 * @param markdown - `SKILL.md` text.
 * @returns The body after the front matter.
 */
export function stripQuireAiSkillFrontMatter(markdown: string): string {
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/u.exec(markdown);
  return (match === null ? markdown : markdown.slice(match[0].length)).trim();
}
