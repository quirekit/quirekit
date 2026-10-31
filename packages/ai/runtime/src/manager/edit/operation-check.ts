import type { QuireAiRegistry } from "../types";
import type { TSchema } from "typebox";
import { describeQuireSchemaMismatch } from "../../document-sdk/validation";
import { briefQuireAiSchema } from "./brief";
import type { QuireAiEditOperationSchema } from "./schema";

/**
 * @param candidate - Operation from the model, possibly malformed.
 * @returns Its `op`, or "?" when missing.
 */
export function operationName(candidate: unknown): string {
  const op = (candidate as { op?: unknown } | null)?.op;
  return typeof op === "string" ? op : "?";
}

/**
 * Explains why an operation does not fit its kind.
 * @param union - Strict operation union.
 * @param candidate - Rejected operation.
 * @param name - Its `op`.
 * @returns The unknown kind with the known ones, or the fields that do not fit.
 */
export function describeOperationMismatch(union: QuireAiEditOperationSchema, candidate: unknown, name: string): string {
  const branches = union.anyOf as readonly TSchema[];
  const kinds = branches.map(branch => (branch as { properties?: { op?: { const?: unknown } } }).properties?.op?.const).filter(kind => typeof kind === "string");
  const branch = branches.find(entry => (entry as { properties?: { op?: { const?: unknown } } }).properties?.op?.const === name);
  if (branch === undefined) return `unknown operation; use one of: ${kinds.join(", ")}.`;
  return `${describeQuireSchemaMismatch(branch, candidate)}. Expected ${briefQuireAiSchema(branch, { depth: 3, comments: false })}; document_help explains ${JSON.stringify(name)} in full.`;
}

/**
 * Drops target fields an action does not take, such as a `block` on a document-wide action
 * like a watermark: they carry no meaning there, so they are not worth failing the operation.
 * @param candidate - Operation from the model.
 * @param registry - Compiled facts.
 * @returns The operation without the fields its action ignores.
 */
export function dropUnusedActionTarget(candidate: unknown, registry: QuireAiRegistry): unknown {
  const op = (candidate as { op?: unknown } | null)?.op;
  const action = typeof op === "string" ? registry.actions.get(op) : undefined;
  if (action === undefined || action.target === "text") return candidate;
  const { block, text: _text, occurrence: _occurrence, ...rest } = candidate as Record<string, unknown>;
  return action.target === "none" ? rest : { ...rest, ...(block === undefined ? {} : { block }) };
}
