import { createQuireAiToolHost } from "../tool-host";
import { createDocumentPreviews } from "./previews";
import { createDocumentReverts } from "./reverts";
import { createDocumentRequestStore } from "./requests/store";
import { createDocumentSdkShell } from "./shell";
import type { QuireDocumentSdk, QuireDocumentSdkOptions } from "./types";

/**
 * Binds engine-neutral document capabilities to one canonical ProseMirror editor lifecycle.
 * @param options - Document identity, installed features, and application policy.
 * @returns The same document API for direct workflows and arbitrary Agent runtimes.
 */
export function createQuireDocumentSdk(options: QuireDocumentSdkOptions): QuireDocumentSdk {
  return createDocumentSdkShell(options, ({ emit, receipt }) => {
    const { editor } = options;
    const reverts = createDocumentReverts(editor);
    const previews = createDocumentPreviews(options, emit, reverts);
    const host = createQuireAiToolHost({ ...options, requestPreview: previews.request, onReceipt: receipt, onDirectFallback: reverts.record });
    return {
      isOpen: () => !editor.isDestroyed,
      isEditable: () => editor.isEditable,
      writeKey: editor,
      requests: createDocumentRequestStore(options, host),
      previews,
      onDestroy(listener) {
        editor.on("destroy", listener);
        return () => { editor.off("destroy", listener); };
      },
      destroy: () => reverts.destroy()
    };
  });
}
