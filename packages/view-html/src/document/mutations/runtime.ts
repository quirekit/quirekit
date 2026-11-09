import type { HtmlDescriptor } from "../../descriptors";
import { findHtmlMutationOwner, indexHtmlMutationOwners, routeHtmlOwnedMutation } from "./ownership";
import {
  captureHtmlOwnedChanges,
  captureHtmlOwnedSubtree,
  restoreHtmlOwnedNode
} from "./snapshot";
import type {
  CreateHtmlMutationBoundaryOptions,
  HtmlMutationBoundary,
  HtmlMutationObserver,
  HtmlOwnedNodeSnapshot,
  MutableHtmlMutationDiagnostics
} from "./types";

/**
 * Creates a bounded observer boundary around one retained document root.
 *
 * @param options - Surface, descriptor root, and observer inputs.
 * @returns Mutation classifier and recovery lifecycle.
 */
export function createHtmlMutationBoundary(
  options: CreateHtmlMutationBoundaryOptions
): HtmlMutationBoundary {
  const maxRecoveries = options.maxRecoveriesPerOwner ?? 2;
  const diagnostics: MutableHtmlMutationDiagnostics = {
    ownedRecordsDrained: 0,
    recoveries: 0,
    ignoredNodeViewRecords: 0,
    ignoredWidgetRecords: 0,
    recoveryRecordsDrained: 0,
    recoveryLimitHits: 0,
    rootReplacements: 0
  };
  let owners = new WeakMap<Node, HtmlDescriptor>();
  let snapshots = new WeakMap<Node, HtmlOwnedNodeSnapshot>();
  const recoveryCounts = new Map<string, number>();
  let destroyed = false;

  /** Refreshes the complete authority when exact write evidence is unavailable. */
  const rebuildAuthority = (): void => {
    owners = indexHtmlMutationOwners(options.root);
    snapshots = new WeakMap();
    captureHtmlOwnedSubtree(options.contentSurface, snapshots);
    recoveryCounts.clear();
  };
  /** @param records - External mutations observed outside the retained write phase. */
  const process = (records: readonly MutationRecord[]): void => {
    if (destroyed || records.length === 0) {
      return;
    }
    for (const record of records) {
      const rootDOM = options.root.mount?.dom;
      if (rootDOM && rootDOM.parentNode !== options.contentSurface) {
        diagnostics.rootReplacements += 1;
        restoreHtmlOwnedNode(options.contentSurface, snapshots);
      }
      const owner = findHtmlMutationOwner(record.target, owners);
      if (owner && routeHtmlOwnedMutation(owner, record)) {
        if (owner.kind === "widget") diagnostics.ignoredWidgetRecords += 1;
        else diagnostics.ignoredNodeViewRecords += 1;
        captureHtmlOwnedSubtree(record.target, snapshots);
        continue;
      }
      const ownerKey = owner?.id ?? "content-surface";
      const attempts = recoveryCounts.get(ownerKey) ?? 0;
      if (attempts >= maxRecoveries) {
        diagnostics.recoveryLimitHits += 1;
        continue;
      }
      recoveryCounts.set(ownerKey, attempts + 1);
      restoreHtmlOwnedNode(record.target, snapshots);
      diagnostics.recoveries += 1;
    }
    diagnostics.recoveryRecordsDrained += observer?.takeRecords().length ?? 0;
  };
  const observer = createObserver(options, process);

  rebuildAuthority();
  observer?.observe(options.contentSurface, {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true
  });

  return {
    /** Classifies queued external records while the previous authority is current. */
    beginOwnedWrites: () => process(observer?.takeRecords() ?? []),
    /** @param update - Ownership evidence from the completed synchronous write phase. */
    drainOwnedWrites: update => {
      if (destroyed) {
        return;
      }
      const records = observer?.takeRecords() ?? [];
      diagnostics.ownedRecordsDrained += records.length;
      if (!observer || !update) {
        rebuildAuthority();
        return;
      }
      if (update.ownershipChanged || records.some(record => record.type === "childList")) {
        owners = indexHtmlMutationOwners(options.root);
      }
      captureHtmlOwnedChanges(records, snapshots);
      recoveryCounts.clear();
    },
    process,
    /** @returns Detached cumulative observer and recovery counters. */
    getDiagnostics: () => ({ ...diagnostics }),
    /** Disconnects observation and releases the document's recovery authority. */
    destroy: () => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      observer?.disconnect();
      owners = new WeakMap();
      snapshots = new WeakMap();
      recoveryCounts.clear();
    }
  };
}

/**
 * Creates a native or injected observer when the environment supports one.
 * @param options - Surface and optional observer factory.
 * @param process - External-mutation classifier.
 * @returns Observer, or undefined for environments using full capture.
 */
function createObserver(
  options: CreateHtmlMutationBoundaryOptions,
  process: (records: readonly MutationRecord[]) => void
): HtmlMutationObserver | undefined {
  if (options.observerFactory) {
    return options.observerFactory(process);
  }
  const Observer = options.contentSurface.ownerDocument.defaultView?.MutationObserver ??
    globalThis.MutationObserver;
  return typeof Observer === "function"
    ? new Observer(process)
    : undefined;
}
