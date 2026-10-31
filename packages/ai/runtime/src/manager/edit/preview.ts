import type { QuireDocumentToolContext } from "../../document-tools";
import type { QuireAiPreviewChannel } from "../previews";
import type { QuireAiManager, QuireAiPresentation } from "../types";
import { planQuireAiEdit } from "./plan";
import { presentQuireAiEdit } from "./presentation";
import { createQuireAiPreviewPacer, type QuireAiPreviewPacer } from "./pacing";
import type { QuireAiEditOperationSchema } from "./schema";
import { readQuireAiStreamingOperations, type QuireAiStreamingOperations } from "./streaming";
import type { QuireAiPlannedOperation } from "./types";

/** Preview publishing for one `document_edit` tool instance. */
export interface QuireAiStreamingPreview {
  /**
   * Previews partially generated arguments.
   * @param input - Partially parsed arguments.
   * @param context - Operation identity and cancellation.
   */
  observe(input: unknown, context: QuireDocumentToolContext): void;
  /**
   * Previews a validated edit until the operation clears it.
   * @param operationId - Owning operation.
   * @param plan - Operations planned against the current document.
   */
  showPlanned(operationId: string, plan: readonly QuireAiPlannedOperation[]): void;
}

/**
 * Creates the streaming preview of the core edit tool.
 *
 * Deltas are paced: only the latest is planned, at a rate the document's layout
 * can absorb. It is planned against the current document with the same planner
 * as the commit, so the preview shows what the edit would do now. A delta whose
 * trailing text cannot be planned yet (for example unclosed markup) keeps the
 * previous preview instead of flickering back to the closed operations.
 *
 * @param manager - AI manager supplying the editor, facts and identities.
 * @param previews - Preview channel.
 * @param operation - Strict operation union.
 * @returns Streaming preview handlers.
 */
export function createQuireAiStreamingPreview(
  manager: QuireAiManager,
  previews: QuireAiPreviewChannel,
  operation: QuireAiEditOperationSchema
): QuireAiStreamingPreview {
  const editor = manager.editor;
  const pacers = new Map<string, QuireAiPreviewPacer>();
  const latest = new Map<string, QuireAiPresentation>();

  /**
   * @param operations - Model operations.
   * @returns Preview of the operations that plan, or null when none does.
   */
  function tryPresent(operations: QuireAiStreamingOperations["complete"]): QuireAiPresentation | null {
    if (operations.length === 0) return null;
    try {
      const { planned } = planQuireAiEdit(operations, { doc: editor.state.doc, registry: manager.registry, identity: manager.identity, operation });
      return planned.length === 0 ? null : presentQuireAiEdit(editor, planned);
    } catch {
      return null;
    }
  }

  /**
   * @param context - Operation whose cancellation clears its preview.
   * @returns The operation's pacer.
   */
  function watch(context: QuireDocumentToolContext): QuireAiPreviewPacer {
    const existing = pacers.get(context.callId);
    if (existing !== undefined) return existing;
    const pacer = createQuireAiPreviewPacer();
    pacers.set(context.callId, pacer);
    context.signal.addEventListener("abort", () => {
      pacer.cancel();
      pacers.delete(context.callId);
      latest.delete(context.callId);
      previews.clear(context.callId);
    }, { once: true });
    return pacer;
  }

  return {
    observe(input, context) {
      if (!editor.isEditable || context.signal.aborted) return;
      watch(context).request(() => {
        if (context.signal.aborted) return;
        const operations = readQuireAiStreamingOperations(input, operation);
        previews.show(context.callId, () => {
          const withTrailing = operations.trailing === undefined
            ? null : tryPresent([...operations.complete, operations.trailing]);
          const previous = latest.get(context.callId);
          const next = withTrailing
            ?? (operations.trailing !== undefined && previous?.baseDoc === editor.state.doc ? previous : null)
            ?? tryPresent(operations.complete);
          if (next === null) latest.delete(context.callId);
          else latest.set(context.callId, next);
          return next;
        });
      });
    },
    showPlanned(operationId, plan) {
      // A paced delta still waiting must not replace the complete edit.
      pacers.get(operationId)?.cancel();
      pacers.delete(operationId);
      latest.delete(operationId);
      const baseDoc = editor.state.doc;
      previews.show(operationId, () => editor.state.doc === baseDoc ? presentQuireAiEdit(editor, plan) : null);
    }
  };
}
