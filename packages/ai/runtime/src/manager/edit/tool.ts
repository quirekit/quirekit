import { QuireDocumentSdkError } from "../../document-sdk/error";
import type { Node } from "@quirekit/pm";
import type { QuireDocumentTool, QuireDocumentToolContext } from "../../document-tools";
import type { QuireAiToolHost, QuireAiToolWriteResult } from "../../tool-host";
import type { QuireAiPreviewChannel } from "../previews";
import type { QuireAiManager } from "../types";
import { renderQuireAiDocumentView } from "../view/render";
import type { QuireAiAppliedEdit } from "./apply";
import { describeQuireAiEditCatalog } from "./catalog";
import { createQuireAiStreamingPreview } from "./preview";
import { describeQuireAiEditOutcome, quireAiReplyLanguageNote, quireAiUntrackableCode } from "./settle";
import { createQuireAiStreamCommit } from "./stream-commit";
import { createQuireAiEditOperation, createQuireAiEditParameters, quireAiEditOperationLimit, type QuireAiEditParameters } from "./schema";

/** Write result of an edit, with what each operation came to. */
export type QuireAiEditResult = QuireAiToolWriteResult & {
  /** Operations applied, failed and left unprocessed. */
  readonly edit: {
    /** Number of operations applied. */
    readonly applied: number;
    /** Failed operations, numbered from 1, with the reason. */
    readonly failed: readonly { readonly operation: number; readonly message: string }[];
    /** Operations past the per-call limit. */
    readonly unprocessed: number;
  };
};

/** Core tool name for block-addressed editing. */
export const QUIRE_AI_DOCUMENT_EDIT_TOOL_NAME = "document_edit" as const;

/** Blocks of the post-edit view returned with a successful edit. */
const resultViewLimit = 80;

/**
 * Creates the core editing tool.
 *
 * @param manager - AI manager supplying facts and block identities.
 * @param host - Guarded write authority.
 * @param previews - In-document preview channel.
 * @returns Write tool applying a batch of block operations as one transaction.
 */
export function createQuireAiEditTool(
  manager: QuireAiManager,
  host: QuireAiToolHost,
  previews: QuireAiPreviewChannel
): QuireDocumentTool<QuireAiEditParameters, QuireAiEditResult> {
  const parameters = createQuireAiEditParameters(manager.registry);
  const operation = createQuireAiEditOperation(manager.registry);
  const streaming = createQuireAiStreamingPreview(manager, previews, operation);
  const commits = createQuireAiStreamCommit(manager, host, operation);
  // Document as each call first saw it, so the result can list the blocks around what changed.
  const sources = new Map<string, Node>();
  /** @param context - Operation. Records the document before the call writes anything. */
  const remember = (context: QuireDocumentToolContext) => {
    if (sources.has(context.callId)) return;
    sources.set(context.callId, manager.editor.state.doc);
    context.signal.addEventListener("abort", () => sources.delete(context.callId), { once: true });
  };
  const tool: QuireDocumentTool<QuireAiEditParameters, QuireAiEditResult> = {
    name: QUIRE_AI_DOCUMENT_EDIT_TOOL_NAME,
    label: "Edit Document",
    description: [
      "Changes the document by block id. Operations are written in order, each as soon as it is complete; the blocks of a long insert are written one by one while you generate them, so what is written stays even if a later part fails.",
      "replace: new block content; replace_text: exact text inside a block; insert: new blocks after/before a block or at the body start/end;",
      "move: adjacent blocks, as they are, after/before a block or to the body start/end (reorder rather than delete and insert again); delete: whole blocks; format: paragraph formats for whole blocks, character formats for whole blocks or for `text` inside them.",
      "Inline markup as in the view: **bold**, *italic*, [text]{name:value}. Format names and values are those shown in the view; null clears.",
      "Operations refer to the document as last read. Returns the updated view with ids of new blocks.",
      `At most ${quireAiEditOperationLimit} operations per call; split a larger edit into several calls.`,
      "Each operation is applied or reported on its own: when some fail, the rest still apply and the result lists only the failed ones to send again.",
    ].join(" ") + `\n${describeQuireAiEditCatalog(manager.registry)}`,
    parameters,
    effect: "write" as const,
    observeInput: (input, context) => {
      remember(context);
      return streaming.observe(commits.observe(input, context), context);
    },
    /**
     * Plans, preflights and commits the edit.
     * @param input - Validated operations.
     * @param context - Operation identity and cancellation.
     * @returns Write result with the updated view as the model-visible summary.
     */
    async execute(input, context) {
      let applied: QuireAiAppliedEdit;
      remember(context);
      const source = sources.get(context.callId)!;
      try {
        // The complete edit stays previewed until it commits, is rejected or fails.
        applied = await commits.finish(input.operations, context, plan => streaming.showPlanned(context.callId, plan));
      } catch (error) {
        // Operations that failed with a stated reason are an outcome for the model to act on, not a run failure:
        // the result lists them, and the person sees no error for a mistake the model corrects itself.
        const lines = error instanceof QuireDocumentSdkError ? error.message.split("\n").filter(line => line.startsWith("- Operation ")) : [];
        if (lines.length === 0) throw error;
        const failed = lines.map(line => ({ operation: Number(/^- Operation (\d+)/u.exec(line)?.[1] ?? "1"), message: line.slice(2) }));
        const value = { applied: false as const, receipt: null, reason: "unchanged" as const, edit: { applied: 0, failed, unprocessed: 0 } };
        // Content tracked changes cannot record stays as it is; sending it again changes nothing.
        if ((error as QuireDocumentSdkError).code === quireAiUntrackableCode) {
          return { value, summary: `Nothing was changed. Left as they are — tracked changes cannot record these, so do not send them again; tell the user which content stays:\n${lines.join("\n")}\n${quireAiReplyLanguageNote}` };
        }
        return { value, summary: `${(error as Error).message}\n${quireAiReplyLanguageNote}` };
      } finally {
        previews.clear(context.callId);
        sources.delete(context.callId);
      }
      const { result, edit, outcome } = applied;
      if (!result.applied) {
        if (result.reason === "rejected") return { value: { ...result, edit }, summary: "The user rejected the edit; the document is unchanged." };
        if (applied.alreadySatisfied) return { value: { ...result, edit }, summary: "Nothing needed to change: the formats were already set, or the blocks were already deleted and stay visible as tracked deletions until reviewed." };
        // The dry run found a change, so in tracked mode the revision system kept it out or already holds it pending.
        const tracked = host.peekWrite({ toolCallId: context.callId, capabilityId: "quire.ai.document-edit", target: { kind: "document-blocks", id: "result" } })?.mode === "tracked";
        return {
          value: { ...result, edit },
          summary: tracked
            ? `Nothing was changed: tracked changes could not record this change here, or the same change is already pending review. Do not send it again, and never tell the user it was done or was already so: say it could not be recorded as a revision (it can be made with full access) or is already pending review.\n${quireAiReplyLanguageNote}`
            : `Nothing was changed: the document already has this content or formatting. Do not send it again; tell the user it was already so.\n${quireAiReplyLanguageNote}`
        };
      }
      const view = host.read(context.signal, editor => renderQuireAiDocumentView(editor.state.doc, manager.registry, manager.identity, {
        limit: resultViewLimit, stories: true, around: source.content.findDiffStart(editor.state.doc.content) ?? undefined
      }));
      const tail = view.listed === view.total ? "" : `\n(${view.listed} of ${view.total} blocks, starting just before the first change; call document_read for others)`;
      return { value: { ...result, edit }, summary: `${describeQuireAiEditOutcome(outcome)}\nUpdated document:\n${view.text}${tail}\n${quireAiReplyLanguageNote}` };
    }
  };
  return Object.freeze(tool);
}
