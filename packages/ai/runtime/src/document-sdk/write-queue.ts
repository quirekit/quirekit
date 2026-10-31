const tails = new WeakMap<object, Promise<unknown>>();

/**
 * Serializes SDK writes across all clients of the same editor.
 * @param editor - Write identity of the canonical document owner.
 * @param signal - Cancellation authority checked before dispatch.
 * @param execute - Complete feature invocation, including review and final commit.
 * @returns The feature result after earlier writes have settled.
 */
export function enqueueDocumentWrite<Value>(editor: object, signal: AbortSignal, execute: () => Promise<Value>): Promise<Value> {
  const previous = tails.get(editor) ?? Promise.resolve();
  let started = false;
  let rejectWaiting: ((reason: unknown) => void) | undefined;
  /** Rejects only queued work; started work must drain cooperatively. */
  function abortWaiting(): void { if (!started) rejectWaiting?.(signal.reason); }
  const queued = previous.catch(() => undefined).then(async () => {
    started = true;
    signal.throwIfAborted();
    return execute();
  });
  const settled = queued.catch(() => undefined);
  tails.set(editor, settled);
  void settled.then(() => { if (tails.get(editor) === settled) tails.delete(editor); });
  return new Promise<Value>((resolve, reject) => {
    rejectWaiting = reject;
    signal.addEventListener("abort", abortWaiting, { once: true });
    if (signal.aborted) abortWaiting();
    void queued.then(resolve, reject).finally(() => signal.removeEventListener("abort", abortWaiting));
  });
}
