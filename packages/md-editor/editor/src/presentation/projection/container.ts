import { Decoration } from "@quirekit/cm-view";
import type { ProjectionContext } from "@quirekit/msfe-core";
import { highlightContainerName, parseHighlightAttributes } from "../../highlight/attributes";

/** Product container names shared by editing, reading and document export. */
export const mdContainerTypes: readonly string[] = ["info", "note", "tip", "important", "warning", "danger", "caution", "details", "decision", "highlight"];

/** @param name - Registered source role. @returns A shared Prose semantic tone. */
export function containerTone(name: string): "neutral" | "info" | "success" | "warning" | "danger" {
  if (["warning", "caution"].includes(name)) return "warning";
  if (name === "danger") return "danger";
  if (name === "tip") return "success";
  if (["info", "note", "important", "decision"].includes(name)) return "info";
  return "neutral";
}

/** @param input - Confirmed source container. @returns Header/fence presentation without painting body rows. */
export function containerProjection({ state, node, active }: ProjectionContext) {
  const marks = node.getChildren("ContainerMark"), name = node.getChild("ContainerName");
  if (marks.length !== 2 || !name) return [];
  const title = node.getChild("ContainerTitle"), highlight = state.sliceDoc(name.from, name.to) === highlightContainerName;
  const result = [Decoration.line({ class: highlight && active ? "md-container-title md-highlight-source" : "md-container-title" }).range(state.doc.lineAt(node.from).from)];
  if (!active) {
    // The highlight icon replaces the whole opening line.
    if (!highlight) result.push(Decoration.replace({}).range(marks[0]!.from, title?.from ?? name.from));
    result.push(Decoration.replace({}).range(marks[1]!.from, marks[1]!.to));
    result.push(Decoration.line({ class: "md-hidden-line" }).range(state.doc.lineAt(marks[1]!.from).from));
  } else {
    result.push(Decoration.mark({ class: "md-source-marker" }).range(marks[0]!.from, title?.from ?? name.to));
    result.push(Decoration.mark({ class: "md-source-marker" }).range(marks[1]!.from, marks[1]!.to));
    result.push(Decoration.line({ class: "md-container-end" }).range(state.doc.lineAt(marks[1]!.from).from));
  }
  return result;
}

/** @param kind - Registered container name. @param title - Literal opening-line title. @returns Highlight palette attributes shared by editing and reading; empty for other containers. */
export function highlightAttributes(kind: string, title: string): Record<string, string> {
  if (kind !== highlightContainerName) return {};
  const attributes = parseHighlightAttributes(title);
  return { "data-qk-prose-highlight": attributes.color, ...(attributes.text ? { "data-qk-prose-highlight-text": attributes.text } : {}) };
}
