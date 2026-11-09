import { Decoration } from "@quirekit/cm-view";
import type { EditorState } from "@quirekit/cm-state";
import type { SyntaxNode } from "@lezer/common";
import type { MsfeProjection, ProjectionContext } from "@quirekit/msfe-core";

/**
 * A list item or heading that is only its marker, with no space after it, is
 * still being typed: it stays literal text until the space gives it structure.
 * @param state - Canonical source. @param item - ListItem node.
 * @returns Whether the item is a bare marker.
 */
export function bareListItem(state: EditorState, item: SyntaxNode): boolean {
  return bareMarker(state, item, "ListMark");
}

/** @param state - Canonical source. @param node - Block. @param marker - Its opening marker node name. @returns Whether the block is only that marker, with no space after it. */
export function bareMarker(state: EditorState, node: SyntaxNode, marker: string): boolean {
  const mark = node.getChild(marker);
  return !!mark && node.to === mark.to && mark.to === state.doc.lineAt(mark.from).to;
}

/** @param projection - Existing feature semantics. @param roles - Document roles for native marks. @returns The same source projection with shared Prose tags. */
export function semanticProjection(projection: MsfeProjection, roles: Readonly<Record<string, string>>): MsfeProjection {
  return { ...projection,
    /** @param input - Canonical source and frozen source-reveal context. @returns Exact feature ranges retaining their original behavior. */
    decorate(input) {
      return projection.decorate(input).map(range => {
        const spec = range.value.spec;
        const role = Object.entries(roles).find(([name]) => String(spec.class ?? "").split(" ").includes(name))?.[1];
        return role ? Decoration.mark({ ...spec, tagName: role }).range(range.from, range.to) : range;
      });
    },
  };
}

/** @param input - Marker within an accepted native block. @returns Hidden prefix or selectable active source. */
export function prefixProjection({ state, node, active }: ProjectionContext) {
  if (node.name === "ListMark" && node.parent && bareListItem(state, node.parent)) return [];
  const line = state.doc.lineAt(node.from), preceding = state.sliceDoc(line.from, node.from);
  const from = /^\s*$/u.test(preceding) ? line.from : node.from;
  const to = node.to + Number(state.sliceDoc(node.to, node.to + 1) === " ");
  if (!active) return [Decoration.replace({}).range(from, to)];
  const kind = node.name === "ListMark" ? "list" : "quote";
  return [
    ...(from < node.from ? [Decoration.replace({}).range(from, node.from)] : []),
    Decoration.line({ class: `md-source-${kind}-line` }).range(line.from),
    Decoration.mark({ class: `md-source-marker md-source-${kind}-marker` }).range(node.from, to),
  ];
}

/** @param input - Confirmed emphasis. @returns Native semantic text and exact delimiter hiding. */
export function emphasisProjection({ node, active }: ProjectionContext) {
  const marks = node.getChildren("EmphasisMark"), first = marks[0], last = marks.at(-1);
  if (!first || !last || first.to >= last.from) return [];
  return [Decoration.mark({ tagName: "em" }).range(first.to, last.from),
    ...(active ? [] : marks.map(mark => Decoration.replace({}).range(mark.from, mark.to)))];
}

/** @param projection - Native MSFE table with measured cell geometry. @returns Identical layout consuming Prose cell styling. */
export function tableProjection(projection: MsfeProjection): MsfeProjection {
  return { ...projection,
    /** @param input - Confirmed table and visible source. @returns Native cells annotated with shared semantic roles. */
    decorate(input) {
      const end = input.node.getChild("TableHeader")?.to ?? input.node.from;
      if (input.active) {
        // Source editing is one block. Never place literal pipes and delimiter
        // syntax inside the reading grid's independent cell boxes.
        const lines = [];
        let line = input.state.doc.lineAt(Math.max(input.from, input.node.from));
        while (line.from <= Math.min(input.to, input.node.to)) {
          lines.push(Decoration.line({ class: `md-source-table-line${line.from === input.node.from ? " md-source-table-header" : ""}` }).range(line.from));
          if (line.to >= input.node.to) break;
          line = input.state.doc.lineAt(line.to + 1);
        }
        return lines;
      }
      const delimiter = input.node.getChild("TableDelimiter");
      return projection.decorate(input).map(range => {
        const spec = range.value.spec;
        if (spec.class === "msfe-table-pipe") return Decoration.replace({}).range(range.from, range.to);
        return spec.class === "msfe-table-cell" ? Decoration.mark({ ...spec, attributes: {
          ...spec.attributes, "data-qk-prose": range.from < end ? "th" : "td",
        } }).range(range.from, range.to) : range;
      }).concat(delimiter ? [Decoration.replace({}).range(delimiter.from, delimiter.to)] : []);
    },
  };
}
