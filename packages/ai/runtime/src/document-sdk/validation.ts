import type { TSchema } from "typebox";
import { Errors } from "typebox/value";

/** Validation messages reported back to the caller. */
const reportedErrorLimit = 3;

/** Property names that select a branch of a union by constant value. */
const discriminators = ["op", "kind"] as const;

/**
 * Describes why arguments do not match a tool schema, in terms a model can act on.
 *
 * When the failure is inside a union whose branches are told apart by a constant
 * `op` or `kind`, the caller's value is validated against the matching branch
 * alone, so the report names that branch's problems rather than every
 * alternative's (the error iterator is also bounded and may never reach it).
 *
 * @param schema - Tool parameter schema.
 * @param value - Rejected arguments.
 * @returns Short multi-part explanation.
 */
export function describeQuireSchemaMismatch(schema: TSchema, value: unknown): string {
  return collectMessages(schema, value, "").slice(0, reportedErrorLimit).join("; ");
}

/**
 * Collects error messages, narrowing discriminated unions to the chosen branch.
 * @param schema - Schema to validate against.
 * @param value - Value at this level.
 * @param prefix - Instance path of this level within the original arguments.
 * @returns Messages with full instance paths.
 */
function collectMessages(schema: TSchema, value: unknown, prefix: string): string[] {
  const errors = [...Errors(schema, value)];
  for (const error of errors) {
    const branch = /^(.*)\/anyOf\/\d+$/u.exec(error.schemaPath);
    if (branch === null) continue;
    const union = resolvePointer(schema, branch[1]!) as { anyOf?: TSchema[] } | undefined;
    const instance = resolvePointer(value, `#${error.instancePath}`) as Record<string, unknown> | undefined;
    const chosen = union?.anyOf?.find(candidate => discriminators.some(key => {
      const constant = (candidate as { properties?: Record<string, { const?: unknown }> }).properties?.[key]?.const;
      return constant !== undefined && instance?.[key] === constant;
    }));
    if (chosen !== undefined) return collectMessages(chosen, instance, `${prefix}${error.instancePath}`);
  }
  return errors.filter(error => error.keyword !== "anyOf" || errors.length === 1).map(error => {
    const params = error.params as { allowedValues?: unknown; allowedValue?: unknown; additionalProperties?: unknown; limit?: unknown };
    if (error.keyword === "maxItems") {
      // A list over its limit is fixed by splitting the work, not by trimming content.
      const items = resolvePointer(value, `#${error.instancePath}`);
      const count = Array.isArray(items) ? items.length : "too many";
      return `${prefix}${error.instancePath} has ${count} items, more than the ${String(params.limit)} one call takes; split it into several calls`;
    }
    const allowed = params.allowedValues ?? params.allowedValue;
    const extra = Array.isArray(params.additionalProperties) ? params.additionalProperties : [];
    const detail = extra.length ? ` ${extra.map(name => JSON.stringify(String(name))).join(", ")}`
      : allowed !== undefined ? ` ${JSON.stringify(allowed)}` : "";
    return `${prefix}${error.instancePath || (prefix === "" ? "/" : "")} ${error.message}${detail}`;
  });
}

/**
 * Resolves a `#/a/b` JSON pointer.
 * @param root - Document to walk.
 * @param pointer - Pointer starting with `#`.
 * @returns Value at the pointer, or undefined.
 */
function resolvePointer(root: unknown, pointer: string): unknown {
  return pointer.replace(/^#\/?/u, "").split("/").filter(Boolean)
    .map(part => part.replace(/~1/gu, "/").replace(/~0/gu, "~"))
    .reduce<unknown>((node, key) => (node !== null && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined), root);
}
