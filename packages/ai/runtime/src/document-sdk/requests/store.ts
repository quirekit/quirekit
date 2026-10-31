import type { QuireEditorTransactionEvent } from "@quirekit/core";
import { v4 as uuidv4 } from "uuid";
import type { QuireAiToolHost } from "../../tool-host";
import { createQuireAiDocumentRevision } from "../../tool-host";
import { QuireDocumentSdkError } from "../error";
import type { QuireDocumentSdkOptions } from "../types";
import type { DocumentRequestState } from "./types";

/**
 * Tracks request selections through canonical transactions without observing layout.
 * @param options - SDK editor and mounted tool factory.
 * @param host - Guarded command host supplied to every feature.
 * @returns Request store and its lifecycle cleanup.
 */
export function createDocumentRequestStore(options: QuireDocumentSdkOptions, host: QuireAiToolHost) {
  const requests = new Map<string, DocumentRequestState>();
  let closed = false;
  /**
   * Maps only live request ranges; selection-only transactions do no work.
   * @param event - Canonical transaction event.
   */
  function onTransaction(event: QuireEditorTransactionEvent): void {
    for (const transaction of [event.transaction, ...event.appendedTransactions]) {
      if (!transaction.docChanged) continue;
      for (const request of requests.values()) {
        if (request.selection === null) continue;
        // Each step uses its own pre-step coordinates. Mapping only the final
        // endpoints misses replacement exactly at both original boundaries.
        for (const map of transaction.mapping.maps) {
          if (request.selection === null) break;
          const { from, to }: { from: number; to: number } = request.selection;
          let changed = false;
          map.forEach((oldFrom, oldTo) => {
            if (from !== to && (oldFrom < to && oldTo > from
              || oldFrom === oldTo && oldFrom > from && oldFrom < to)) changed = true;
          });
          const start = map.mapResult(from, 1);
          const end = map.mapResult(to, from === to ? 1 : -1);
          request.selection = changed || (start.deletedAcross && end.deletedAcross) || start.pos > end.pos
            || (from !== to && start.pos === end.pos)
            ? null : Object.freeze({ from: start.pos, to: end.pos });
        }
      }
    }
  }
  options.editor.on("transaction", onTransaction);
  return {
    /** @returns A fresh request with its original selection and feature tools. */
    capture(): DocumentRequestState {
      if (closed || options.editor.isDestroyed) throw new QuireDocumentSdkError("disposed", "The document SDK is closed.");
      const tools = options.tools(host);
      const names = tools.map(tool => tool.name);
      if (new Set(names).size !== names.length) throw new QuireDocumentSdkError("duplicate-tool", "Mounted document tools have duplicate names.");
      const identity = Object.freeze({
        id: uuidv4(), documentId: options.documentId,
        documentRevision: createQuireAiDocumentRevision(options.editor.state.doc)
      });
      const { from, to } = options.editor.state.pm.selection;
      const state = { identity, tools, selection: Object.freeze({ from, to }) };
      requests.set(identity.id, state);
      return state;
    },
    /** @param id - Request identity. @returns Live request state. */
    get(id: string): DocumentRequestState {
      const state = requests.get(id);
      if (closed || state === undefined) throw new QuireDocumentSdkError("stale-request", "The document request has expired.");
      return state;
    },
    /** @param id - Request identity to release. */
    release(id: string): void { requests.delete(id); },
    /** Detaches the canonical transaction listener and drops all target references. */
    destroy(): void {
      closed = true;
      options.editor.off("transaction", onTransaction);
      requests.clear();
    }
  };
}
