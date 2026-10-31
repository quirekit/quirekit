import { briefQuireAiSchema } from "../../manager/edit/brief";
import { quireAiReplyLanguageNote } from "../../manager/edit/settle";
import type { QuireDocumentTool, QuireDocumentToolContext } from "../../document-tools";
import type { QuireAiSourceCommandDescriptor } from "@quirekit/ai-contract";
import type { QuireAiSourceDocument } from "../types";
import { renderQuireAiSourceView } from "../view/render";
import type { QuireAiSourceSnapshots } from "../view/snapshot";
import type { QuireAiSourceWriter } from "../writer";
import { collectQuireAiSourceCheckTargets, readQuireAiSourceChecks } from "./checks";
import { describeQuireAiSourceOutcome } from "./outcome";
import { planQuireAiSourceEdit, type QuireAiSourceEditFailure, type QuireAiSourcePlannedOperation } from "./plan";
import { createQuireAiSourceEditOperation, createQuireAiSourceEditParameters, quireAiSourceEditOperationLimit, type QuireAiSourceEditParameters } from "./schema";

/** Blocks of the post-edit view returned with a successful edit. */
const resultViewLimit = 80;

/** Write result of a source edit. */
export interface QuireAiSourceEditResult {
  /** Whether anything was written. */
  readonly applied: boolean;
  /** Operations applied, failed and left unprocessed. */
  readonly edit: {
    /** Number of operations applied. */
    readonly applied: number;
    /** Failed operations, numbered from 1, with the reason. */
    readonly failed: readonly { readonly operation: number; readonly message: string }[];
    /** Operations past the per-call limit. */
    readonly unprocessed: number;
  };
}

/** Progress of one call whose operations are written while the model generates them. */
interface CallState {
  /** Operations written or settled so far. */
  committed: number;
  /** Operations that applied. */
  readonly applied: QuireAiSourcePlannedOperation[];
  /** Operations that failed. */
  readonly failures: QuireAiSourceEditFailure[];
  /** Earliest changed position, for the result view. */
  first: number | null;
  /** Whether a part wrote anything. */
  wrote: boolean;
  /** Whether writing while generating stopped after a refused write. */
  halted: boolean;
}

/** Ports of the source editing tool. */
export interface QuireAiSourceEditToolPorts {
  /** Source document port. */
  readonly document: QuireAiSourceDocument;
  /** Snapshot reader. */
  readonly snapshots: QuireAiSourceSnapshots;
  /** Policy-checked writer. */
  readonly writer: QuireAiSourceWriter;
  /** Identity the AI writes as. */
  readonly author: { readonly id: string; readonly name: string } | null;
  /** Host resources for commands that prepare. */
  readonly ports: Readonly<Record<string, unknown>>;
}

/**
 * Creates `document_edit` of a source document. Each operation is written as soon as it is
 * complete while the model generates the call; the rest is written when the call completes.
 * @param ports - Port, snapshots, writer, identity and host resources.
 * @returns Write tool.
 */
export function createQuireAiSourceEditTool(ports: QuireAiSourceEditToolPorts): QuireDocumentTool<QuireAiSourceEditParameters, QuireAiSourceEditResult> {
  const commands = new Map([...ports.document.commands()].filter(([, descriptor]) => descriptor.risk !== "read"));
  const operation = createQuireAiSourceEditOperation(commands);
  const checks = readQuireAiSourceChecks(ports.document);
  const calls = new Map<string, CallState>();
  /** @param context - Call. @returns Its progress, created on first use. */
  const stateOf = (context: QuireDocumentToolContext): CallState => {
    let state = calls.get(context.callId);
    if (state === undefined) {
      calls.set(context.callId, state = { committed: 0, applied: [], failures: [], first: null, wrote: false, halted: false });
      context.signal.addEventListener("abort", () => calls.delete(context.callId), { once: true });
    }
    return state;
  };
  /**
   * Plans and writes a part of the call.
   * @param state - Call progress.
   * @param operations - The part.
   * @param context - Call.
   * @param prepared - Prepared command values by operation index.
   * @param blocked - Operations that failed preparation or a check, with the reason.
   */
  const commit = (state: CallState, operations: readonly unknown[], context: QuireDocumentToolContext, prepared: ReadonlyMap<number, unknown>,
    blocked: ReadonlyMap<number, string> = new Map()) => {
    const plan = planQuireAiSourceEdit(operations, {
      snapshot: ports.snapshots.read(), document: ports.document, author: ports.author, commands, operation, prepared, blocked,
      resolveAnnotation: id => ports.snapshots.resolveAnnotation(id)
    }, state.committed);
    const result = plan.steps.length === 0 ? null
      : ports.writer.write(plan.steps, { requestId: context.requestId ?? null, operationId: context.callId, capabilityId: "quire.ai.document-edit" });
    state.committed += operations.length;
    state.failures.push(...plan.failures);
    if (result !== null && !result.ok) {
      for (const entry of plan.operations) state.failures.push({ source: entry.source, code: "command-rejected", message: `Operation ${entry.source + 1}: the editor refused the change${result.reason === undefined ? "" : `: ${result.reason}`}.` });
      return;
    }
    if (result !== null) {
      state.wrote = true;
      if (plan.firstChange !== null) state.first = state.first === null ? plan.firstChange : Math.min(state.first, plan.firstChange);
    }
    state.applied.push(...plan.operations);
  };
  return Object.freeze({
    name: "document_edit",
    label: "Edit Document",
    description: [
      "Changes the Markdown document by block id. Operations are written in order, each as soon as it is complete, so what is written stays even if a later part fails.",
      "replace: new Markdown for a whole block (it may become several blocks); replace_text: exact source text inside a block; append: text at the end of a block; replace_all: every occurrence of exact text;",
      "insert: new Markdown blocks after/before a block or at the start/end; move: adjacent blocks, as they are, after/before a block or to the start/end; delete: whole blocks with the blocks inside them.",
      "Write Markdown source exactly as the view shows it: # headings, **bold**, *italic*, lists with markers, Markdown tables. Blank lines between blocks and the indentation of list items are added for you.",
      "Operations refer to the document as last read. Returns the updated view with ids of new blocks.",
      `At most ${quireAiSourceEditOperationLimit} operations per call; split a larger edit into several calls.`,
      "Each operation is applied or reported on its own: when some fail, the rest still apply and the result lists only the failed ones to send again."
    ].join(" ") + describeCatalog(commands) + describeFigures(ports.document),
    parameters: createQuireAiSourceEditParameters(commands),
    effect: "write" as const,
    observeInput(input, context) {
      const operations = (input as { operations?: unknown } | null)?.operations;
      if (!Array.isArray(operations)) return;
      const state = stateOf(context);
      // An operation is complete once the next one has started.
      const complete = operations.slice(state.committed, Math.max(state.committed, operations.length - 1));
      // Commands that prepare host resources, need their own call or write checked figures wait for the complete call.
      const snapshot = checks.size === 0 ? undefined : ports.snapshots.read();
      const ready = complete.findIndex(item => {
        const descriptor = commands.get(String((item as { op?: unknown } | null)?.op));
        return descriptor?.prepare !== undefined || descriptor?.standalone === true
          || (snapshot !== undefined && collectQuireAiSourceCheckTargets(item, snapshot, ports.document, checks).length > 0);
      });
      const part = ready < 0 ? complete : complete.slice(0, ready);
      if (part.length === 0 || state.halted) return;
      try {
        commit(state, part, context, new Map());
      } catch {
        // A refused write (read-only, no permission) is reported once the call completes.
        state.halted = true;
      }
    },
    async execute(input, context) {
      const state = stateOf(context);
      try {
        const rest = input.operations.slice(state.committed);
        // Host resources are prepared and written figures checked first; an operation that fails here fails alone.
        const prepared = new Map<number, unknown>();
        const blocked = new Map<number, string>();
        const snapshot = ports.snapshots.read();
        for (const [index, item] of rest.entries()) {
          const source = state.committed + index;
          const descriptor = commands.get(String((item as { op?: unknown }).op));
          try {
            if (descriptor?.prepare !== undefined) prepared.set(source, await descriptor.prepare((item as { params?: unknown }).params ?? {}, ports.ports));
            for (const { block, check } of collectQuireAiSourceCheckTargets(item, snapshot, ports.document, checks)) {
              const problem = await check.run(block, ports.ports);
              if (problem !== undefined) throw new Error(`the ${String(block.attrs.language)} figure does not render: ${problem}; correct its source and send it again`);
            }
          } catch (error) {
            blocked.set(source, error instanceof Error ? error.message : String(error));
          }
        }
        context.signal.throwIfAborted();
        if (rest.length > 0) commit(state, rest, context, prepared, blocked);
        const total = input.operations.length;
        const unprocessed = Math.max(0, total - quireAiSourceEditOperationLimit);
        const edit = { applied: state.applied.length, failed: state.failures.map(failure => ({ operation: failure.source + 1, message: failure.message })), unprocessed };
        const outcome = describeQuireAiSourceOutcome(total, state.applied, state.failures, unprocessed);
        if (!state.wrote) {
          const satisfied = state.applied.length > 0 && state.failures.length === 0;
          return { value: { applied: false, edit }, summary: satisfied
            ? `Nothing needed to change: the document already has this content. Do not send it again; tell the user it was already so.\n${quireAiReplyLanguageNote}`
            : `${outcome}\n${quireAiReplyLanguageNote}` };
        }
        const view = renderQuireAiSourceView(ports.snapshots.read(), { limit: resultViewLimit, around: state.first ?? undefined });
        const tail = view.next === undefined && view.listed === view.total ? "" : `\n(${view.listed} of ${view.total} blocks, starting just before the first change; call document_read for others)`;
        return { value: { applied: true, edit }, summary: `${outcome}\nUpdated document:\n${view.text}${tail}\n${quireAiReplyLanguageNote}` };
      } finally {
        calls.delete(context.callId);
      }
    }
  } satisfies QuireDocumentTool<QuireAiSourceEditParameters, QuireAiSourceEditResult>);
}

/**
 * @param commands - Described commands.
 * @returns Catalog appended to the tool description, grouped by category.
 */
function describeCatalog(commands: ReadonlyMap<string, QuireAiSourceCommandDescriptor>): string {
  if (commands.size === 0) return "";
  const groups = new Map<string, string[]>();
  for (const [name, descriptor] of commands) {
    const target = descriptor.target === undefined || descriptor.target === "document" ? "" : ` (${descriptor.target})`;
    const params = descriptor.params === undefined ? "" : ` params ${briefQuireAiSchema(descriptor.params, { depth: 2, comments: false, values: 8, merge: true })}`;
    const category = descriptor.category ?? "other";
    groups.set(category, [...(groups.get(category) ?? []), `- ${name}${target}:${params} — ${descriptor.description}`]);
  }
  return `\nCommands (as operations: {op: name, block?/text?/annotation? as the target needs, params}; document_help explains each in full):\n${[...groups].map(([category, lines]) => `${category}:\n${lines.join("\n")}`).join("\n")}`;
}

/**
 * @param document - Source document port.
 * @returns Catalog of figures the model may write as fenced code, appended to the tool description.
 */
function describeFigures(document: QuireAiSourceDocument): string {
  const lines = document.capabilities().flatMap(fact => fact.kind === "source-block" ? fact.authoring ?? [] : [])
    .map(item => `- \`\`\`${item.fence}: ${item.description}`);
  if (lines.length === 0) return "";
  return `\nFigures written as fenced code blocks (insert or replace them like any block; each is rendered and checked before it is written):\n${lines.join("\n")}`;
}
