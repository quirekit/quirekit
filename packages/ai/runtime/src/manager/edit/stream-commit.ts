import type { QuireDocumentToolContext } from "../../document-tools";
import type { QuireAiToolHost } from "../../tool-host";
import type { QuireAiManager } from "../types";
import { collectQuireAiBlocks, collectQuireAiSections } from "../view/collect";
import { applyQuireAiEdit, type QuireAiAppliedEdit } from "./apply";
import { planQuireAiEdit } from "./plan";
import type { QuireAiEditOperationSchema } from "./schema";
import { anchorOf, combine, failureLines, offsetOfChild, remainingOperations, renumber, withoutAnchor } from "./stream-parts";
import type { QuireAiModelOperation, QuireAiPlannedOperation, QuireAiStreamState } from "./types";

/** Commits of streaming `document_edit` arguments for one tool instance. */
export interface QuireAiStreamCommit {
  /**
   * Commits every closed operation, and every closed block of a streaming insert, not yet committed.
   * @param input - Partially parsed arguments.
   * @param context - Operation identity and cancellation.
   * @returns Arguments still to write, for the preview.
   */
  observe(input: unknown, context: QuireDocumentToolContext): unknown;
  /**
   * Writes what streaming has not committed and combines every part into one result.
   * @param operations - Complete operations as the model wrote them.
   * @param context - Operation identity and cancellation.
   * @param onPlanned - Receives the plan of the final write, such as to preview it.
   * @returns Combined write facts, numbered as the model wrote the operations.
   */
  finish(operations: readonly unknown[], context: QuireDocumentToolContext, onPlanned?: (plan: readonly QuireAiPlannedOperation[]) => void): Promise<QuireAiAppliedEdit>;
}

/**
 * Creates the streaming commit of the core edit tool: closed parts are written while the
 * model is still generating, so a later failure never takes back what is already written.
 * @param manager - AI manager supplying the editor, facts and identities.
 * @param host - Guarded write authority.
 * @param operation - Strict operation union.
 * @returns Streaming commit handlers.
 */
export function createQuireAiStreamCommit(manager: QuireAiManager, host: QuireAiToolHost, operation: QuireAiEditOperationSchema): QuireAiStreamCommit {
  const states = new Map<string, QuireAiStreamState>();
  // Calls whose final write has begun; a late streaming delta must not start writing them again.
  const finishing = new Set<string>();

  /** @param context - Operation. @returns Its state, created on first sight. */
  function stateOf(context: QuireDocumentToolContext): QuireAiStreamState {
    const existing = states.get(context.callId);
    if (existing !== undefined) return existing;
    const policy = host.peekWrite({ toolCallId: context.callId, capabilityId: "quire.ai.document-edit", target: { kind: "document-blocks", id: "streaming" } });
    const state: QuireAiStreamState = {
      enabled: manager.editor.isEditable && policy !== null && !policy.previewRequired,
      doneOperations: 0, doneBlocks: 0, anchors: new Map(), deferred: [], parts: [], queue: Promise.resolve()
    };
    states.set(context.callId, state);
    // A stopped call keeps what it wrote; only its bookkeeping goes.
    context.signal.addEventListener("abort", () => states.delete(context.callId), { once: true });
    return state;
  }

  /**
   * Writes one part and records it under the model's operation index.
   * @param state - Call state.
   * @param source - Model operation index.
   * @param part - Operation or part of an insert.
   * @param context - Operation identity and cancellation.
   * @returns The write, or null when nothing applied.
   */
  async function commit(state: QuireAiStreamState, source: number, part: QuireAiModelOperation, context: QuireDocumentToolContext): Promise<QuireAiAppliedEdit | null> {
    try {
      const applied = await applyQuireAiEdit(manager, host, operation, [part], context);
      state.parts.push({ source, applied, failures: applied.outcome.failures.map(entry => renumber(entry.message, source)) });
      return applied;
    } catch (error) {
      if (context.signal.aborted) throw error;
      state.parts.push({ source, applied: null, failures: failureLines(error).map(line => renumber(line, source)) });
      return null;
    }
  }

  /**
   * Queues the closed blocks of a streaming insert, continuing after the blocks written before.
   * @param state - Call state.
   * @param source - Model operation index.
   * @param insert - Insert operation as streamed so far.
   * @param blocks - Closed blocks not yet queued.
   * @param context - Operation identity and cancellation.
   */
  function queueInsertBlocks(state: QuireAiStreamState, source: number, insert: QuireAiModelOperation, blocks: readonly unknown[], context: QuireDocumentToolContext): void {
    state.queue = state.queue.then(async () => {
      // The anchor is read when the part runs, after the part before it has written and moved it.
      const part = { ...withoutAnchor(insert), ...(state.anchors.get(source) ?? anchorOf(insert)), blocks };
      const applied = await commit(state, source, part, context);
      // After an anchor or at the body start, later blocks go after the last one written.
      const next = applied !== null && (insert.after !== undefined || insert.at === "start")
        ? afterLastInserted(applied, state.anchors.get(source) ?? anchorOf(insert)!) : null;
      if (next !== null) state.anchors.set(source, next);
    });
  }

  return {
    observe(input, context) {
      const operations = (input as { operations?: unknown } | null)?.operations;
      if (finishing.has(context.callId)) return input;
      const state = stateOf(context);
      if (!state.enabled || context.signal.aborted || !Array.isArray(operations)) return input;
      // Every operation but the last is closed; the last is closed only once the call ends.
      while (state.doneOperations < operations.length - 1) {
        const source = state.doneOperations;
        const entry = operations[source] as QuireAiModelOperation;
        if (state.doneBlocks > 0) {
          const rest = (entry.blocks as unknown[]).slice(state.doneBlocks);
          if (rest.length > 0) queueInsertBlocks(state, source, entry, rest, context);
        } else {
          state.queue = state.queue.then(async () => {
            // Emptying a container now would leave a placeholder block before the blocks still to come.
            if (emptiesContainer(entry)) state.deferred.push(source);
            else await commit(state, source, entry, context);
          });
        }
        state.doneOperations += 1;
        state.doneBlocks = 0;
      }
      const last = operations.at(-1) as QuireAiModelOperation | undefined;
      if (last?.op === "insert" && Array.isArray(last.blocks) && anchorOf(last) !== null) {
        const closed = last.blocks.slice(0, -1);
        if (closed.length > state.doneBlocks) {
          queueInsertBlocks(state, operations.length - 1, last, closed.slice(state.doneBlocks), context);
          state.doneBlocks = closed.length;
        }
      }
      return { ...(input as object), operations: remainingOperations(operations, state) };
    },
    async finish(operations, context, onPlanned) {
      const state = stateOf(context);
      finishing.add(context.callId);
      context.signal.addEventListener("abort", () => finishing.delete(context.callId), { once: true });
      states.delete(context.callId);
      await state.queue;
      if (!state.enabled || (state.doneOperations === 0 && state.doneBlocks === 0)) {
        return applyQuireAiEdit(manager, host, operation, operations, context, onPlanned);
      }
      // Held-back operations go first, in model order, then everything streaming did not reach.
      const tail = remainingOperations(operations, state);
      const pending = [
        ...state.deferred.map(source => ({ source, operation: operations[source] })),
        ...tail.map((entry, index) => ({ source: operations.length - tail.length + index, operation: entry }))
      ];
      // Streaming already wrote parts one by one; the rest follows the same way, each written alone.
      for (const entry of pending) await commit(state, entry.source, entry.operation as QuireAiModelOperation, context);
      return combine(state, operations.length);
    }
  };

  /**
   * Tells whether a delete would empty a container in the document as it is now.
   * @param entry - Operation as the model wrote it.
   * @returns Whether it is a delete that clears a container's last block.
   */
  function emptiesContainer(entry: QuireAiModelOperation): boolean {
    if (entry.op !== "delete") return false;
    try {
      const { planned } = planQuireAiEdit([entry], { doc: manager.editor.state.doc, registry: manager.registry, identity: manager.identity, operation });
      return planned.some(planEntry => planEntry.kind === "delete" && planEntry.ranges.some(range => range.clear));
    } catch {
      return false;
    }
  }

  /**
   * Finds the block an insert part wrote last, as the anchor for the blocks after it: the written
   * blocks are the siblings right after the anchor block, or the first ones of the body.
   * @param applied - Write of an insert part.
   * @param anchor - Anchor the part was written at.
   * @returns `{ after: id }`, or null when it cannot be found.
   */
  function afterLastInserted(applied: QuireAiAppliedEdit, anchor: QuireAiModelOperation): QuireAiModelOperation | null {
    const written = applied.outcome.plan.reduce((sum, entry) => sum + (entry.kind === "insert" ? entry.blocks.length : 0), 0);
    if (written === 0) return null;
    const doc = manager.editor.state.doc;
    let target: number | null = null;
    if (typeof anchor.after === "string") {
      const pos = manager.identity.resolve(anchor.after);
      if (pos === null) return null;
      const $pos = doc.resolve(pos);
      const index = $pos.index() + written;
      if (index >= $pos.parent.childCount) return null;
      target = $pos.start() + offsetOfChild($pos.parent, index);
    } else if (anchor.at === "start") {
      const body = collectQuireAiSections(doc, manager.registry).find(section => !section.story);
      if (body === undefined || written > body.container.childCount) return null;
      target = body.contentStart + offsetOfChild(body.container, written - 1);
    }
    if (target === null) return null;
    const blocks = collectQuireAiSections(doc, manager.registry).flatMap(section => collectQuireAiBlocks(section, manager.registry));
    const ids = manager.identity.assign(blocks.map(block => ({ pos: block.pos, type: block.node.type.name, size: block.node.nodeSize })));
    const index = blocks.findIndex(block => block.pos === target);
    return index < 0 ? null : { after: ids[index] };
  }
}
