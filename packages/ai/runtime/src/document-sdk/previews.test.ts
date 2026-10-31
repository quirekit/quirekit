import { afterEach, expect, it, vi } from "vitest";
import { createDocumentFixture, createReplaceTool } from "./fixture.test-support";
import { createQuireDocumentSdk } from "./sdk";
import type { QuireDocumentEvent, QuireDocumentSdkOptions } from "./types";

const editors: ReturnType<typeof createDocumentFixture>[] = [];
afterEach(() => { for (const editor of editors.splice(0)) editor.destroy(); });

/** Create a real document with an untrusted JavaScript review integration.
 * @param requestPreview - Host callback under test.
 * @returns SDK, document and observed review facts.
 */
function fixture(requestPreview: NonNullable<QuireDocumentSdkOptions["requestPreview"]>) {
  const editor = createDocumentFixture();
  editors.push(editor);
  editor.commands.setTextSelection({ from: 1, to: 6 });
  const sdk = createQuireDocumentSdk({ editor, documentId: "review-boundary", tools: host => [createReplaceTool(host)],
    authorizeWrite: () => ({ allowed: true, mode: "direct", preview: "required" }), requestPreview });
  const events: QuireDocumentEvent[] = [];
  sdk.subscribe(event => events.push(event));
  return { editor, sdk, events };
}

const invocation = { toolName: "replace", operationId: "review", input: { text: "Approved" } };

it.each([undefined, null, true, {}, "approve"])("rejects an invalid review callback result %j without applying a change", async value => {
  const callback = (async () => value) as unknown as NonNullable<QuireDocumentSdkOptions["requestPreview"]>;
  const { editor, sdk, events } = fixture(callback);
  await expect(sdk.invoke(invocation)).rejects.toMatchObject({ code: "invalid-preview-decision" });
  expect(editor.state.doc.textContent).toBe("Alpha Beta");
  expect(sdk.getOperation("review")).toMatchObject({ status: "failed", committed: false, receipts: [] });
  expect(events.filter(event => event.type === "preview-settled")).toEqual([
    expect.objectContaining({ decision: "cancelled" })
  ]);
});

it("reports a failed review integration without inventing a user rejection or exposing its exception", async () => {
  const { editor, sdk, events } = fixture(async () => { throw new Error("private host failure"); });
  await expect(sdk.invoke(invocation)).rejects.toMatchObject({ code: "preview-unavailable" });
  expect(editor.state.doc.textContent).toBe("Alpha Beta");
  expect(events).toContainEqual(expect.objectContaining({ type: "preview-settled", decision: "cancelled" }));
  expect(JSON.stringify(events)).not.toContain("private host failure");
});

it.each(["approved", "rejected"] as const)("retains an explicit %s decision and only commits approval", async decision => {
  const { editor, sdk, events } = fixture(async () => decision);
  await sdk.invoke(invocation);
  expect(editor.state.doc.textContent).toBe(decision === "approved" ? "Approved Beta" : "Alpha Beta");
  expect(sdk.getOperation("review")?.receipts).toHaveLength(decision === "approved" ? 1 : 0);
  expect(events).toContainEqual(expect.objectContaining({ type: "preview-settled", decision }));
});

it("does not open a host review after cancellation before its queued callback starts", async () => {
  const requestPreview = vi.fn(async () => "approved" as const);
  const { editor, sdk, events } = fixture(requestPreview);
  sdk.subscribe(event => { if (event.type === "preview") queueMicrotask(() => sdk.cancel(event.preview.operationId)); });
  await expect(sdk.invoke(invocation)).rejects.toMatchObject({ code: "cancelled" });
  expect(requestPreview).not.toHaveBeenCalled();
  expect(editor.state.doc.textContent).toBe("Alpha Beta");
  expect(events.filter(event => event.type === "preview-settled")).toHaveLength(1);
});
