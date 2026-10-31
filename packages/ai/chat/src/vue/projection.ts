import type { QuireKitChatMessageListItem, QuireKitChatMessagePart, QuireKitChatToolPart } from "@quirekit/ui";
import type { AiChatDocumentOperation, AiChatExecutionTraceEntry, AiChatSnapshot } from "../types";

/** Project business state into engine-neutral public Chat props.
 * @param snapshot - Retained conversation state.
 * @param locale - Product language.
 * @returns Ordered public message projections.
 */
export function projectChatMessages(snapshot: AiChatSnapshot, locale: "zh-CN" | "en"): readonly QuireKitChatMessageListItem[] {
  const operations = new Map(snapshot.documentEvents.flatMap(event => event.type === "operation" ? [[event.operation.id, event.operation] as const] : []));
  const reviews = new Map(snapshot.reviews.map(review => [review.preview.id, review]));
  const waiting = new Set(snapshot.reviews.filter(review => review.state === "pending").map(review => review.preview.operationId));
  const progress = new Map(snapshot.documentEvents.flatMap(event => event.type === "progress" ? [[event.operationId, event.progress] as const] : []));
  return snapshot.messages.map(message => {
    const source = message.parts ?? [];
    const traces = new Map<string, AiChatExecutionTraceEntry>();
    for (const part of source) {
      if (part.kind === "trace" && part.entry.operationId !== undefined) {
        traces.set(part.entry.operationId, { ...traces.get(part.entry.operationId), ...part.entry });
      }
    }
    const seen = new Set<string>();
    // Facts are indexed, but only the first-arrival timeline determines placement.
    // Trace and SDK snapshots share one opaque operation ID and one visible Tool.
    const parts: QuireKitChatMessagePart[] = message.role === "user"
      ? [{ id: `${message.id}:text`, kind: "text", text: message.content }]
      : source.flatMap<QuireKitChatMessagePart>(part => {
        if (part.kind === "content") return [{
          id: part.id, kind: "text", format: "markdown", text: part.content,
          state: part !== source.at(-1) ? "complete" : message.pending ? "streaming"
            : message.status === "error" ? "error" : message.status === "stopped" ? "stopped" : "complete"
        }];
        if (part.kind === "reasoning") return [{ id: part.id, kind: "reasoning", text: part.content, state: part.status === "streaming" ? "streaming" : "complete" }];
        if (part.kind === "review") {
          const review = reviews.get(part.reviewId);
          return review === undefined ? [] : [{ id: part.id, kind: "custom", name: "document-review", data: review,
            fallback: locale === "zh-CN" ? "文档修改审阅" : "Document change review" }];
        }
        if (part.kind === "trace" && (part.entry.kind === "agent" || part.entry.kind === "model")) return [];
        const operationId = part.kind === "document" ? part.operationId : part.entry.operationId;
        if (operationId === undefined) return [projectTool(part.id, part.kind === "trace" ? part.entry : undefined, undefined, false, locale)];
        if (seen.has(operationId)) return [];
        seen.add(operationId);
        return [projectTool(`operation:${operationId}`, traces.get(operationId), operations.get(operationId), waiting.has(operationId), locale, progress.get(operationId))];
      });
    return {
      messageId: message.id, author: message.role === "user" ? (locale === "zh-CN" ? "你" : "You") : "Quire AI",
      align: message.role === "user" ? "end" : "start", variant: message.role === "user" ? "soft" : "plain",
      parts, state: message.status ?? "complete", copyText: message.content,
      ...(message.status === "error" || message.status === "stopped" ? { statusText: failureLabel(message.errorCode, locale) } : {})
    };
  });
}

/** Fold authoritative commits into the existing tool disclosure, never a trailing alert.
 * @param id - Stable first-arrival presentation identity.
 * @param entry - Latest redacted adapter trace, when supplied.
 * @param operation - SDK facts, independent of model success.
 * @param waiting - Whether this operation needs a review decision.
 * @param locale - Product language.
 * @param progress - Latest progress the operation reported, when any.
 * @returns One compact public Tool with inspectable results and commit receipts.
 */
function projectTool(id: string, entry: AiChatExecutionTraceEntry | undefined, operation: AiChatDocumentOperation | undefined, waiting: boolean, locale: "zh-CN" | "en", progress?: { readonly done?: number; readonly total?: number }): QuireKitChatToolPart {
  const status = entry?.status === "failed" || entry?.status === "cancelled"
    ? entry.status : operation?.status ?? entry?.status ?? "running";
  const state = waiting ? "waiting" : status === "completed" ? "succeeded" : status === "pending" ? "queued" : status;
  const value = entry?.result ?? operation?.result?.value;
  const output = operation === undefined ? value : {
    ...(value === undefined ? {} : { result: value }),
    document: { status: operation.status, committed: operation.committed, receipts: operation.receipts }
  };
  const counted = state === "running" && progress?.done !== undefined && progress.total !== undefined;
  return {
    id, kind: "tool", title: documentToolLabel(entry?.toolName ?? operation?.toolName, locale), state,
    ...(waiting ? { stateLabel: locale === "zh-CN" ? "等待批准" : "Awaiting approval" }
      : counted ? { stateLabel: locale === "zh-CN" ? `已处理 ${progress.done}/${progress.total}` : `${progress.done} of ${progress.total} done` }
      : operation?.committed && state === "succeeded" ? { stateLabel: locale === "zh-CN" ? "已修改文档" : "Document updated" } : {}),
    ...(entry?.arguments === undefined ? {} : { input: stringify(entry.arguments)! }),
    ...(output === undefined ? {} : { output: stringify(output)! }),
    ...(state !== "failed" ? {} : { error: operation?.committed
      ? (locale === "zh-CN" ? "已有修改写入文档；本次操作未完成，可展开检查结果。" : "Changes were committed, but the operation did not finish. Expand to inspect the result.")
      : (locale === "zh-CN" ? "操作未完成，可展开检查输入与结果。" : "The operation did not complete. Expand to inspect its input and result.") })
  };
}

const documentToolLabels: Readonly<Record<string, readonly [string, string]>> = {
  document_read: ["读取文档", "Read document"],
  document_edit: ["修改文档", "Edit document"],
  document_transform: ["逐段处理文档", "Process document block by block"],
  document_help: ["查看编辑参数", "Look up edit parameters"],
  skill_read: ["读取技能", "Read skill"]
};

/** @param toolName - Public document tool identity. @param locale - Product language. @returns Semantic user-facing action. */
function documentToolLabel(toolName: string | undefined, locale: "zh-CN" | "en"): string {
  const labels = toolName === undefined ? undefined : documentToolLabels[toolName];
  return labels?.[locale === "zh-CN" ? 0 : 1] ?? (locale === "zh-CN" ? "文档操作" : "Document operation");
}

/** Serialize only already-sanitized trace data for optional inspection.
 * @param value - Public trace payload.
 * @returns Readable trace content when present.
 */
function stringify(value: unknown): string | undefined {
  return value === undefined ? undefined : typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

/** Translate stable harness categories without parsing exception text.
 * @param code - Machine failure category.
 * @param locale - Product language.
 * @returns Recovery-oriented status.
 */
export function failureLabel(code: string | undefined, locale: "zh-CN" | "en"): string {
  const chinese: Record<string, string> = {
    cancelled: "已停止生成；已提交的修改仍保留。", timeout: "模型响应超时，可重新发送或调整连接。",
    "turn-budget-exceeded": "已达到本轮执行上限，请缩小任务范围后继续。",
    "no-progress": "连续几次修改都没有生效，已停止；已生效的修改仍保留。可展开上面的步骤查看原因。",
    "provider-failed": "模型请求失败，请检查连接后继续。",
    "invalid-response": "模型返回无效结果，请检查模型能力或重试。",
    "document-mismatch": "文档已切换，请新建对话后继续。", closed: "会话已关闭，请重新打开编辑器。", busy: "上一轮尚未结束，请等待或停止。"
  };
  if (locale === "zh-CN") return chinese[code ?? ""] ?? "本轮未完成；已有文档回执保留，可继续发送请求。";
  const english: Record<string, string> = {
    cancelled: "Generation stopped. Committed changes remain.",
    timeout: "The model timed out. Check the connection or send the request again.",
    "turn-budget-exceeded": "This turn reached its execution limit. Continue with a smaller task.",
    "no-progress": "Several edits in a row changed nothing, so the turn stopped. Applied changes remain; expand the steps above to see why.",
    "provider-failed": "The model request failed. Check the connection before continuing.",
    "invalid-response": "The model returned an invalid response. Check its capabilities or try again.",
    "document-mismatch": "The document was switched. Start a new conversation to continue.",
    closed: "This conversation is closed. Reopen the editor to continue.",
    busy: "The previous turn is still running. Wait or stop it before continuing."
  };
  return english[code ?? ""] ?? "The turn did not complete. Committed changes remain; check the connection or send a follow-up.";
}
