import type { QuireAiSkillSourceInfo } from "./types";

/** Metadata written in the front matter of `SKILL.md`. */
export interface QuireAiSkillFrontMatter {
  /** Skill identifier. */
  readonly id?: string | undefined;
  /** Display name. */
  readonly name?: string | undefined;
  /** What the skill is for and when to use it. */
  readonly description?: string | undefined;
  /** Category. */
  readonly category?: string | undefined;
  /** Version. */
  readonly version?: string | undefined;
  /** Origin and licence. */
  readonly source?: QuireAiSkillSourceInfo | undefined;
}

/** Front matter keys read as source fields. */
const sourceKeys = ["url", "author", "license"] as const;

/**
 * Reads the `key: value` front matter of `SKILL.md`, the common skill file layout.
 * @param markdown - `SKILL.md` text.
 * @returns Metadata found; unknown keys are ignored.
 */
export function readQuireAiSkillFrontMatter(markdown: string): QuireAiSkillFrontMatter {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/u.exec(markdown)?.[1];
  if (block === undefined) return {};
  const values = new Map<string, string>();
  for (const line of block.split(/\r?\n/u)) {
    const match = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/u.exec(line);
    if (match !== null) values.set(match[1]!.toLowerCase(), unquote(match[2]!.trim()));
  }
  const source = Object.fromEntries(sourceKeys.flatMap(key => values.has(key) ? [[key, values.get(key)!]] : []));
  return {
    id: values.get("id"), name: values.get("name"), description: values.get("description"),
    category: values.get("category"), version: values.get("version"),
    ...(Object.keys(source).length === 0 ? {} : { source })
  };
}

/**
 * Writes `SKILL.md` with front matter for the given metadata, replacing any front matter it had.
 * @param markdown - Current `SKILL.md` text.
 * @param meta - Metadata to write.
 * @returns `SKILL.md` text.
 */
export function writeQuireAiSkillFrontMatter(markdown: string, meta: QuireAiSkillFrontMatter): string {
  const body = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/u, "");
  const entries: [string, string | undefined][] = [
    ["id", meta.id], ["name", meta.name], ["description", meta.description], ["category", meta.category], ["version", meta.version],
    ...sourceKeys.map(key => [key, meta.source?.[key]] as [string, string | undefined])
  ];
  const lines = entries.flatMap(([key, value]) => value === undefined || value === "" ? [] : [`${key}: ${JSON.stringify(value)}`]);
  return `---\n${lines.join("\n")}\n---\n${body.replace(/^\n+/u, "")}`;
}

/** @param value - Raw value. @returns The value without surrounding quotes. */
function unquote(value: string): string {
  if (value.startsWith("\"") && value.endsWith("\"") && value.length >= 2) {
    try { return String(JSON.parse(value)); } catch { return value.slice(1, -1); }
  }
  return value.startsWith("'") && value.endsWith("'") && value.length >= 2 ? value.slice(1, -1).replace(/''/gu, "'") : value;
}
