/** JSON Schema keywords the brief notation reads. */
interface BriefSchema {
  /** JSON type name or names. */
  readonly type?: string | readonly string[];
  /** Single allowed value. */
  readonly const?: unknown;
  /** Allowed values. */
  readonly enum?: readonly unknown[];
  /** Alternatives. */
  readonly anyOf?: readonly BriefSchema[];
  /** Exclusive alternatives. */
  readonly oneOf?: readonly BriefSchema[];
  /** Item schema of an array. */
  readonly items?: BriefSchema;
  /** Object properties. */
  readonly properties?: Readonly<Record<string, BriefSchema>>;
  /** Required property names. */
  readonly required?: readonly string[];
  /** Value schema of free-form keys. */
  readonly additionalProperties?: boolean | BriefSchema;
  /** Inclusive lower bound. */
  readonly minimum?: number;
  /** Inclusive upper bound. */
  readonly maximum?: number;
  /** Human description. */
  readonly description?: string;
}

/** Options of the brief notation. */
export interface QuireAiBriefOptions {
  /** Object nesting rendered in full; deeper objects become `{…}`. */
  readonly depth: number;
  /** Whether property descriptions are rendered as `// …` comments on their own lines. */
  readonly comments: boolean;
  /** Most values of an enumeration shown before `…`; default all. */
  readonly values?: number;
  /** Whether alternatives told apart by a constant `kind` or `op` render as one object listing those constants. */
  readonly merge?: boolean;
}

/**
 * Renders a JSON Schema in a compact TypeScript-like notation for the model, such as
 * `{rows?: integer 1..50; style?: "grid"|"plain"}`.
 * @param schema - JSON Schema.
 * @param options - Depth and comment rendering.
 * @returns Notation text.
 */
export function briefQuireAiSchema(schema: unknown, options: QuireAiBriefOptions): string {
  return render(schema as BriefSchema, options.depth, options.comments ? "" : null, options);
}

/**
 * @param schema - Schema at this level.
 * @param depth - Remaining object depth.
 * @param indent - Current indent when rendering comments, or null for one line.
 * @param options - Enumeration and merge limits.
 * @returns Notation of this level.
 */
function render(schema: BriefSchema, depth: number, indent: string | null, options: QuireAiBriefOptions): string {
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (schema.enum !== undefined) return values(schema.enum, options);
  const alternatives = schema.anyOf ?? schema.oneOf;
  if (alternatives !== undefined) {
    const merged = options.merge === true ? mergeTagged(alternatives) : null;
    if (merged !== null) return merged;
    const parts = [...new Set(alternatives.map(entry => render(entry, depth, indent, options)))];
    // Constants of a union read as one enumeration, such as "a"|"b".
    return alternatives.every(entry => entry.const !== undefined) ? values(alternatives.map(entry => entry.const), options) : parts.join(" | ");
  }
  const type = Array.isArray(schema.type) ? schema.type.join("|") : schema.type as string | undefined;
  if (type === "array") {
    const item = render(schema.items ?? {}, depth, indent, options);
    return /[|\s]/u.test(item) && !item.startsWith("{") ? `(${item})[]` : `${item}[]`;
  }
  if (type === "integer" || type === "number") {
    const range = schema.minimum !== undefined || schema.maximum !== undefined ? ` ${schema.minimum ?? ""}..${schema.maximum ?? ""}` : "";
    return `${type}${range}`;
  }
  if (type === "object" || schema.properties !== undefined) return renderObject(schema, depth, indent, options);
  return type ?? "any";
}

/**
 * @param list - Allowed values.
 * @param options - Enumeration limit.
 * @returns The values joined by `|`, cut with `…` past the limit.
 */
function values(list: readonly unknown[], options: QuireAiBriefOptions): string {
  const shown = list.slice(0, options.values ?? list.length).map(value => JSON.stringify(value));
  return shown.length < list.length ? `${shown.join("|")}|…` : shown.join("|");
}

/**
 * Renders alternatives told apart by a constant `kind` or `op` as one object, such as `{kind: "add-row"|"delete-row"; …}`.
 * Every tag is listed: they are the vocabulary the model picks from.
 * @param alternatives - Union branches.
 * @returns The merged notation, or null when the branches are not tagged objects.
 */
function mergeTagged(alternatives: readonly BriefSchema[]): string | null {
  for (const key of ["kind", "op"]) {
    const tags = alternatives.map(entry => entry.properties?.[key]?.const);
    if (tags.every(tag => tag !== undefined)) return `{${key}: ${tags.map(tag => JSON.stringify(tag)).join("|")}; …}`;
  }
  return null;
}

/**
 * @param schema - Object schema.
 * @param depth - Remaining object depth.
 * @param indent - Current indent when rendering comments, or null for one line.
 * @param options - Enumeration and merge limits.
 * @returns Notation of the object.
 */
function renderObject(schema: BriefSchema, depth: number, indent: string | null, options: QuireAiBriefOptions): string {
  const entries = Object.entries(schema.properties ?? {});
  if (entries.length === 0) return typeof schema.additionalProperties === "object" ? `{[key]: ${render(schema.additionalProperties, depth - 1, indent, options)}}` : "object";
  if (depth <= 0) return "{…}";
  const required = new Set(schema.required ?? []);
  const field = ([name, value]: [string, BriefSchema], inner: string | null) =>
    `${name}${required.has(name) ? "" : "?"}: ${render(value, depth - 1, inner, options)}`;
  if (indent === null) return `{${entries.map(entry => field(entry, null)).join("; ")}}`;
  const inner = `${indent}  `;
  const lines = entries.map(entry => {
    const comment = entry[1].description === undefined ? "" : `${inner}// ${entry[1].description}\n`;
    return `${comment}${inner}${field(entry, inner)};`;
  });
  return `{\n${lines.join("\n")}\n${indent}}`;
}
