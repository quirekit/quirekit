import { encodeMarkdownDestination, encodeMarkdownField } from "../markdown/strings";
import { readSourceDestination } from "./destination";
import type { SourceDocument, SourceEdit, SourceNode } from "./authoring/types";
import type { DestinationPatch } from "./types";

/**
 * Updates one source usage. Shared reference definitions remain explicitly source-owned.
 * @param document - Current canonical source.
 * @param node - Confirmed link or image usage, already validated by its codec.
 * @param patch - Admitted decoded fields; URL policy remains feature-owned.
 * @returns Local exact edits or refusal; never edits outside the selected node.
 */
export function patchSourceDestination(document: SourceDocument, node: SourceNode, patch: DestinationPatch): readonly SourceEdit[] | null {
  const destination = readSourceDestination(document, node);
  if (!destination || !Object.keys(patch).length || Object.entries(patch).some(([key, value]) =>
    !["label", "url", "title"].includes(key) || typeof value !== "string" || /[\r\n]/u.test(value))) return null;
  const rawLabel = document.slice(destination.labelFrom, destination.labelTo);
  const label = patch.label === undefined && destination.kind !== "autolink" ? rawLabel
    : encodeMarkdownField(patch.label ?? rawLabel, "[]*_`<>");
  if (destination.kind !== "inline") {
    // A reference/automatic form cannot own an independent target. Materialize only
    // this explicitly edited usage, preserving its existing formatted label.
    const title = patch.title ?? destination.title, url = patch.url ?? destination.url;
    return [{ from: node.from, to: node.to, insert: `${node.kind === "Image" ? "!" : ""}[${label}](${encodeMarkdownDestination(url)}${title ? ` "${encodeMarkdownField(title, '"')}"` : ""})` }];
  }
  const changes: SourceEdit[] = [];
  if (patch.label !== undefined) changes.push({ from: destination.labelFrom, to: destination.labelTo, insert: label });
  if (patch.url !== undefined) {
    // Keep the author's delimiters; a bare address that gains a space or angle bracket switches to the angled form.
    const keep = destination.angled || patch.url !== "" && !/[\s<>\u0000-\u001f\u007f]/u.test(patch.url);
    changes.push({ from: destination.urlFrom, to: destination.urlTo,
      insert: keep ? encodeMarkdownField(patch.url, destination.angled ? "<>" : "<>()") : encodeMarkdownDestination(patch.url) });
  }
  if (patch.title !== undefined) {
    const { titleFrom, titleTo } = destination;
    const closing = titleTo === null ? '"' : document.slice(titleTo, titleTo + 1);
    const title = encodeMarkdownField(patch.title, closing === ")" ? "()" : closing);
    changes.push(titleFrom === null || titleTo === null
      ? { from: destination.afterUrl, insert: ` "${title}"` } : { from: titleFrom, to: titleTo, insert: title });
  }
  return changes.length ? changes : null;
}
