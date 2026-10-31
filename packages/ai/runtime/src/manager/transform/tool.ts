import { Type } from "typebox";
import { QuireDocumentSdkError } from "../../document-sdk/error";
import type { QuireDocumentTool } from "../../document-tools";
import type { QuireAiToolHost } from "../../tool-host";
import { applyQuireAiEdit } from "../edit/apply";
import { quireAiReplyLanguageNote } from "../edit/settle";
import type { QuireAiEditOperationSchema } from "../edit/schema";
import type { QuireAiManager } from "../types";
import { buildQuireAiTransformOperation } from "./build";
import { decodeQuireAiSegments } from "./decode";
import { createQuireAiTransformPrompt, createQuireAiTransformSystemPrompt } from "./prompt";
import { describeQuireAiTransform, type QuireAiTransformReport } from "./report";
import { selectQuireAiTransformBlocks } from "./select";
import type { QuireAiSegment, QuireAiSegmentAnswer, QuireAiTransformOptions, QuireAiTransformRun } from "./types";

/** Core tool name for applying one text task to every block in scope. */
export const QUIRE_AI_DOCUMENT_TRANSFORM_TOOL_NAME = "document_transform" as const;

const blockId = Type.String({ pattern: "^b[0-9]+$" });

const parameters = Type.Object({
  instruction: Type.String({ minLength: 1, description: "The task for each block's text, such as \"Translate into Simplified Chinese.\" Say only what to do with the text." }),
  placement: Type.Union([Type.Literal("after"), Type.Literal("replace")], {
    description: "`after`: each result becomes a new paragraph right after its block, such as a translation placed below the original; `replace`: each block is rewritten in place."
  }),
  scope: Type.Optional(Type.Union([Type.Literal("document"), Type.Literal("selection")], {
    description: "The whole document (default), or only the blocks in the user's selection."
  })),
  blocks: Type.Optional(Type.Array(blockId, { minItems: 1, maxItems: 500, description: "Only these blocks, with the blocks inside them such as a table's cells." })),
  exclude: Type.Optional(Type.Array(blockId, { minItems: 1, maxItems: 500, description: "Blocks to leave as they are, with the blocks inside them, such as a table that stays untranslated." }))
}, { additionalProperties: false });

/** One segment ready to write. */
interface PlannedSegment {
  /** Source segment. */
  readonly segment: QuireAiSegment;
  /** Whether its formatting fell back to the shared formats. */
  readonly degraded: boolean;
  /** Answer text, for quoting written results in the report. */
  readonly text: string;
  /** Edit operation. */
  readonly operation: Record<string, unknown>;
}

/**
 * Creates the transform tool: one text task applied to every text block in scope.
 *
 * Stages: choose and encode blocks from the document before any write; send
 * groups of numbered segments to the model, several groups at a time; check the
 * answers and ask once more for missing or broken ones; build the edit
 * operations in the program and write the groups one after another through the
 * shared edit path, under the request's execution; report coverage. The model
 * never sees block ids and never writes operations or format markup.
 *
 * @param manager - AI manager supplying facts and block identities.
 * @param host - Guarded write authority.
 * @param operation - Strict edit operation union.
 * @param options - Model access and pacing.
 * @param unfinished - Interrupted runs by task, kept by the document SDK across requests; a run
 *   continued with the same task skips the blocks it finished and never touches blocks it added.
 * @returns Write tool.
 */
export function createQuireAiTransformTool(
  manager: QuireAiManager,
  host: QuireAiToolHost,
  operation: QuireAiEditOperationSchema,
  options: QuireAiTransformOptions,
  unfinished: Map<string, QuireAiTransformRun>
): QuireDocumentTool<typeof parameters> {
  const concurrency = Math.max(1, options.concurrency ?? 3);
  const tool: QuireDocumentTool<typeof parameters> = {
    name: QUIRE_AI_DOCUMENT_TRANSFORM_TOOL_NAME,
    label: "Transform Document",
    description: [
      "Applies one text task — translating, proofreading, rewriting or unifying wording — to every text block in scope, block by block.",
      "The program chooses the blocks, keeps their formatting and places the results; give only the task and the placement.",
      "Keep blocks such as a table out with `exclude`, or limit the run with `blocks`; a container's id covers the blocks inside it.",
      "Use document_edit instead for targeted or structural changes.",
      "To continue a run that was stopped, call it again with the same instruction and placement; finished blocks are skipped.",
      "When the result says the task is complete, tell the user the outcome without reading the document again."
    ].join(" "),
    parameters,
    effect: "write" as const,
    async execute(input, context) {
      const selection = host.read(context.signal, editor => {
        const { from, to } = editor.state.pm.selection;
        return selectQuireAiTransformBlocks(editor.state.doc, manager.registry, manager.identity, input.placement,
          input.scope === "selection" ? { from, to } : undefined, { blocks: input.blocks, exclude: input.exclude });
      });
      if (selection.segments.length === 0 && selection.skipped.length === 0) {
        throw new QuireDocumentSdkError("invalid-input", "No block in scope has text to transform.");
      }
      const key = [input.placement, input.scope ?? "document", input.blocks?.join(",") ?? "", input.exclude?.join(",") ?? "", input.instruction].join("\n");
      const run: QuireAiTransformRun = unfinished.get(key) ?? { scope: new Set(selection.segments.map(segment => segment.block)), finished: new Set() };
      unfinished.set(key, run);
      const { finished } = run;
      const segments = selection.segments.filter(segment => run.scope.has(segment.block) && !finished.has(segment.block));
      const groups = groupSegments(segments, options.segmentsPerCall ?? 40, options.charactersPerCall ?? 6000);
      const system = createQuireAiTransformSystemPrompt(input.instruction);
      const report: QuireAiTransformReport = {
        total: segments.length, resumed: finished.size, done: 0, transformed: 0, degraded: 0,
        failures: [], skipped: [...selection.skipped], samples: [], usage: { input: 0, output: 0, cacheRead: 0 }
      };

      const ask = async (segments: readonly QuireAiSegment[]): Promise<Map<number, QuireAiSegmentAnswer>> => {
        const answer = await options.model.complete({ system, prompt: createQuireAiTransformPrompt(segments), signal: context.signal });
        report.usage.input += answer.usage?.input ?? 0;
        report.usage.output += answer.usage?.output ?? 0;
        report.usage.cacheRead += answer.usage?.cacheRead ?? 0;
        return decodeQuireAiSegments(answer.text, new Map(segments.map(segment => [segment.number, segment])));
      };
      // Groups write one after another under the tool's own call; a transform never waits for approval.
      const write = async (planned: readonly PlannedSegment[]): Promise<void> => {
        try {
          const applied = await applyQuireAiEdit(manager, host, operation, planned.map(entry => entry.operation), context, undefined, false);
          const failed = new Map(applied.edit.failed.map(entry => [entry.operation - 1, entry.message]));
          const refused = !applied.result.applied && !applied.alreadySatisfied;
          planned.forEach((entry, index) => {
            const reason = refused ? "the change could not be recorded as a tracked change" : failed.get(index);
            if (reason !== undefined) report.failures.push({ block: entry.segment.block, reason });
            else {
              finished.add(entry.segment.block);
              report.transformed += 1;
              if (entry.degraded) report.degraded += 1;
              report.samples.push({ number: entry.segment.number, source: entry.segment.text, result: entry.text });
            }
          });
        } catch (error) {
          if (context.signal.aborted) throw error;
          for (const entry of planned) report.failures.push({ block: entry.segment.block, reason: messageOf(error) });
        }
      };
      let writes = Promise.resolve();
      const runGroup = async (group: readonly QuireAiSegment[]): Promise<void> => {
        try {
          const answers = await ask(group);
          const retry = group.filter(segment => answers.get(segment.number)!.status !== "ok");
          if (retry.length > 0) {
            const again = await ask(retry);
            for (const segment of retry) {
              const next = again.get(segment.number)!;
              if (next.status === "ok" || answers.get(segment.number)!.status === "missing") answers.set(segment.number, next);
            }
          }
          const planned = group.flatMap((segment): PlannedSegment[] => {
            const answer = answers.get(segment.number)!;
            if (answer.status === "missing") {
              report.failures.push({ block: segment.block, reason: answer.reason });
              return [];
            }
            // An unchanged answer would duplicate the block after it, or rewrite it to itself.
            if (answer.text.trim() === segment.text.trim()) {
              report.skipped.push({ block: segment.block, reason: "the task leaves it as it is" });
              finished.add(segment.block);
              return [];
            }
            return [{ segment, degraded: answer.status === "degraded", text: answer.text, operation: buildQuireAiTransformOperation(segment, answer.text, input.placement) }];
          });
          // Answers arrive out of order; each group plans its write against the document as it is then.
          if (planned.length > 0) await (writes = writes.then(() => write(planned)));
        } catch (error) {
          if (context.signal.aborted) throw error;
          for (const segment of group) report.failures.push({ block: segment.block, reason: messageOf(error) });
        }
        report.done += group.length;
        context.onProgress?.({ summary: `Transformed ${report.transformed} of ${report.total} blocks.`, done: report.done, total: report.total });
      };

      let next = 0;
      await Promise.all(Array.from({ length: Math.min(concurrency, groups.length) }, async () => {
        while (next < groups.length) {
          context.signal.throwIfAborted();
          await runGroup(groups[next++]!);
        }
      }));
      await writes;
      // A run that reached its end needs no continuation; the next call with this task starts afresh.
      unfinished.delete(key);
      return {
        value: { blocks: report.total, transformed: report.transformed, degraded: report.degraded, failed: report.failures, skipped: report.skipped, usage: report.usage },
        summary: `${describeQuireAiTransform(report, selection.texts)}\n${quireAiReplyLanguageNote}`
      };
    }
  };
  return Object.freeze(tool);
}

/**
 * @param segments - Segments in document order.
 * @param count - Most segments per group.
 * @param characters - Most segment characters per group.
 * @returns Groups in document order.
 */
function groupSegments(segments: readonly QuireAiSegment[], count: number, characters: number): QuireAiSegment[][] {
  const groups: QuireAiSegment[][] = [];
  let size = 0;
  for (const segment of segments) {
    const current = groups.at(-1);
    if (current === undefined || current.length >= count || (current.length > 0 && size + segment.text.length > characters)) {
      groups.push([segment]);
      size = segment.text.length;
    } else {
      current.push(segment);
      size += segment.text.length;
    }
  }
  return groups;
}

/**
 * @param error - Thrown value.
 * @returns Its message.
 */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
