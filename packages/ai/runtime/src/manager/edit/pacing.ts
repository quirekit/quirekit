/** Shortest gap in milliseconds between two streaming preview computations. */
const minimumInterval = 100;
/** Longest gap in milliseconds, so a slow document still shows progress. */
const maximumInterval = 1000;

/** Runs the latest of a stream of preview tasks at a pace the host can absorb. */
export interface QuireAiPreviewPacer {
  /**
   * Replaces the pending task; it runs now when the pace allows, otherwise once the gap has passed.
   * @param task - Latest preview computation.
   */
  request(task: () => void): void;
  /** Drops the pending task. */
  cancel(): void;
}

/**
 * Creates a pacer for one streaming preview.
 *
 * Model deltas arrive far faster than a large document can be laid out, and each
 * preview triggers a render. Only the latest delta matters, so intermediate ones
 * are dropped. The gap after a run is twice the time the main thread was taken:
 * the run itself plus how late its timer fired, which is roughly the render the
 * previous preview caused. At least half the main thread is thus left for
 * scrolling and input.
 *
 * @returns Pacer; the first request runs immediately.
 */
export function createQuireAiPreviewPacer(): QuireAiPreviewPacer {
  let pending: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dueAt: number | undefined;
  let readyAt = -Infinity;

  /** Runs the pending task and sets the gap before the next one. */
  function run(): void {
    timer = undefined;
    const task = pending;
    pending = null;
    if (task === null) return;
    const started = now();
    const lateness = dueAt === undefined ? 0 : Math.max(0, started - dueAt);
    dueAt = undefined;
    task();
    const finished = now();
    const interval = Math.min(maximumInterval, Math.max(minimumInterval, 2 * (finished - started + lateness)));
    readyAt = finished + interval;
  }

  return {
    request(task) {
      pending = task;
      if (timer !== undefined) return;
      const wait = readyAt - now();
      if (wait <= 0) return run();
      dueAt = readyAt;
      timer = setTimeout(run, wait);
    },
    cancel() {
      pending = null;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      dueAt = undefined;
    }
  };
}

/** @returns Monotonic time in milliseconds. */
function now(): number {
  return globalThis.performance?.now() ?? Date.now();
}
