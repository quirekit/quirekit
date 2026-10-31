import { createDocumentSdkShell } from "../document-sdk/shell";
import type { QuireDocumentSdk } from "../document-sdk/types";
import type { QuireDocumentTool } from "../document-tools";
import type { QuireAiToolWriteAuthorizationRequest } from "../tool-host";
import { describeQuireAiSourceRequest } from "./context";
import { composeQuireAiSourceInstructions } from "./instructions";
import { createQuireAiSourceEditTool } from "./edit/tool";
import { createQuireAiSourceHelpTool } from "./help-tool";
import { createQuireAiSourceReadTool } from "./read-tool";
import { describeQuireAiSourceReferences } from "./references";
import { createQuireAiSourceRequests } from "./requests";
import { createQuireAiSourcePreviews } from "./review/previews";
import { createQuireAiSourceRecorder, type QuireAiSourcePendingChanges } from "./review/record";
import type { QuireAiSourceDocument, QuireAiSourceWriteDecision } from "./types";
import { createQuireAiSourceIdentity } from "./view/identity";
import { createQuireAiSourceSnapshots } from "./view/snapshot";
import { createQuireAiSourceWriter } from "./writer";

/** Identity the AI writes as when the host names none. */
export const quireAiDefaultAgent = Object.freeze({ id: "quirekit-ai", name: "QuireKit AI" });

/** Options of a source document SDK. */
export interface QuireAiSourceDocumentSdkOptions {
  /** Stable application document identity; a new document needs a new SDK. */
  readonly documentId: string;
  /** Optional read policy applied before document data is exposed. */
  readonly authorizeRead?: ((toolName: string) => boolean) | undefined;
  /** Write policy, consulted at every write; default allowed without review. */
  readonly authorizeWrite?: ((request: QuireAiToolWriteAuthorizationRequest) => QuireAiSourceWriteDecision) | undefined;
  /** Identity the AI writes as; null writes anonymously. Default QuireKit AI. */
  readonly agent?: { readonly id: string; readonly name: string } | null | undefined;
  /** Host resources handed to commands that prepare, such as image storage. */
  readonly ports?: Readonly<Record<string, unknown>> | undefined;
}

/** AI changes awaiting review, for an editor to highlight. */
export interface QuireAiSourceReviews {
  /** @returns Changes of every request awaiting review, in current coordinates. */
  pending(): QuireAiSourcePendingChanges;
  /** @param listener - Called when they may have changed. @returns Unsubscribes. */
  subscribe(listener: () => void): () => void;
}

/** Document SDK of a source document, with its reviews. */
export interface QuireAiSourceDocumentSdk extends QuireDocumentSdk {
  /** Pending AI changes. */
  readonly reviews: QuireAiSourceReviews;
  /** @param requestId - Captured request. @returns Model-facing context of the request. */
  describeRequest(requestId: string): string | undefined;
  /** @returns System instructions for the installed facts and commands of the document. */
  instructions(): string;
}

/**
 * Creates the document SDK of a source document: the core read, edit and help tools on the
 * port, request context, review and reply presentation. The model-visible surface is designed
 * here; the editor only provides the port.
 * @param document - Source document port.
 * @param options - Identity and application policy.
 * @returns Document SDK.
 */
export function createQuireAiSourceDocumentSdk(document: QuireAiSourceDocument, options: QuireAiSourceDocumentSdkOptions): QuireAiSourceDocumentSdk {
  const identity = createQuireAiSourceIdentity(document);
  const snapshots = createQuireAiSourceSnapshots(document, identity);
  const recorder = createQuireAiSourceRecorder(document);
  const agent = options.agent === undefined ? quireAiDefaultAgent : options.agent;
  /** @param signal - Call cancellation. Throws when the call or the document is closed. */
  const assertOpen = (signal: AbortSignal) => {
    signal.throwIfAborted();
    if (!document.isOpen()) throw new Error("The document is closed.");
  };
  const contexts = new Map<string, string>();
  const sdk = createDocumentSdkShell({
    documentId: options.documentId,
    authorizeRead: options.authorizeRead,
    presentReply: (text, language) => describeQuireAiSourceReferences(text, snapshots.read(), identity, language)
  }, ({ emit, receipt }) => {
    const writer = createQuireAiSourceWriter({ document, recorder, authorizeWrite: options.authorizeWrite, agent, receipt });
    const tools = (): readonly QuireDocumentTool[] => [
      createQuireAiSourceReadTool(snapshots, assertOpen),
      createQuireAiSourceEditTool({ document, snapshots, writer, author: agent, ports: options.ports ?? {} }),
      createQuireAiSourceHelpTool(document, options.ports ?? {})
    ];
    return {
      isOpen: () => document.isOpen(),
      isEditable: () => document.isEditable(),
      writeKey: document,
      requests: createQuireAiSourceRequests(document, options.documentId, tools),
      previews: createQuireAiSourcePreviews(document, options.documentId, recorder, emit),
      onDestroy: listener => document.onDestroy(listener),
      destroy() {
        contexts.clear();
        recorder.destroy();
        identity.destroy();
      }
    };
  });
  return Object.freeze({
    ...sdk,
    captureRequest() {
      const request = sdk.captureRequest();
      contexts.set(request.id, describeQuireAiSourceRequest(snapshots.read(), document.selection()));
      return request;
    },
    releaseRequest(requestId: string) {
      contexts.delete(requestId);
      sdk.releaseRequest(requestId);
    },
    describeRequest: (requestId: string) => contexts.get(requestId),
    instructions: () => {
      const commands = document.commands();
      const facts = document.capabilities();
      return composeQuireAiSourceInstructions({
        comments: facts.some(fact => fact.kind === "annotation") && [...commands.values()].some(item => item.target === "annotation"),
        figures: facts.some(fact => fact.kind === "source-block" && (fact.authoring?.length ?? 0) > 0) || [...commands.values()].some(item => item.category === "figures")
      });
    },
    reviews: {
      pending: () => recorder.pending(),
      subscribe: (listener: () => void) => recorder.subscribe(listener)
    }
  });
}
