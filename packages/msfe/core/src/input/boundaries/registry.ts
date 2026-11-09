import { Facet, type EditorState } from "@quirekit/cm-state";
import { syntaxTree } from "@quirekit/cm-language";
import type { SyntaxNode } from "@lezer/common";
import { readSourcePresentation } from "../../presentation/state";
import type { EditingBoundary, EditingBoundaryRule, EditingBoundarySource } from "./types";

/** Materialized structural components contribute their admitted source ranges, never DOM-derived offsets. */
export const editingBoundarySources = Facet.define<EditingBoundarySource>();

/** @param state - Accepted source state. @param from - Query start. @param to - Query end. @returns Already admitted component owners. */
function objects(state: EditorState, from: number, to: number): readonly EditingBoundary[] {
  return state.facet(editingBoundarySources).flatMap(read => read(state, from, to));
}

/** @param values - Syntax and component facts. @returns Distinct owners, excluding source syntax hidden inside whole components. */
function admitted(values: readonly EditingBoundary[]): EditingBoundary[] {
  const unique = [...new Map(values.map(value => [`${value.kind}/${value.from}/${value.to}`, value])).values()];
  const atoms = unique.filter(value => value.kind === "atom");
  return unique.filter(value => value.kind === "atom" || !atoms.some(atom => atom.from <= value.from && atom.to >= value.to));
}

/** Installation-local syntax lookup shared by every editing operation. */
export const editingBoundaryRules = Facet.define<readonly EditingBoundaryRule[], ReadonlyMap<string, EditingBoundaryRule>>({
  combine(values) {
    const result = new Map<string, EditingBoundaryRule>();
    for (const rules of values) for (const rule of rules) for (const name of rule.nodes) if (!result.has(name)) result.set(name, rule);
    return result;
  },
});

/** @param state - Current source presentation. @returns Whether semantic endpoints can be normalized outside IME. */
export function boundariesActive(state: EditorState): boolean {
  const presentation = readSourcePresentation(state);
  return presentation.mode === "live" && !presentation.composing;
}

/** @param state - Current source. @param node - Confirmed owner. @param position - Queried endpoint. @returns Validated feature facts, or literal fallback. */
function resolve(state: EditorState, node: SyntaxNode, position: number): EditingBoundary | null {
  const rule = state.facet(editingBoundaryRules).get(node.name);
  if (!rule || rule.when !== "prose" && readSourcePresentation(state).reveal !== "hidden") return null;
  const value = rule.resolve({ state, node, position });
  if (!value || value.navigation === "native") return null;
  if (!(0 <= value.from && value.from <= value.contentFrom && value.contentFrom <= value.contentTo
    && value.contentTo <= value.to && value.to <= state.doc.length
    && (value.selectFrom ?? value.from) >= 0 && (value.selectFrom ?? value.from) <= value.from
    && (value.selectTo ?? value.to) >= value.to && (value.selectTo ?? value.to) <= state.doc.length)) throw new Error(`invalid-editing-boundary: ${node.name}`);
  return value;
}

/** @param state - Accepted parser state. @param position - Source endpoint. @returns All enclosing owners, innermost first, in endpoint × ancestry work. */
export function boundariesAt(state: EditorState, position: number): readonly EditingBoundary[] {
  if (!boundariesActive(state)) return [];
  const tree = syntaxTree(state), seen = new Set<string>(), values: EditingBoundary[] = [...objects(state, position, position)];
  // Leading indentation has no content of its own: it belongs to the block that starts after it.
  const line = state.doc.lineAt(position), indent = line.from + /^[ \t]*/u.exec(line.text)![0].length;
  const anchors = position < indent ? [position, indent] : [position];
  for (const anchor of anchors) for (const side of [1, -1] as const) for (let node: SyntaxNode | null = tree.resolve(anchor, side); node; node = node.parent) {
    const key = `${node.name}/${node.from}/${node.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const value = resolve(state, node, position);
    if (value && value.from <= position && value.to >= position) values.push(value);
  }
  return admitted(values).sort((a, b) => a.to - a.from - (b.to - b.from));
}

/** @param state - Source before input. @param from - Changed interval start. @param to - Changed interval end. @returns Owners intersecting this edit only, without scanning the rest of the document. */
export function boundariesBetween(state: EditorState, from: number, to: number): readonly EditingBoundary[] {
  const values = [...objects(state, from, to), ...boundariesAt(state, from), ...boundariesAt(state, to)];
  if (from < to) syntaxTree(state).iterate({ from, to, enter(reference) {
    const value = resolve(state, reference.node, Math.max(from, reference.from));
    if (value) values.push(value);
  } });
  return admitted(values);
}
