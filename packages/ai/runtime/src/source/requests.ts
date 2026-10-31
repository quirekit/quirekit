import { v4 as uuidv4 } from "uuid";
import { QuireDocumentSdkError } from "../document-sdk/error";
import type { QuireDocumentSdkEngineRequests } from "../document-sdk/shell";
import type { DocumentRequestState } from "../document-sdk/requests/types";
import type { QuireDocumentTool } from "../document-tools";
import { mapQuireAiSourcePos } from "./changes/map";
import type { QuireAiSourceDocument } from "./types";

/**
 * Tracks request selections through text changes; a selection whose text changed is dropped.
 * @param document - Source document port.
 * @param documentId - Application document identity.
 * @param tools - Creates the tools of a request.
 * @returns Request store of the SDK engine.
 */
export function createQuireAiSourceRequests(document: QuireAiSourceDocument, documentId: string,
  tools: () => readonly QuireDocumentTool[]): QuireDocumentSdkEngineRequests {
  const requests = new Map<string, DocumentRequestState>();
  let closed = false;
  const unsubscribe = document.subscribe(({ changes }) => {
    if (changes.length === 0) return;
    for (const request of requests.values()) {
      const selection = request.selection;
      if (selection === null) continue;
      const { from, to } = selection;
      const touched = from !== to && changes.some(change => change.from < to && change.to > from || (change.from === change.to && change.from > from && change.from < to));
      const start = mapQuireAiSourcePos(changes, from, 1);
      const end = mapQuireAiSourcePos(changes, to, from === to ? 1 : -1);
      request.selection = touched || start > end ? null : Object.freeze({ from: start, to: end });
    }
  });
  return {
    capture() {
      if (closed || !document.isOpen()) throw new QuireDocumentSdkError("disposed", "The document SDK is closed.");
      const identity = Object.freeze({ id: uuidv4(), documentId, documentRevision: document.revision() });
      const { from, to } = document.selection();
      const state: DocumentRequestState = { identity, tools: tools(), selection: Object.freeze({ from, to }) };
      requests.set(identity.id, state);
      return state;
    },
    get(id) {
      const state = requests.get(id);
      if (closed || state === undefined) throw new QuireDocumentSdkError("stale-request", "The document request has expired.");
      return state;
    },
    release(id) { requests.delete(id); },
    destroy() {
      closed = true;
      unsubscribe();
      requests.clear();
    }
  };
}
