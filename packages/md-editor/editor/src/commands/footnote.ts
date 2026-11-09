import { EditorSelection } from "@quirekit/cm-state";
import type { MsfeCommand } from "@quirekit/msfe-core";
import { queryFootnotes } from "@quirekit/msfe-markdown-extras";

/** @param placeholder - Initial definition text, usually empty. @returns Atomic reference + unique definition insertion with the definition selected. */
export function insertMdFootnote(placeholder: string): MsfeCommand {
  return state => {
    if (state.selection.ranges.length !== 1 || /[\r\n]/u.test(placeholder)) return null;
    const index = queryFootnotes(state);
    if (index.status !== "ready") return null;
    let number = 1;
    while (index.entries.has(`note-${number}`)) number++;
    const label = `note-${number}`, reference = `[^${label}]`, { to } = state.selection.main;
    const definition = `\n\n[^${label}]: ${placeholder}\n`;
    // Both insertions are planned in the original source coordinates and published once.
    const changes = to === state.doc.length ? [{ from: to, insert: reference + definition }]
      : [{ from: to, insert: reference }, { from: state.doc.length, insert: definition }];
    const end = state.doc.length + reference.length + definition.length - 1;
    return { changes, selection: EditorSelection.range(end - placeholder.length, end), scrollIntoView: true };
  };
}
