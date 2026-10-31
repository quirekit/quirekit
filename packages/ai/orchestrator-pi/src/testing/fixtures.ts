import { createModels, fauxProvider, type FauxResponseStep } from "@earendil-works/pi-ai";
import type { QuireDocumentInvocation, QuireDocumentInvocationOptions, QuireDocumentSdk, QuireDocumentToolResult } from "@quirekit/ai-runtime";
import { Type } from "typebox";
import { vi } from "vitest";
import type { QuireAiPiModelRuntime, QuireAiPiRunRequest } from "../types";
import type { TestDocumentFixture } from "./types";

/**
 * Creates an official Pi faux provider with observable real native calls.
 * @param responses - Ordered provider responses.
 * @param id - Isolated provider identity.
 * @returns Native runtime plus provider test handle.
 */
export function createTestRuntime(responses: FauxResponseStep[], id = "quirekit-test") {
  const faux = fauxProvider({ provider: id, tokensPerSecond: 1_000_000, models: [{ id: `${id}-model`, reasoning: true }] });
  faux.setResponses(responses);
  const models = createModels();
  models.setProvider(faux.provider);
  const runtime: QuireAiPiModelRuntime = { models, model: faux.getModel(), streamFn: models.streamSimple.bind(models), thinkingLevel: "high" };
  return { runtime, faux };
}

/**
 * Creates a document protocol spy; feature implementation is deliberately absent.
 * @param execute - Optional SDK invocation behavior.
 * @returns SDK and observable public protocol methods.
 */
export function createTestDocument(execute: (request: QuireDocumentInvocation, options?: QuireDocumentInvocationOptions) => Promise<QuireDocumentToolResult> = async () => ({ value: { applied: true }, summary: "Applied." })): TestDocumentFixture {
  let sequence = 0;
  const invoke = vi.fn<QuireDocumentSdk["invoke"]>(execute);
  const releaseRequest = vi.fn<QuireDocumentSdk["releaseRequest"]>();
  const observeInput = vi.fn<QuireDocumentSdk["observeInput"]>();
  const captureRequest = vi.fn<QuireDocumentSdk["captureRequest"]>(() => ({ id: `request-${++sequence}`, documentId: "document", documentRevision: "revision" }));
  const document: QuireDocumentSdk = {
    documentId: "document",
    tools: () => [{ name: "document_edit", label: "Edit", description: "Edit the document.", effect: "write", parameters: Type.Object({ value: Type.String() }, { additionalProperties: false }) }],
    captureRequest, releaseRequest, invoke, observeInput, checkInput: () => undefined,
    getOperation: () => undefined,
    subscribe: () => () => undefined,
    decidePreview: () => false,
    reviewRequest: () => false,
    presentReply: text => text,
    cancel: () => false,
    destroy: () => undefined
  };
  return { document, invoke, releaseRequest, captureRequest, observeInput };
}

/**
 * Creates one native coordinator input without reconstructing model history.
 * @param document - Public document authority.
 * @param overrides - Focused request fields.
 * @returns Complete run input.
 */
export function createRunRequest(document: QuireDocumentSdk, overrides: Partial<QuireAiPiRunRequest> & Pick<QuireAiPiRunRequest, "id">): QuireAiPiRunRequest {
  return { document, prompt: "Change the document.", signal: new AbortController().signal, ...overrides };
}
