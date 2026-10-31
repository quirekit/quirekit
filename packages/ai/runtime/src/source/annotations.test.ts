import { describe, expect, it } from "vitest";
import type { QuireAiAnnotation } from "@quirekit/ai-contract";
import type { QuireDocumentEvent, QuireDocumentPreview } from "../document-sdk/types";
import { createFakeSourceDocument } from "./fixture.test-support";
import { createQuireAiSourceDocumentSdk } from "./sdk";

describe("source annotations", () => {
  it("lists comment threads and runs comment commands as the AI, taking them back on rejection", async () => {
    const text = "第一段写着数字 42。\n\n第二段。";
    let threads: QuireAiAnnotation[] = [{
      id: "t1", range: { from: 7, to: 9 }, quote: "42", status: "open",
      messages: [{ author: "张三", agent: false, createdAt: "2026-10-15T00:00:00Z", body: "这个数字对吗？" }]
    }];
    const replies: { thread: string; author: string; body: string }[] = [];
    const document = createFakeSourceDocument(text, {
      capabilities: () => [{ kind: "annotation", label: "批注", read: () => threads }],
      commands: {
        replyComment: {
          descriptor: {
            description: "Replies to a comment thread.", target: "annotation", category: "comments",
            params: { type: "object", properties: { body: { type: "string", minLength: 1 } }, required: ["body"], additionalProperties: false },
            adapt: (params, context) => ({ thread: context.annotation, author: context.author?.name, body: (params as { body: string }).body })
          },
          run: () => [],
          effect: params => { replies.push(params as never); return { inverse: threads, described: [] }; }
        }
      },
      applyState: inverse => { threads = inverse as QuireAiAnnotation[]; }
    });
    const sdk = createQuireAiSourceDocumentSdk(document, { documentId: "doc", authorizeWrite: () => ({ allowed: true, review: true }) });
    const request = sdk.captureRequest();
    expect(sdk.describeRequest(request.id)).toContain("[b1] 第一段写着数字 42。  ⟨批注 c1⟩\n[b2] 第二段。\n## 批注\n[c1] 于 b1“42”，未解决\n  张三：这个数字对吗？");
    const result = await sdk.invoke({ toolName: "document_edit", operationId: "op", requestId: request.id,
      input: { operations: [{ op: "replyComment", annotation: "c1", params: { body: "已核对，正确。" } }] } });
    expect(result.summary).toContain("Applied 1 operation(s).");
    expect(replies).toEqual([{ thread: "t1", author: "QuireKit AI", body: "已核对，正确。" }]);
    expect(sdk.presentReply("已回复 c1。", "zh")).toBe("已回复 批注“42”。");
  });

  it("rejects an unknown comment id", async () => {
    const document = createFakeSourceDocument("段落。", {
      commands: { resolveComment: { descriptor: { description: "Resolves a thread.", target: "annotation" }, run: () => [] } }
    });
    const sdk = createQuireAiSourceDocumentSdk(document, { documentId: "doc" });
    const request = sdk.captureRequest();
    const result = await sdk.invoke({ toolName: "document_edit", operationId: "op", requestId: request.id, input: { operations: [{ op: "resolveComment", annotation: "c9" }] } });
    expect(result.summary).toContain("comment c9 does not exist");
  });

  it("puts described non-text changes in the request review and takes them back", async () => {
    let replies: string[] = [];
    const document = createFakeSourceDocument("段落。", {
      capabilities: () => [{ kind: "annotation", label: "批注", read: () => [{ id: "t1", range: { from: 0, to: 2 }, quote: "段落", status: "open", messages: [] }] }],
      commands: {
        replyComment: {
          descriptor: { description: "Replies.", target: "annotation", params: { type: "object", properties: { body: { type: "string" } }, required: ["body"] } },
          run: () => [],
          effect: params => {
            const before = replies;
            replies = [...replies, (params as { body: string }).body];
            return { inverse: before, described: [{ kind: "inserted", section: "批注", excerpt: (params as { body: string }).body }] };
          }
        }
      },
      applyState: inverse => { replies = inverse as string[]; }
    });
    const sdk = createQuireAiSourceDocumentSdk(document, { documentId: "doc", authorizeWrite: () => ({ allowed: true, review: true }) });
    const events: QuireDocumentEvent[] = [];
    sdk.subscribe(event => events.push(event));
    const request = sdk.captureRequest();
    await sdk.invoke({ toolName: "document_edit", operationId: "op", requestId: request.id, input: { operations: [{ op: "replyComment", annotation: "c1", params: { body: "好的" } }] } });
    expect(replies).toEqual(["好的"]);
    expect(sdk.reviewRequest(request.id)).toBe(true);
    const preview = events.find((event): event is { type: "preview"; preview: QuireDocumentPreview } => event.type === "preview")!.preview;
    expect(preview.changes).toEqual([{ kind: "inserted", section: "批注", excerpt: "好的", formats: [] }]);
    sdk.decidePreview(preview.id, "rejected");
    expect(replies).toEqual([]);
  });
});
