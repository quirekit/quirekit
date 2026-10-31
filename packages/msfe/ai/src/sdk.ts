import { createQuireAiSourceDocumentSdk, type QuireAiSourceDocumentSdk, type QuireAiSourceDocumentSdkOptions } from "@quirekit/ai-runtime/source";
import type { MsfeEditor } from "@quirekit/msfe-core";
import { createMsfeAiDocument } from "./document";
import { attachMsfeAiReview } from "./review/attach";

/**
 * Creates the AI document SDK of an MSFE editor and highlights AI changes awaiting review in it.
 * @param editor - Mounted editor with the MsfeAi extension installed.
 * @param options - Document identity and application policy.
 * @returns Document SDK; destroying it removes the highlights.
 */
export function createMsfeDocumentSdk(editor: MsfeEditor, options: QuireAiSourceDocumentSdkOptions): QuireAiSourceDocumentSdk {
  const sdk = createQuireAiSourceDocumentSdk(createMsfeAiDocument(editor), options);
  const detach = attachMsfeAiReview(editor, sdk.reviews);
  return Object.freeze({
    ...sdk,
    destroy() {
      detach();
      sdk.destroy();
    }
  });
}
