import { Node, querySourceInline, sourceCommand } from "@quirekit/msfe-core";
import { Decoration, EditorView } from "@quirekit/cm-view";
import type { ChangeSpec, Range } from "@quirekit/cm-state";
import type { MsfeCommand, MsfeExtension, ProjectionContext } from "@quirekit/msfe-core";
import { headingSource } from "./source";
import { navigateHeading } from "./navigation";
import { headingReading } from "./reading";
import { headingFolding } from "./folding/extension";
import type { HeadingOptions } from "./types";

/**
 * Projects confirmed heading syntax while retaining active source markers.
 * @param context - Visible immutable syntax context.
 * @returns Inline and line decorations owned by this heading.
 */
function decorateHeading({ state, node, active, from, to }: ProjectionContext): Range<Decoration>[] {
  // `#` without its space is still being typed and stays literal text.
  const opening = node.name.startsWith("ATX") ? node.getChild("HeaderMark") : null;
  if (opening && node.to === opening.to && opening.to === state.doc.lineAt(opening.from).to) return [];
  const level = Number(node.name.slice(-1));
  const ranges = [Decoration.line({ class: `msfe-heading msfe-h${level}` }).range(state.doc.lineAt(node.from).from)];
  if (node.name.startsWith("Setext")) {
    const underline = node.getChild("HeaderMark");
    if (underline) ranges.push(Decoration.line({ class: `msfe-setext-underline${active ? " msfe-setext-active" : ""}` }).range(state.doc.lineAt(underline.from).from));
    const start = state.doc.lineAt(node.from).number;
    const end = underline ? state.doc.lineAt(underline.from).number - 1 : state.doc.lineAt(node.to).number;
    for (let number = Math.max(start + 1, state.doc.lineAt(from).number); number <= Math.min(end, state.doc.lineAt(to).number); number++) {
      ranges.push(Decoration.line({ class: `msfe-heading msfe-h${level} msfe-heading-continuation` }).range(state.doc.line(number).from));
    }
  }
  if (!active) for (const marker of node.getChildren("HeaderMark")) {
    const after = state.sliceDoc(marker.to, Math.min(marker.to + 1, state.doc.length));
    const to = marker.from === node.from && after === " " ? marker.to + 1 : marker.to;
    ranges.push(Decoration.replace({}).range(marker.from, to));
  }
  return ranges;
}

/** @returns Heading feature with ATX and Setext source projections. */
function headingBackend(): MsfeExtension {
  return { id: "heading", commands: { setHeading }, projections: [{
    nodes: ["ATXHeading1", "ATXHeading2", "ATXHeading3", "ATXHeading4", "ATXHeading5", "ATXHeading6", "SetextHeading1", "SetextHeading2"],
    decorate: decorateHeading,
  }], extensions: EditorView.baseTheme({
    ".msfe-heading": { fontWeight: "650", paddingTop: "12px", paddingBottom: "6px" },
    ".msfe-heading span": { textDecoration: "none" },
    ".msfe-h1": { fontSize: "1.9em" }, ".msfe-h2": { fontSize: "1.5em" },
    ".msfe-h3": { fontSize: "1.25em" }, ".msfe-h4, .msfe-h5, .msfe-h6": { fontSize: "1.05em" },
  }) };
}

/**
 * Sets ATX heading prefixes on selected lines, preserving the remaining source verbatim.
 * @param level - Heading level 1–6, or zero to remove an ATX prefix.
 * @returns Pure source command; unsupported values are not applicable.
 */
export function setHeading(level: number): MsfeCommand {
  return state => {
    if (!Number.isInteger(level) || level < 0 || level > 6) return null;
    const lines = new Set<number>();
    for (const range of state.selection.ranges) {
      const first = state.doc.lineAt(range.from).number;
      const last = state.doc.lineAt(range.empty ? range.to : range.to - 1).number;
      for (let number = first; number <= last; number++) lines.add(number);
    }
    const changes: ChangeSpec[] = [];
    for (const number of [...lines].sort((a, b) => a - b)) {
      const line = state.doc.line(number);
      const position = line.from + line.text.length, query = querySourceInline(state, { from: position, to: position });
      if (query.reason || query.node?.name === "TableCell") return null;
      const match = /^( {0,3})(#{1,6})(?:[ \t]+|$)/u.exec(line.text);
      const from = line.from + (match?.[1]?.length ?? 0);
      changes.push({ from, to: match ? line.from + match[0].length : from, insert: level ? "#".repeat(level) + " " : "" });
    }
    return { changes };
  };
}

/** Configurable heading feature; configuring does not mutate other editors. */
export const Heading = Node.create<HeadingOptions>({
  name: "heading",
  /** @returns Default disclosure behavior and accessible English labels. */
  addOptions() { return { folding: true, toggleLabel: (expanded, title) => `${expanded ? "Collapse" : "Expand"}: ${title}` }; },
  /** @returns Folding independent of typography overrides in product extensions. */
  addExtensions() { return this.options.folding ? [headingFolding(this.options, this.name, () => this.editor)] : []; },
  addAttributes: () => ({ level: { validate: value => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 6 } }),
  addSource: () => headingSource,
  addCommands() { return { setHeading: (level: number) => sourceCommand(setHeading(level)) }; },
  /** @returns Explicit reading navigation independent of mutation permissions. */
  addKeyboardShortcuts() { return { "Mod-Alt-ArrowDown": () => navigateHeading(this.editor, 1, this.name), "Mod-Alt-ArrowUp": () => navigateHeading(this.editor, -1, this.name) }; },
  addProjections() { return headingBackend().projections!; },
  addCodeMirrorExtensions() { return [headingBackend().extensions!, headingReading]; },
});

/** @returns Independently configured feature. */
export function heading() { return Heading.configure({}); }
