import type { TSchema } from "typebox";
import type { QuireAiActionCapability } from "@quirekit/ai-contract";
import type { QuireAiRegistry } from "../types";
import { briefQuireAiSchema } from "./brief";
import { listQuireAiBlockCreations, listQuireAiEditableFormats, type QuireAiEditOperationSchema } from "./schema";

/** Longest one-line signature shown in the catalog before it is cut to `{…}` depth. */
const signatureLimit = 160;

/**
 * Lists formats, new block kinds and actions with brief signatures, for the editing tool's description.
 * @param registry - Compiled facts.
 * @returns Catalog sections, one line per entry.
 */
export function describeQuireAiEditCatalog(registry: QuireAiRegistry): string {
  const formats = listQuireAiEditableFormats(registry).map(format =>
    `- ${format.name} (${format.level}): ${signature(format.schema)} — ${format.description}`);
  const blocks = listQuireAiBlockCreations(registry).map(creation =>
    `- {${creation.key}: ${signature(creation.schema)}} — ${creation.description}`);
  const actions = groupActions([...registry.actions.values()]).flatMap(([category, group]) => [
    ...(category === undefined ? [] : [`${category}:`]),
    ...group.map(action => `- ${action.name}${describeTarget(action)}: params ${signature(action.schema)} — ${action.description}`)
  ]);
  return [
    "Formats (keys of `set` and of a new paragraph's `format`):", ...formats,
    "Blocks (other kinds of new block for `insert`):", ...blocks,
    "Actions (`{op: name, block, params}`):", ...actions,
    "Signatures are brief; document_help returns the full parameters with explanations by name."
  ].join("\n");
}

/**
 * Returns the full reference of each named operation, action, format or block kind.
 * @param registry - Compiled facts.
 * @param operation - Strict operation union.
 * @param name - Name as listed in the catalog or an operation kind.
 * @returns Reference sections, or null when nothing has that name.
 */
export function describeQuireAiEditReference(registry: QuireAiRegistry, operation: QuireAiEditOperationSchema, name: string): string | null {
  const full = (schema: unknown) => briefQuireAiSchema(schema, { depth: 8, comments: true });
  const sections: string[] = [];
  const action = registry.actions.get(name);
  const branch = (operation.anyOf as readonly TSchema[]).find(entry =>
    (entry as { properties?: { op?: { const?: unknown } } }).properties?.op?.const === name);
  if (branch !== undefined) sections.push(`Operation ${name}${action === undefined ? "" : ` (action${describeTarget(action)})`}: ${action?.description ?? ""}\n${full(branch)}`.replace(": \n", ":\n"));
  const format = listQuireAiEditableFormats(registry).find(entry => entry.name === name);
  if (format !== undefined) sections.push(`Format ${name} (${format.level}): ${format.description} null clears.\n${full(format.schema)}`);
  const creation = listQuireAiBlockCreations(registry).find(entry => entry.key === name);
  if (creation !== undefined) sections.push(`Block {${name}: …}: ${creation.description}\n${full(creation.schema)}`);
  return sections.length === 0 ? null : sections.join("\n\n");
}

/**
 * Lists every name the reference answers for.
 * @param registry - Compiled facts.
 * @param operation - Strict operation union.
 * @returns Distinct names in catalog order.
 */
export function listQuireAiEditReferenceNames(registry: QuireAiRegistry, operation: QuireAiEditOperationSchema): readonly string[] {
  const kinds = (operation.anyOf as readonly TSchema[]).map(entry => (entry as { properties?: { op?: { const?: unknown } } }).properties?.op?.const);
  return [...new Set([
    ...kinds.filter(kind => typeof kind === "string"),
    ...listQuireAiEditableFormats(registry).map(format => format.name),
    ...listQuireAiBlockCreations(registry).map(creation => creation.key)
  ])];
}

/**
 * @param schema - JSON Schema.
 * @returns One-line signature, shallower when the full one is long.
 */
function signature(schema: unknown): string {
  for (const depth of [3, 2, 1]) {
    const text = briefQuireAiSchema(schema, { depth, comments: false, values: 8 });
    if (text.length <= signatureLimit) return text;
  }
  return briefQuireAiSchema(schema, { depth: 1, comments: false, values: 8, merge: true });
}

/**
 * @param action - Action fact.
 * @returns What the action's `block` addresses, in parentheses, or nothing for untargeted actions.
 */
function describeTarget(action: QuireAiActionCapability): string {
  if (action.target === "none") return "";
  const kinds = action.nodes === undefined ? "" : `: ${action.nodes.join(", ")}`;
  return action.target === "text" ? ` (block${kinds}, optional text, occurrence)` : ` (block${kinds})`;
}

/**
 * Lists ungrouped actions first, then each group in the order its first action registered.
 * @param actions - Actions in registration order.
 * @returns Groups with their category, undefined for the ungrouped.
 */
function groupActions(actions: readonly QuireAiActionCapability[]): [string | undefined, QuireAiActionCapability[]][] {
  const groups = new Map<string | undefined, QuireAiActionCapability[]>([[undefined, []]]);
  for (const action of actions) {
    const group = groups.get(action.category) ?? [];
    group.push(action);
    groups.set(action.category, group);
  }
  return [...groups].filter(([, group]) => group.length > 0);
}
