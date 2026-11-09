import type { HtmlDocumentDesc } from "../../descriptors";

/** Canonical recovery facts for one mounted DOM node. */
export interface HtmlOwnedNodeSnapshot {
  /** Canonical text-node value. */
  readonly nodeValue: string | null;
  /** Canonical element attributes. */
  readonly attributes: ReadonlyMap<string, string>;
  /** Exact direct child identities and order. */
  readonly children: readonly Node[];
}

/** Ownership evidence from a completed synchronous retained write phase. */
export interface HtmlOwnedWriteUpdate {
  /** Whether descriptor identity, order or custom-view ownership may have changed. */
  readonly ownershipChanged: boolean;
}

/** Minimal observer surface used by the retained mutation boundary. */
export interface HtmlMutationObserver {
  /** Starts observing the retained content surface. */
  observe(target: Node, options: MutationObserverInit): void;
  /** Stops observation. */
  disconnect(): void;
  /** Returns queued records without invoking the observer callback. */
  takeRecords(): MutationRecord[];
}

/** Options used to create one retained DOM mutation boundary. */
export interface CreateHtmlMutationBoundaryOptions {
  /** Surface whose exact child is the immortal retained root. */
  readonly contentSurface: HTMLElement;
  /** Retained descriptor root that remains document authority. */
  readonly root: HtmlDocumentDesc;
  /** Maximum repeated recoveries allowed for one owner between refreshes. */
  readonly maxRecoveriesPerOwner?: number | undefined;
  /** Optional observer factory for non-browser acceptance fixtures. */
  readonly observerFactory?:
    | ((callback: MutationCallback) => HtmlMutationObserver)
    | undefined;
}

/** Named mutation-observation counters for HTML diagnostics. */
export interface HtmlMutationDiagnostics {
  /** Observer records drained after authorized retained writes. */
  readonly ownedRecordsDrained: number;
  /** Unauthorized owner scopes restored from retained authority. */
  readonly recoveries: number;
  /** NodeView or MarkView records explicitly ignored by their owner. */
  readonly ignoredNodeViewRecords: number;
  /** Internal DOM updates owned by keyed widgets. */
  readonly ignoredWidgetRecords: number;
  /** Recovery records drained before they could recursively re-enter. */
  readonly recoveryRecordsDrained: number;
  /** Repeated owner recoveries rejected by the configured bound. */
  readonly recoveryLimitHits: number;
  /** Times the immortal root was no longer the exact mounted child. */
  readonly rootReplacements: number;
}

/** Internal mutation boundary lifecycle. */
export interface HtmlMutationBoundary {
  /** Classifies pending external records before synchronous authorized writes. */
  beginOwnedWrites(): void;
  /**
   * Publishes recovery facts for completed authorized writes.
   * @param update - Exact ownership evidence. Omit to request full authority capture.
   */
  drainOwnedWrites(update?: HtmlOwnedWriteUpdate): void;
  /**
   * Processes observer records against retained ownership.
   *
   * @param records - Browser mutation records to classify.
   */
  process(records: readonly MutationRecord[]): void;
  /**
   * Reads a stable mutation diagnostic snapshot.
   *
   * @returns Current counters.
   */
  getDiagnostics(): HtmlMutationDiagnostics;
  /** Disconnects observation and releases retained snapshots. */
  destroy(): void;
}

/** Mutable diagnostic bag owned by one boundary. */
export type MutableHtmlMutationDiagnostics = {
  -readonly [Key in keyof HtmlMutationDiagnostics]: HtmlMutationDiagnostics[Key];
};
