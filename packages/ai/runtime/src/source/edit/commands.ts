import type { QuireAiSourceCommandContext, QuireAiSourceCommandDescriptor } from "@quirekit/ai-contract";
import type { QuireAiSourceDocument, QuireAiSourceStep } from "../types";
import type { QuireAiSourceSnapshot } from "../view/types";
import { QuireAiSourceOperationFailure, type QuireAiSourceDraft } from "./draft";
import { requireQuireAiSourceBlock, type QuireAiSourceCoreOperation } from "./operations";
import { findQuireAiSourceText } from "./text";

/** Facts a described command is planned with. */
export interface QuireAiSourceCommandScope {
  /** Draft to change. */
  readonly draft: QuireAiSourceDraft;
  /** Snapshot the model read. */
  readonly snapshot: QuireAiSourceSnapshot;
  /** Source document port. */
  readonly document: QuireAiSourceDocument;
  /** Identity the AI writes as. */
  readonly author: { readonly id: string; readonly name: string } | null;
  /** @param id - Annotation id. @returns Feature identity, or undefined. */
  readonly resolveAnnotation: (id: string) => string | undefined;
}

/**
 * Plans one described command: resolves its target, adapts the Agent parameters and asks the
 * editor what it would change, so later operations of the call map through it.
 * @param scope - Draft, snapshot, port and identities.
 * @param operation - Command operation.
 * @param descriptor - Its description.
 * @param prepared - Result of `prepare`, when declared.
 * @returns Whether the command was planned; false when its state was already in place.
 */
export function planQuireAiSourceCommand(scope: QuireAiSourceCommandScope, operation: QuireAiSourceCoreOperation,
  descriptor: QuireAiSourceCommandDescriptor, prepared: unknown): boolean {
  const { draft, snapshot } = scope;
  let block: { from: number; to: number } | null = null;
  let after: number | null = null;
  let range: { from: number; to: number } | null = null;
  let annotation: string | null = null;
  const target = descriptor.target ?? "document";
  if (target === "block" || target === "text") {
    const view = requireQuireAiSourceBlock(snapshot, operation.block);
    if (descriptor.kinds !== undefined && !descriptor.kinds.includes(view.kind)) {
      throw new QuireAiSourceOperationFailure("invalid-input", `${view.id} is a ${view.kind}; this command takes ${descriptor.kinds.join(", ")}.`);
    }
    const located = draft.locate(view);
    block = range = { from: located.from, to: located.to };
    after = located.after;
    if (target === "text" && operation.text !== undefined) {
      const occurrence = typeof operation.occurrence === "number" ? operation.occurrence : 1;
      const found = findQuireAiSourceText(draft.text, located.from, located.to, view.indent, String(operation.text))[occurrence - 1];
      if (found === undefined) throw new QuireAiSourceOperationFailure("invalid-input", `${JSON.stringify(operation.text)} is not in ${view.id}; copy the text exactly from the view.`);
      range = found;
    }
  } else if (target === "annotation") {
    const id = String(operation.annotation);
    annotation = scope.resolveAnnotation(id) ?? null;
    if (annotation === null) throw new QuireAiSourceOperationFailure("stale-target", `comment ${id} does not exist; read the document again.`);
  }
  const params = withOrdinals(operation.params ?? {}, descriptor.ordinals);
  const context: QuireAiSourceCommandContext = {
    text: draft.text, block, after, range, selected: range === null ? null : draft.text.slice(range.from, range.to),
    author: scope.author, annotation, prepared
  };
  let adapted: unknown;
  try {
    if (descriptor.satisfied?.(params, context) === true) return false;
    adapted = descriptor.adapt === undefined ? params : descriptor.adapt(params, context);
  } catch (error) {
    // A feature refuses with a stated reason, such as the user's permissions; it fails this operation only.
    throw new QuireAiSourceOperationFailure("command-rejected", error instanceof Error ? `${error.message}.` : "the command refused these parameters.");
  }
  if (adapted === null || adapted === undefined) throw new QuireAiSourceOperationFailure("invalid-input", "nothing in the document matches these parameters.");
  const step: QuireAiSourceStep = { kind: "command", name: operation.op, params: adapted, ...(range === null ? {} : { selection: range }) };
  const result = scope.document.plan([...draft.steps, step]);
  if (!result.ok) {
    throw new QuireAiSourceOperationFailure("command-rejected", `could not be applied here${result.reason === undefined ? "" : `: ${result.reason}`}; check the target and values.`);
  }
  draft.command(step, result.changes.at(-1) ?? [], result.text);
  return true;
}

/**
 * @param params - Agent parameters.
 * @param ordinals - Parameters the Agent counts from 1.
 * @returns Parameters counted from 0 where declared.
 */
function withOrdinals(params: unknown, ordinals: readonly string[] | undefined): unknown {
  if (ordinals === undefined || typeof params !== "object" || params === null) return params;
  const copy: Record<string, unknown> = { ...params as Record<string, unknown> };
  for (const name of ordinals) if (typeof copy[name] === "number") copy[name] = (copy[name] as number) - 1;
  return copy;
}
