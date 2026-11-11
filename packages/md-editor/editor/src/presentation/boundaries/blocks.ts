import { readSourcePresentation, type EditingBoundaryRule } from "@quirekit/msfe-core";
import { highlightContainerName } from "../../highlight/attributes";
import { bareMarker } from "../projection/marks";

/** @param nodes - Confirmed prefix owners. @param marker - Direct syntax token, or null when the node is the token. @returns A prefix removed as one semantic unit at Backspace. */
export function prefixBoundary(nodes: readonly string[], marker: string | null): EditingBoundaryRule {
  return { nodes, when: "prose",
    /** @param context - Current syntax and source. @returns Visible content after its hidden structural prefix; in live preview only the indentation, which is never revealed. */
    resolve({ state, node }) {
      const mark = marker ? node.getChild(marker) : node;
      if (!mark || marker && bareMarker(state, node, marker)) return null;
      if (readSourcePresentation(state).reveal !== "hidden") {
        const line = state.doc.lineAt(mark.from);
        return line.from < mark.from && /^\s*$/u.test(state.sliceDoc(line.from, mark.from))
          ? { from: line.from, to: mark.from, contentFrom: mark.from, contentTo: mark.from, kind: "prefix", deletion: "native" } : null;
      }
      const contentFrom = mark.to + Number(state.sliceDoc(mark.to, mark.to + 1) === " ");
      // The fence starts where the hidden prefix does: at the line start when only indentation precedes the marker.
      const line = state.doc.lineAt(mark.from), from = /^\s*$/u.test(state.sliceDoc(line.from, mark.from)) ? line.from : mark.from;
      return { from, to: Math.max(contentFrom, marker ? node.to : state.doc.lineAt(mark.to).to),
        contentFrom, contentTo: Math.max(contentFrom, marker ? node.to : state.doc.lineAt(mark.to).to), kind: "prefix", deletion: "unwrap" };
    },
  };
}

/** Setext underlines are structure, while the heading's whole text remains editable. */
export const setextBoundary: EditingBoundaryRule = { nodes: ["SetextHeading1", "SetextHeading2"],
  /** @param context - Current heading. @returns The content followed by one protected underline. */
  resolve({ state, node }) {
    const mark = node.getChild("HeaderMark");
    return mark ? { from: node.from, to: node.to, contentFrom: node.from,
      contentTo: state.doc.line(state.doc.lineAt(mark.from).number - 1).to, kind: "block", deletion: "unwrap" } : null;
  },
};

/** Container labels/titles remain editable; highlight attributes are available through their controls. */
export const containerBoundary: EditingBoundaryRule = { nodes: ["CustomContainer"],
  /** @param context - Confirmed container. @returns Its actual projected content interval, including any visible title. */
  resolve({ state, node }) {
    const marks = node.getChildren("ContainerMark"), name = node.getChild("ContainerName"), title = node.getChild("ContainerTitle");
    if (marks.length !== 2 || !name) return null;
    const opening = state.doc.lineAt(node.from), closing = state.doc.lineAt(marks[1]!.from);
    if (closing.number <= opening.number + 1) return null;
    const contentFrom = state.sliceDoc(name.from, name.to) === highlightContainerName
      ? state.doc.line(opening.number + 1).from : title?.from ?? name.from;
    return { from: node.from, to: node.to, contentFrom, contentTo: state.doc.line(closing.number - 1).to, kind: "block", deletion: "protect" };
  },
};
