import { EditorSelection } from "@quirekit/cm-state";
import { sourceDocument, sourceNode, readSourceDestination, patchSourceDestination, encodeMarkdownDestination, encodeMarkdownField, isSafeDestination, type MsfeCommand, type DestinationPatch } from "@quirekit/msfe-core";
import { syntaxTree, syntaxTreeAvailable } from "@quirekit/cm-language";
import type { EditorState } from "@quirekit/cm-state";
import { selectedNode } from "./context";

/** @param state - Source selection. @returns Complete link owner before its nested destination token. */
function selectedLink(state: EditorState) { return selectedNode(state, ["Link", "Autolink"]) ?? selectedNode(state, ["URL"]); }

/** @param image - Image or link syntax. @param patch - Explicit literal destination fields. @returns Valid canonical source, or null for an unsafe destination. */
export function mdDestinationSource(image: boolean, patch: DestinationPatch): string | null {
  if (!patch.url?.trim() || !isSafeDestination(patch.url, image) || Object.values(patch).some(value => typeof value !== "string" || /[\r\n]/u.test(value))) return null;
  const label = encodeMarkdownField(patch.label?.trim() || (image ? "" : patch.url), "[]*_`<>");
  return `${image ? "!" : ""}[${label}](${encodeMarkdownDestination(patch.url)}${patch.title ? ` "${encodeMarkdownField(patch.title, '"')}"` : ""})`;
}

/** @param state - Current single source selection. @returns Whether one link can own this inline range without swallowing block syntax or another link. */
export function canEditMdLink(state: EditorState): boolean {
  if (state.readOnly || state.selection.ranges.length !== 1) return false;
  const range = state.selection.main;
  if (!syntaxTreeAvailable(state, range.to)) return false;
  const existing = selectedLink(state);
  if (existing) return !!readSourceDestination(sourceDocument(state), sourceNode(existing));
  if (selectedNode(state, ["FencedCode", "CodeBlock", "HTMLBlock"])) return false;
  if (state.sliceDoc(range.from, range.to).includes("\n")) return false;
  const owner = selectedNode(state, ["Paragraph", "ATXHeading1", "ATXHeading2", "ATXHeading3", "ATXHeading4", "ATXHeading5", "ATXHeading6", "SetextHeading1", "SetextHeading2", "TableCell"]);
  if (!owner) return state.doc.lineAt(range.from).text.trim() === "" && range.empty;
  let allowed = true;
  // Visit only the selected span. Partially selected delimiters and nested links
  // cannot become a new label; complete inline formatting keeps its exact source.
  syntaxTree(state).iterate({ from: range.from, to: range.to, enter(node) {
    if (node.from >= range.to || node.to <= range.from) return;
    if (["Link", "Autolink", "URL", "LinkReference", "InlineCode", "Image", "HTMLTag", "HeaderMark", "QuoteMark", "ListMark"].includes(node.name)
      && (!["InlineCode", "Image"].includes(node.name) || node.from < range.from || node.to > range.to)) allowed = false;
    if (["Emphasis", "StrongEmphasis", "Strikethrough", "Highlight", "InsertedText", "Subscript", "Superscript"].includes(node.name)
      && (node.from < range.from && node.to < range.to || node.from > range.from && node.to > range.to)) allowed = false;
  } });
  if (range.empty && selectedNode(state, ["InlineCode", "Image", "HTMLTag", "HeaderMark", "QuoteMark", "ListMark"])) return false;
  return allowed;
}

/** @param image - Image or link syntax. @param patch - User-confirmed destination fields. @returns A local source edit retaining unchanged formatted labels and reference definitions. */
export function editMdDestination(image: boolean, patch: DestinationPatch): MsfeCommand {
  return state => {
    if (state.selection.ranges.length !== 1 || !patch.url?.trim() || !isSafeDestination(patch.url, image)) return null;
    if (!image && !canEditMdLink(state)) return null;
    const node = image ? selectedNode(state, ["Image"]) : selectedLink(state);
    if (node) {
      const changes = patchSourceDestination(sourceDocument(state), sourceNode(node), patch);
      return changes ? { changes } : null;
    }
    if (Object.values(patch).some(value => typeof value !== "string" || /[\r\n]/u.test(value))) return null;
    const range = state.selection.main;
    const selected = state.sliceDoc(range.from, range.to), plain = patch.label ?? selected;
    const label = !image && !plain.trim() ? encodeMarkdownField(patch.url, "[]*_`<>")
      : patch.label === undefined ? selected : encodeMarkdownField(patch.label, "[]*_`<>");
    const insert = `${image ? "!" : ""}[${label}](${encodeMarkdownDestination(patch.url)}${patch.title ? ` "${encodeMarkdownField(patch.title, '"')}"` : ""})`;
    return { changes: { from: range.from, to: range.to, insert }, selection: EditorSelection.cursor(range.from + insert.length), scrollIntoView: true };
  };
}

/** @returns A single-usage unlink command that preserves formatted label source and shared definitions. */
export function removeMdLink(): MsfeCommand {
  return state => {
    const node = selectedLink(state);
    if (!node) return null;
    const destination = readSourceDestination(sourceDocument(state), sourceNode(node));
    if (!destination) return null;
    const label = state.sliceDoc(destination.labelFrom, destination.labelTo);
    // Bare addresses would immediately linkify again. Escaped punctuation keeps
    // the visible address as ordinary Markdown text after explicit unlinking.
    const insert = destination.kind === "autolink" || /^(?:https?:\/\/|www\.)|^[^\s@]+@[^\s@]+\.[^\s@]+$/iu.test(label)
      ? encodeMarkdownField(label, ":.@<>") : label;
    return { changes: { from: node.from, to: node.to, insert },
      selection: EditorSelection.range(node.from, node.from + insert.length), scrollIntoView: true };
  };
}
