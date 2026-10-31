import { describe, expect, it } from "vitest";
import type { AiChatExecutionTraceEntry } from "../types";
import {
  appendAiChatTextMessagePart,
  finalizeAiChatMessageParts,
  upsertAiChatTraceMessagePart
} from "./model";

describe("AI Chat chronological message parts", () => {
  it("keeps raw reasoning, tools, and content in arrival order", () => {
    let parts = appendAiChatTextMessagePart([], "reasoning", "reason-1", "先读取文档。");
    parts = upsertAiChatTraceMessagePart(parts, {
      ...trace("tool-1", "tool-call", "running"),
      arguments: { capabilityId: "document.inspect" }
    });
    parts = upsertAiChatTraceMessagePart(parts, trace("tool-1", "tool-call", "succeeded"));
    parts = upsertAiChatTraceMessagePart(parts, trace("result-1", "tool-result", "succeeded"));
    parts = appendAiChatTextMessagePart(parts, "reasoning", "reason-2", "读取完成，准备回答。");
    parts = appendAiChatTextMessagePart(parts, "content", "content-1", "发现一处错别字。");

    expect(parts.map(part => part.kind)).toEqual([
      "reasoning",
      "trace",
      "trace",
      "reasoning",
      "content"
    ]);
    expect(parts[1]).toMatchObject({
      kind: "trace",
      entry: {
        id: "tool-1",
        status: "succeeded",
        arguments: { capabilityId: "document.inspect" }
      }
    });
  });

  it("starts a new content part after a tool event and avoids final duplication", () => {
    let sequence = 0;
    let parts = appendAiChatTextMessagePart([], "content", "content-1", "准备调用工具。");
    parts = upsertAiChatTraceMessagePart(parts, trace("tool-1", "tool-call", "succeeded"));
    parts = appendAiChatTextMessagePart(parts, "content", "content-2", "修改已经完成。");
    parts = finalizeAiChatMessageParts(
      parts,
      "修改已经完成。",
      kind => `${kind}-${++sequence}`
    );

    expect(parts.map(part => part.kind)).toEqual(["content", "trace", "content"]);
    expect(parts.filter(part => part.kind === "content")).toHaveLength(2);
  });

  it("completes a partially streamed final content part without duplicating its prefix", () => {
    let sequence = 0;
    const parts = finalizeAiChatMessageParts(
      appendAiChatTextMessagePart([], "content", "content-1", "修改已经"),
      "修改已经完成。",
      kind => `${kind}-${++sequence}`
    );

    expect(parts).toEqual([{
      id: "content-1",
      kind: "content",
      content: "修改已经完成。"
    }]);
  });

  it("preserves every provider-authored reasoning character without a local display cap", () => {
    const first = "甲".repeat(24_000);
    const second = "乙".repeat(24_000);
    const parts = appendAiChatTextMessagePart(
      appendAiChatTextMessagePart([], "reasoning", "reasoning-1", first),
      "reasoning",
      "reasoning-2",
      second
    );

    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      kind: "reasoning",
      content: `${first}${second}`
    });
  });
});

/**
 * Creates one stable trace fixture.
 *
 * @param id - Trace identity.
 * @param kind - Trace family.
 * @param status - Trace lifecycle state.
 * @returns Complete trace entry.
 */
function trace(
  id: string,
  kind: AiChatExecutionTraceEntry["kind"],
  status: AiChatExecutionTraceEntry["status"]
): AiChatExecutionTraceEntry {
  return {
    id,
    runId: "run-1",
    kind,
    status,
    label: id,
    startedAt: "2026-08-11T00:00:00.000Z"
  };
}
