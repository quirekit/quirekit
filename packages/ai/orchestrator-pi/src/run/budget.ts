import type { QuireDocumentSdk } from "@quirekit/ai-runtime";
import { documentOperationId } from "../tools";
import type { PiRunBudget, PiRunBudgetLimits, PiRunBudgetStop } from "./types";

/**
 * Counts model requests against a hard bound and stops early when consecutive turns make no document progress.
 * A committed write is progress; a successful read is progress only for input not already read since the last
 * committed write, so re-reading after a change to verify it still counts. Failed calls never count.
 * @param document - SDK that owns operation facts and tool side-effect classes.
 * @param sessionId - Native conversation identity used in operation ids.
 * @param runId - Run identity used in operation ids.
 * @param requestId - Captured request whose mounted tools are classified.
 * @param limits - Hard and idle turn bounds.
 * @returns Run-local budget fed by tool events and consulted before each model request.
 */
export function createPiRunBudget(
  document: QuireDocumentSdk,
  sessionId: string,
  runId: string,
  requestId: string,
  limits: PiRunBudgetLimits
): PiRunBudget {
  const effects = new Map(document.tools(requestId).map(tool => [tool.name, tool.effect]));
  const calls = new Map<string, { readonly toolName: string; readonly signature: string }>();
  const readSinceWrite = new Set<string>();
  let turns = 0;
  let idle = 0;
  let progressed = false;
  return {
    start(toolCallId, toolName, args) {
      calls.set(toolCallId, { toolName, signature: `${toolName}:${JSON.stringify(args) ?? ""}` });
    },
    end(toolCallId, isError) {
      const call = calls.get(toolCallId);
      calls.delete(toolCallId);
      if (call === undefined || isError) return;
      if (effects.get(call.toolName) === "write") {
        if (document.getOperation(documentOperationId(sessionId, runId, toolCallId))?.committed !== true) return;
        readSinceWrite.clear();
        progressed = true;
        return;
      }
      if (readSinceWrite.has(call.signature)) return;
      readSinceWrite.add(call.signature);
      progressed = true;
    },
    admit() {
      // A request after the first closes the previous turn, whose tool calls have all ended.
      if (turns > 0) {
        idle = progressed ? 0 : idle + 1;
        progressed = false;
      }
      if (limits.maxIdleTurns !== undefined && idle >= limits.maxIdleTurns) return "no-progress" satisfies PiRunBudgetStop;
      if (turns >= limits.maxModelTurns) return "turn-budget-exceeded" satisfies PiRunBudgetStop;
      turns += 1;
      return undefined;
    }
  };
}
