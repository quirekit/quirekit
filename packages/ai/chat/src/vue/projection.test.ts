import { expect, it, vi } from "vitest";
import { createAiChatController } from "../session/controller";
import { createChatFixture } from "../session/fixture.test-support";
import { projectChatMessages } from "./projection";

it("retains each historical failure category without exposing arbitrary exception bodies", async () => {
  const fixture = createChatFixture({ respond: vi.fn()
    .mockRejectedValueOnce({ code: "timeout", message: "private provider response" })
    .mockRejectedValueOnce({ code: "unexpected-private-code", message: "private provider response" }) });
  const controller = createAiChatController(fixture.options);
  controller.setDraft("First");
  await controller.submit();
  controller.setDraft("Second");
  await controller.submit();
  const messages = projectChatMessages(controller.getSnapshot(), "zh-CN");
  expect(messages[1]?.statusText).toContain("模型响应超时");
  expect(messages[3]?.statusText).toContain("本轮未完成");
  expect(JSON.stringify(messages)).not.toContain("private");
});

it("keeps a successful document receipt visible when the model later fails", async () => {
  const fixture = createChatFixture();
  fixture.options.responder.respond = async () => {
    fixture.emit({ type: "operation", operation: {
      id: "committed-operation", documentId: "fixture", toolName: "edit", status: "completed", committed: true, receipts: []
    } });
    throw { code: "provider-failed" };
  };
  const controller = createAiChatController(fixture.options);
  controller.setDraft("Change document");
  await controller.submit();
  const assistant = projectChatMessages(controller.getSnapshot(), "zh-CN")[1]!;
  expect(assistant.state).toBe("error");
  const operation = assistant.parts?.find(part => part.kind === "tool");
  expect(operation).toMatchObject({ kind: "tool", state: "succeeded", stateLabel: "已修改文档" });
  expect(operation?.kind === "tool" && JSON.parse(operation.output!)).toMatchObject({ document: { committed: true } });
  expect(assistant.parts?.some(part => part.kind === "notice")).toBe(false);
});

it("projects semantic document actions while hiding scheduling and chunk diagnostics", async () => {
  const fixture = createChatFixture({ respond: async request => {
    const shared = { runId: request.id, status: "running" as const, startedAt: new Date().toISOString() };
    request.onTrace({ ...shared, id: "agent", kind: "agent", label: "Document Agent" });
    request.onTrace({ ...shared, id: "model", kind: "model", label: "Model turn 1" });
    request.onReasoningDelta("I will check the selected text.");
    request.onTrace({ ...shared, id: "read", kind: "tool-call", toolName: "document_read", label: "document_read", detail: "96 argument characters · 1 chunks", arguments: { target: "selection" } });
    request.onTrace({ ...shared, id: "write", kind: "tool-result", toolName: "document_edit", label: "document_edit result", result: { applied: true } });
    request.onTrace({ ...shared, id: "unknown", kind: "tool-call", toolName: "custom_internal_name", label: "custom_internal_name" });
    return { content: "Done." };
  } });
  const controller = createAiChatController(fixture.options);
  controller.setDraft("Read and edit");
  await controller.submit();
  const snapshot = controller.getSnapshot();
  const chinese = projectChatMessages(snapshot, "zh-CN")[1]!;
  const english = projectChatMessages(snapshot, "en")[1]!;
  expect(chinese.parts?.filter(part => part.kind === "tool").map(part => part.title)).toEqual(["读取文档", "修改文档", "文档操作"]);
  expect(english.parts?.filter(part => part.kind === "tool").map(part => part.title)).toEqual(["Read document", "Edit document", "Document operation"]);
  expect(chinese.parts).toContainEqual(expect.objectContaining({ kind: "reasoning", text: "I will check the selected text." }));
  expect(chinese.parts).toContainEqual(expect.objectContaining({ kind: "text", text: "Done." }));
  expect(chinese.parts).toContainEqual(expect.objectContaining({ kind: "tool", input: JSON.stringify({ target: "selection" }, null, 2) }));
  expect(chinese.parts).toContainEqual(expect.objectContaining({ kind: "tool", output: JSON.stringify({ applied: true }, null, 2) }));
  const presentation = JSON.stringify(chinese);
  expect(presentation).not.toMatch(/Document Agent|Model turn|argument characters|chunks|custom_internal_name|document_read/u);
});

it("keeps read, failure and cancellation outcomes on their operation rows without notices", async () => {
  const fixture = createChatFixture();
  fixture.options.responder.respond = async () => {
    for (const status of ["completed", "failed", "cancelled"] as const) {
      fixture.emit({ type: "operation", operation: {
        id: status, documentId: "fixture", toolName: "document_read", status, committed: false, receipts: []
      } });
    }
    return { content: "Read complete." };
  };
  const controller = createAiChatController(fixture.options);
  controller.setDraft("Read document");
  await controller.submit();
  const parts = projectChatMessages(controller.getSnapshot(), "zh-CN")[1]?.parts ?? [];
  expect(parts.filter(part => part.kind === "tool").map(part => part.state)).toEqual(["succeeded", "failed", "cancelled"]);
  expect(parts.some(part => part.kind === "notice")).toBe(false);
  expect(parts.at(-1)).toMatchObject({ kind: "text", text: "Read complete." });
});

it("retains operation and review positions while later text streams and receipts settle", async () => {
  const fixture = createChatFixture();
  const snapshots: ReturnType<typeof projectChatMessages>[] = [];
  fixture.options.responder.respond = async request => {
    const trace = { id: "call", runId: request.id, kind: "tool-call" as const, operationId: "write", toolName: "document_edit", label: "edit", startedAt: new Date().toISOString() };
    const operation = { id: "write", documentId: "fixture", toolName: "document_edit", committed: false, receipts: [] };
    request.onContentDelta("Before the edit.");
    request.onTrace({ ...trace, status: "running", arguments: { content: "new" } });
    fixture.emit({ type: "operation", operation: { ...operation, status: "running" } });
    fixture.emit({ type: "preview", preview: { id: "review", operationId: "write", documentId: "fixture", capabilityId: "edit", sourceDocumentRevision: "r", sourceDocument: {}, candidateDocument: {}, sourceText: "old", candidateText: "new", formatOnly: false, target: { id: "selection", kind: "selection" } } });
    snapshots.push(projectChatMessages(controller.getSnapshot(), "zh-CN"));
    request.onContentDelta("After the review.");
    fixture.emit({ type: "preview-settled", previewId: "review", decision: "approved" });
    fixture.emit({ type: "operation", operation: { ...operation, status: "completed", committed: true } });
    request.onTrace({ ...trace, status: "succeeded", result: { applied: true } });
    snapshots.push(projectChatMessages(controller.getSnapshot(), "zh-CN"));
    request.onContentDelta(" Continuing below it.");
    return { content: "After the review. Continuing below it." };
  };
  const controller = createAiChatController(fixture.options);
  controller.setDraft("Edit then explain");
  await controller.submit();
  const before = snapshots[0]![1]!.parts!;
  const during = snapshots[1]![1]!.parts!;
  const after = projectChatMessages(controller.getSnapshot(), "zh-CN")[1]!.parts!;
  expect(before.map(part => part.kind)).toEqual(["text", "tool", "custom"]);
  expect(during.map(part => part.kind)).toEqual(["text", "tool", "custom", "text"]);
  expect(after.map(part => part.id)).toEqual(during.map(part => part.id));
  expect(after.slice(0, 3).map(part => part.id)).toEqual(before.map(part => part.id));
  expect(after[1]).toMatchObject({ input: JSON.stringify({ content: "new" }, null, 2), state: "succeeded" });
  expect(after[2]).toMatchObject({ data: { state: "approved" } });
  expect(after.at(-1)).toMatchObject({ text: "After the review. Continuing below it." });
});

it("keeps repeated calls distinct and retains SDK commits when the tool adapter later fails", async () => {
  const fixture = createChatFixture();
  fixture.options.responder.respond = async request => {
    for (const id of ["first", "second"]) {
      fixture.emit({ type: "operation", operation: { id, documentId: "fixture", toolName: "document_edit", status: "running", committed: false, receipts: [] } });
      const trace = { id, operationId: id, runId: request.id, kind: "tool-call" as const, toolName: "document_edit", label: "edit", status: "running" as const, startedAt: new Date().toISOString(), arguments: { content: id } };
      request.onTrace(trace);
      request.onContentDelta(`${id} explanation.`);
      fixture.emit({ type: "operation", operation: { id, documentId: "fixture", toolName: "document_edit", status: "completed", committed: true, receipts: [] } });
      if (id === "second") request.onTrace({ ...trace, status: "failed" });
    }
    return { content: "second explanation." };
  };
  const controller = createAiChatController(fixture.options);
  controller.setDraft("Two edits");
  await controller.submit();
  const parts = projectChatMessages(controller.getSnapshot(), "en")[1]!.parts!;
  expect(parts.map(part => part.kind)).toEqual(["tool", "text", "tool", "text"]);
  expect(parts[0]).toMatchObject({ state: "succeeded", input: JSON.stringify({ content: "first" }, null, 2) });
  expect(parts[2]).toMatchObject({ state: "failed", input: JSON.stringify({ content: "second" }, null, 2) });
  expect(parts[2]?.kind === "tool" && JSON.parse(parts[2].output!)).toMatchObject({ document: { committed: true, status: "completed" } });
});

it("shows how many blocks a transform has finished while it runs", async () => {
  const fixture = createChatFixture();
  let during: ReturnType<typeof projectChatMessages> | undefined;
  fixture.options.responder.respond = async request => {
    const trace = { id: "transform", runId: request.id, kind: "tool-call" as const, operationId: "transform", toolName: "document_transform", label: "transform", startedAt: new Date().toISOString() };
    request.onTrace({ ...trace, status: "running", arguments: { instruction: "translate" } });
    fixture.emit({ type: "operation", operation: { id: "transform", documentId: "fixture", toolName: "document_transform", committed: false, receipts: [], status: "running" } });
    fixture.emit({ type: "progress", operationId: "transform", progress: { summary: "Transformed 3 of 12 blocks.", done: 3, total: 12 } });
    during = projectChatMessages(controller.getSnapshot(), "zh-CN");
    return { content: "done" };
  };
  const controller = createAiChatController(fixture.options);
  controller.setDraft("Translate everything");
  await controller.submit();
  expect(during![1]!.parts!.find(part => part.kind === "tool")).toMatchObject({ title: "逐段处理文档", stateLabel: "已处理 3/12" });
});
