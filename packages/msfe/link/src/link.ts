import { Mark, sourceCommand, sourceDocument, sourceNode, readSourceDestination, encodeMarkdownDestination, encodeMarkdownField } from "@quirekit/msfe-core";
import { Decoration, EditorView } from "@quirekit/cm-view";
import { EditorSelection } from "@quirekit/cm-state";
import { isSafeDestination, type MsfeCommand, type MsfeExtension } from "@quirekit/msfe-core";
import type { LinkOptions } from "./types";
import { linkSource } from "./source";
import { linkSyntax } from "./projection";
import { linkExportHrefs } from "./destinations";
import { linkOpeningPolicy, openLinkDestination } from "./open";

/**
 * Installs inline link projection; unresolved references remain editable source.
 * @param options - Optional host URL-opening policy.
 * @returns Link feature descriptor.
 */
function linkBackend(options: LinkOptions = {}): MsfeExtension {
  return { id: "link", commands: { insertLink }, projections: [{ nodes: ["Link", "Autolink", "URL"], decorate({ node, state, active, from, to }) {
    const destination = readSourceDestination(sourceDocument(state), sourceNode(node));
    if (!destination || active || !isSafeDestination(destination.url) || destination.labelFrom === destination.labelTo) return [];
    const start = Math.max(from, destination.labelFrom), end = Math.min(to, destination.labelTo);
    // Hidden cross-line syntax splits visible ranges. Emit each visible label interval once,
    // even when the same enclosing Link is visited from both sides of the hidden range.
    if (start >= end) return [];
    // Boundary text widgets (entities or typography) still belong to this link's label.
    const reference = options.reference?.(destination.url) ?? null;
    const result = [Decoration.mark({ tagName: "a", class: reference ? "msfe-link msfe-link-reference" : "msfe-link", inclusive: true, attributes: {
      href: destination.url, title: destination.title, "data-msfe-url": destination.url,
      rel: "noopener noreferrer", tabindex: "-1", ...(reference ? { "data-msfe-reference": reference } : {}),
    } }).range(start, end)];
    if (state.doc.lineAt(node.from).number === state.doc.lineAt(node.to).number) {
      if (node.from < destination.labelFrom && node.from >= from) result.push(Decoration.replace({}).range(node.from, destination.labelFrom));
      if (destination.labelTo < node.to && node.to <= to) result.push(Decoration.replace({}).range(destination.labelTo, node.to));
    }
    return result;
  } }], extensions: [...(options.openLink ? [linkOpeningPolicy.of(options.openLink)] : []),
    ...(options.exportHref ? [linkExportHrefs.of(options.exportHref)] : []), EditorView.baseTheme({ ".msfe-link": { color: "#347995", textDecoration: "underline" } }),
    EditorView.domEventHandlers({ click(event, view) {
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[data-msfe-url]") : null;
      if (!anchor || !view.dom.contains(anchor)) return false;
      event.preventDefault();
      if (event.metaKey || event.ctrlKey || view.dom.dataset.msfeMode === "locked") {
        openLinkDestination(view.state, view.dom.ownerDocument, anchor.dataset.msfeUrl!);
        return true;
      }
      return false;
    } })] };
}

/**
 * Wraps the selected label in a safe inline destination.
 * @param url - Safe decoded target URL.
 * @returns Pure single-selection command; ambiguous targets remain unchanged.
 */
export function insertLink(url: string): MsfeCommand {
  return state => {
    if (!isSafeDestination(url) || state.selection.ranges.length !== 1) return null;
    const range = state.selection.main;
    const label = state.sliceDoc(range.from, range.to);
    if (/[\r\n]/u.test(label)) return null;
    const text = encodeMarkdownField(label || url, "[]*_`<>");
    return { changes: { from: range.from, to: range.to, insert: `[${text}](${encodeMarkdownDestination(url)})` },
      selection: EditorSelection.range(range.from + 1, range.from + 1 + text.length) };
  };
}

/** Configurable link feature; configuring does not mutate other editors. */
export const Link = Mark.create<LinkOptions>({
  name: "link",
  addOptions() { return {}; },
  addAttributes: () => ({ url: { validate: value => typeof value === "string" && isSafeDestination(value) } }),
  addSource: () => linkSource,
  /** @returns Direct layout ownership for syntax that may cross physical source lines. */
  addProjectionLayers() { const name = this.name; return [{ key: `${name}-syntax`, placement: "block", incremental: true, references: true, build: input => linkSyntax(input, name) }]; },
  addCommands() { return { insertLink: (url: string) => sourceCommand(insertLink(url)) }; },
  addProjections() { return linkBackend(this.options).projections!; },
  addCodeMirrorExtensions() { return linkBackend(this.options).extensions!; },
});

/** @param options - Host link policy. @returns Independently configured feature. */
export function link(options: LinkOptions = {}) { return Link.configure(options); }
