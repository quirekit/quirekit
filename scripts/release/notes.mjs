#!/usr/bin/env node
// Prints the GitHub release notes of one version: the entries `changeset version` wrote under
// that version in every public package's CHANGELOG.md, merged so a change shared by several
// packages appears once with the packages it touched. Usage: node scripts/release/notes.mjs 0.0.2

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readPolicy, readWorkspace } from "../licensing/workspace.mjs";

const root = resolve(import.meta.dirname, "../..");
const version = process.argv[2];
if (!version) {
  process.stderr.write("Usage: node scripts/release/notes.mjs <version>\n");
  process.exit(1);
}
const kinds = ["Major Changes", "Minor Changes", "Patch Changes"];

/**
 * Splits the CHANGELOG section of one version into bullet entries grouped by change kind.
 * @param {string} changelog - CHANGELOG.md text.
 * @param {string} target - Version whose section is read.
 * @returns {{ kind: string, text: string }[]} Entries in file order.
 */
export function sectionEntries(changelog, target) {
  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${target}`);
  if (start < 0) return [];
  const entries = [];
  let kind = "Patch Changes";
  let current;
  for (const line of lines.slice(start + 1)) {
    if (/^## /u.test(line)) break;
    const heading = /^### (.+)$/u.exec(line);
    if (heading) { kind = heading[1].trim(); current = undefined; continue; }
    if (line.startsWith("- ")) { current = { kind, lines: [line] }; entries.push(current); continue; }
    if (current) current.lines.push(line);
  }
  return entries.map(({ kind: entryKind, lines: body }) => ({ kind: entryKind, text: body.join("\n").trimEnd() }));
}

// The public tree's policy has no commercial list; the maintainers' tree keeps those unpublished.
const commercial = readPolicy(root).packages?.commercial ?? [];
const packages = readWorkspace(root).filter(({ directory, manifest }) =>
  directory !== "" && !manifest.private && !commercial.includes(manifest.name));

// Merge identical entries across packages, keeping the first-seen order.
const merged = new Map();
for (const { directory, manifest } of packages) {
  const path = join(root, directory, "CHANGELOG.md");
  if (!existsSync(path)) continue;
  for (const { kind, text } of sectionEntries(readFileSync(path, "utf8"), version)) {
    const key = `${kind}\n${text}`;
    if (!merged.has(key)) merged.set(key, { kind, text, names: [] });
    merged.get(key).names.push(manifest.name);
  }
}

const out = [];
for (const kind of [...kinds, ...new Set([...merged.values()].map((entry) => entry.kind))]) {
  const entries = [...merged.values()].filter((entry) => entry.kind === kind);
  if (entries.length === 0 || out.some((line) => line === `### ${kind}`)) continue;
  out.push(`### ${kind}`, "");
  for (const { text, names } of entries) {
    out.push(text, "", `  Packages / 涉及的包：${names.map((name) => `\`${name}\``).join(", ")}`, "");
  }
}
if (out.length === 0) out.push("No user-facing changes in this version.", "", "此版本没有面向用户的改动。", "");
out.push(`All ${packages.length} packages are published to npm as \`${version}\` under \`latest\`.`, "",
  `全部 ${packages.length} 个包以 \`${version}\` 发布到 npm 的 \`latest\`。`);
process.stdout.write(`${out.join("\n")}\n`);
