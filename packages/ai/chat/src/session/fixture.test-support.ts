import type { QuireDocumentEvent, QuireDocumentSdk } from "@quirekit/ai-runtime";
import { vi } from "vitest";
import type { AiChatResponder, AiChatWorkspaceOptions } from "../types";

/** @param responder - Optional asynchronous harness fixture. @returns Isolated document and product ports. */
export function createChatFixture(responder?: Partial<AiChatResponder>) {
  const listeners = new Set<(event: QuireDocumentEvent) => void>();
  const document: QuireDocumentSdk = {
    documentId: "fixture", tools: () => [],
    captureRequest: vi.fn(() => ({ id: "target", documentId: "fixture", documentRevision: "revision" })),
    releaseRequest: vi.fn(), invoke: vi.fn(), observeInput: vi.fn(), checkInput: () => undefined, getOperation: () => undefined,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    decidePreview: vi.fn(() => true), reviewRequest: vi.fn(() => false), presentReply: vi.fn((text: string) => text), cancel: vi.fn(() => true), destroy: vi.fn()
  };
  const options: AiChatWorkspaceOptions = {
    document, primaryModel: { id: "first", label: "First", provider: "Fixture", capabilities: { vision: false } },
    availableModels: [{ id: "second", label: "Second", provider: "Fixture", capabilities: { vision: false } }],
    responder: { respond: vi.fn(async () => ({ content: "done" })), reset: vi.fn(), destroy: vi.fn(), ...responder }
  };
  return { options, document, emit: (event: QuireDocumentEvent) => { for (const listener of listeners) listener(event); } };
}
