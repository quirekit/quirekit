import type { Node } from "@quirekit/pm";
import type { QuireAiDocumentSettingEntry } from "@quirekit/ai-contract";
import type { QuireDocumentChange, QuireDocumentTextPiece } from "../../document-sdk/types";
import type { QuireAiRegistry } from "../types";
import { diffQuireAiSequences } from "./sequence";

/** Title of the document settings section. */
export const quireAiSettingsTitle = "文档设置";

/**
 * Reads every document setting in declaration order.
 *
 * A failing reader leaves its group out rather than breaking the whole view.
 *
 * @param doc - Document root.
 * @param registry - Compiled facts.
 * @returns Setting entries.
 */
export function readQuireAiSettings(doc: Node, registry: QuireAiRegistry): QuireAiDocumentSettingEntry[] {
  return registry.settings.flatMap(setting => {
    try {
      return [...setting.read(doc)];
    } catch {
      return [];
    }
  });
}

/**
 * Renders the settings section.
 * @param doc - Document root.
 * @param registry - Compiled facts.
 * @returns `## 文档设置` followed by one `label：value` line per entry, or nothing without settings.
 */
export function renderQuireAiSettings(doc: Node, registry: QuireAiRegistry): string[] {
  const entries = readQuireAiSettings(doc, registry);
  return entries.length === 0 ? [] : [`## ${quireAiSettingsTitle}`, ...entries.map(entry => `${entry.label}：${entry.value}`)];
}

/**
 * Lists changed document settings, paired by label, in the settings section.
 * @param source - Document before the edit.
 * @param candidate - Document after the edit.
 * @param registry - Compiled facts.
 * @returns Setting changes without document ranges.
 */
export function describeQuireAiSettingChanges(source: Node, candidate: Node, registry: QuireAiRegistry): QuireDocumentChange[] {
  const before = new Map(readQuireAiSettings(source, registry).map(entry => [entry.label, entry.value]));
  const after = readQuireAiSettings(candidate, registry);
  const changes: QuireDocumentChange[] = [];
  for (const entry of after) {
    const old = before.get(entry.label);
    before.delete(entry.label);
    if (old === entry.value) continue;
    if (old === undefined) {
      changes.push({ kind: "inserted", section: quireAiSettingsTitle, excerpt: `${entry.label}：${entry.value}`, formats: [] });
      continue;
    }
    const a = [...old];
    const b = [...entry.value];
    const pieces: QuireDocumentTextPiece[] = [{ kind: "same", text: `${entry.label}：` }];
    for (const step of diffQuireAiSequences(a, b)) {
      const kind = step.kind;
      const text = kind === "inserted" ? b[step.b]! : a[step.a]!;
      const last = pieces.at(-1);
      if (last?.kind === kind) pieces[pieces.length - 1] = { kind, text: last.text + text };
      else pieces.push({ kind, text });
    }
    changes.push({ kind: "edited", section: quireAiSettingsTitle, excerpt: entry.label, text: pieces, formats: [] });
  }
  for (const [label, value] of before) {
    changes.push({ kind: "removed", section: quireAiSettingsTitle, excerpt: `${label}：${value}`, formats: [] });
  }
  return changes;
}
