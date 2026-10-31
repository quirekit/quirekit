import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { readQuireAiSkillFrontMatter, writeQuireAiSkillFrontMatter } from "./markdown";
import type { QuireAiSkillFile, QuireAiSkillRecord } from "./types";
import { quireAiSkillIdPattern } from "./validate";

/** Media types by file extension; extensions not listed are binary `application/octet-stream`. */
const mediaTypes: Readonly<Record<string, string>> = {
  md: "text/markdown", txt: "text/plain", json: "application/json", yaml: "application/yaml", yml: "application/yaml",
  csv: "text/csv", html: "text/html", css: "text/css", xml: "application/xml", svg: "image/svg+xml",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pdf: "application/pdf"
};

/** Media types stored as text. */
const textTypes = new Set(["text/markdown", "text/plain", "application/json", "application/yaml", "text/csv", "text/html", "text/css", "application/xml", "image/svg+xml"]);

/**
 * Reads a skill from a single `SKILL.md`: its front matter gives the metadata.
 * @param markdown - `SKILL.md` text.
 * @param fallbackId - Identifier used when the front matter has none, such as the file name.
 * @returns Skill record, to be checked with `validateQuireAiSkillRecord`.
 */
export function readQuireAiSkillMarkdown(markdown: string, fallbackId?: string): QuireAiSkillRecord {
  return recordFrom([{ path: "SKILL.md", mediaType: "text/markdown", content: markdown }], fallbackId);
}

/**
 * Reads a skill from a zip archive holding `SKILL.md` at its root or inside one top-level folder.
 * @param bytes - Zip archive.
 * @param fallbackId - Identifier used when neither the front matter nor the folder name gives one.
 * @returns Skill record, to be checked with `validateQuireAiSkillRecord`.
 */
export function readQuireAiSkillArchive(bytes: Uint8Array, fallbackId?: string): QuireAiSkillRecord {
  const entries = Object.entries(unzipSync(bytes)).filter(([path]) => !path.endsWith("/") && !path.startsWith("__MACOSX/") && !path.split("/").includes(".DS_Store"));
  const tops = new Set(entries.map(([path]) => path.split("/")[0]));
  // One folder holding everything is the skill folder; its name can serve as the id.
  const folder = tops.size === 1 && entries.every(([path]) => path.includes("/")) ? [...tops][0]! : null;
  const files = entries.map(([path, data]): QuireAiSkillFile => {
    const relative = folder === null ? path : path.slice(folder.length + 1);
    const mediaType = mediaTypes[relative.split(".").at(-1)?.toLowerCase() ?? ""] ?? "application/octet-stream";
    return { path: relative, mediaType, content: textTypes.has(mediaType) ? strFromU8(data) : data };
  });
  return recordFrom(files, folder !== null && quireAiSkillIdPattern.test(folder) ? folder : fallbackId);
}

/**
 * Writes a skill as a zip archive with one folder named by its id; `SKILL.md` carries the metadata as front matter.
 * @param record - Skill.
 * @returns Zip archive.
 */
export function writeQuireAiSkillArchive(record: QuireAiSkillRecord): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const file of record.files) {
    const content = file.path === "SKILL.md" && typeof file.content === "string"
      ? writeQuireAiSkillFrontMatter(file.content, record) : file.content;
    files[`${record.id}/${file.path}`] = typeof content === "string" ? strToU8(content) : content;
  }
  return zipSync(files, { level: 6 });
}

/**
 * @param files - Files of the skill.
 * @param fallbackId - Identifier used when the front matter has none.
 * @returns Record with metadata from the front matter of `SKILL.md`.
 */
function recordFrom(files: readonly QuireAiSkillFile[], fallbackId: string | undefined): QuireAiSkillRecord {
  const skill = files.find(file => file.path === "SKILL.md");
  const meta = typeof skill?.content === "string" ? readQuireAiSkillFrontMatter(skill.content) : {};
  const id = meta.id ?? fallbackId ?? "";
  return {
    id, name: meta.name ?? id, description: meta.description ?? "", category: meta.category ?? "其他", version: meta.version ?? "1",
    ...(meta.source === undefined ? {} : { source: meta.source }), files
  };
}
