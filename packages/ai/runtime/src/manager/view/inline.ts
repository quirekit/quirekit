import type { Node } from "@quirekit/pm";
import type { QuireAiBlockCapability, QuireAiFormatCapability } from "@quirekit/ai-contract";

/**
 * Formats a property record as `{name:value, ...}` with JSON values.
 * @param values - Property names and values.
 * @returns Brace-enclosed record, or an empty string when there are no values.
 */
export function formatQuireAiProperties(values: ReadonlyMap<string, unknown>): string {
  if (values.size === 0) return "";
  return `{${[...values].map(([name, value]) => `${name}:${formatValue(value)}`).join(", ")}}`;
}

/**
 * Formats a JSON value, writing nested object keys unquoted like the outer record.
 * @param value - JSON value.
 * @returns Compact value text.
 */
function formatValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(formatValue).join(", ")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).map(([key, item]) => `${key}:${formatValue(item)}`).join(", ")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Reads every declared format from one target.
 * @param formats - Declared formats of one level.
 * @param read - Reads one format.
 * @returns Values that are set, in declaration order.
 */
export function readQuireAiFormats(
  formats: readonly QuireAiFormatCapability[],
  read: (format: QuireAiFormatCapability) => unknown
): Map<string, unknown> {
  const values = new Map<string, unknown>();
  for (const format of formats) {
    const value = read(format);
    if (value !== undefined && value !== null && value !== false) values.set(format.name, value);
  }
  return values;
}

/**
 * Renders a text block's inline content with markdown emphasis and property spans.
 *
 * `bold` and `italic` render as `**` and `*`; other character formats render as
 * `[text]{name:value}`. Adjacent runs with equal formatting are merged. Inline
 * containers such as content controls render their content inside `⟦…⟧` so the
 * model sees both the text and the boundary it must keep, followed by the
 * read-only properties their block fact gives. Inline atoms show the
 * label their block fact gives, else their node name; an empty label hides a
 * marker such as a bookmark or comment boundary.
 *
 * @param node - Text block or inline container.
 * @param formats - Declared character formats.
 * @param blocks - Block facts, which may label inline atoms.
 * @param doc - Document root, passed to labels.
 * @returns Inline text for the view.
 */
export function renderQuireAiInline(
  node: Node,
  formats: readonly QuireAiFormatCapability[],
  blocks: ReadonlyMap<string, QuireAiBlockCapability> = new Map(),
  doc?: Node
): string {
  const runs: { text: string; key: string; values: Map<string, unknown>; raw: boolean }[] = [];
  node.forEach(child => {
    if (!child.isText && !child.isLeaf) {
      const properties = blocks.get(child.type.name)?.properties?.(child, doc);
      const suffix = properties === undefined ? "" : formatQuireAiProperties(new Map(Object.entries(properties)));
      runs.push({ text: `⟦${renderQuireAiInline(child, formats, blocks, doc)}⟧${suffix}`, key: "", values: new Map(), raw: true });
      return;
    }
    const text = child.isText ? child.text ?? ""
      : child.type.name === "hardBreak" ? "<br/>"
        : labelInline(child, blocks, doc);
    const values = child.isText ? readQuireAiFormats(formats, format => format.read({ level: "character", marks: child.marks })) : new Map<string, unknown>();
    const key = formatQuireAiProperties(values);
    const last = runs.at(-1);
    if (last !== undefined && !last.raw && last.key === key) last.text += text;
    else runs.push({ text, key, values, raw: false });
  });
  return runs.map(({ text, values, raw }) => {
    if (raw) return text;
    const bold = values.delete("bold");
    const italic = values.delete("italic");
    let result = text;
    if (values.size > 0) result = `[${result}]${formatQuireAiProperties(values)}`;
    if (italic) result = `*${result}*`;
    if (bold) result = `**${result}**`;
    return result;
  }).join("");
}

/**
 * Labels one inline atom.
 * @param node - Inline atom.
 * @param blocks - Block facts.
 * @param doc - Document root, passed to the label.
 * @returns `[label]`, or an empty string for a hidden marker.
 */
function labelInline(node: Node, blocks: ReadonlyMap<string, QuireAiBlockCapability>, doc?: Node): string {
  const label = blocks.get(node.type.name)?.label?.(node, doc) ?? node.type.name;
  return label.length === 0 ? "" : `[${label}]`;
}
