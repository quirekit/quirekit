import type { QuireAiHostPorts } from "@quirekit/ai-contract";
import type { QuireAiToolHost } from "../../tool-host";
import type { QuireAiManager } from "../types";

/** What preparing one action produced. */
export type QuireAiPreparedAction = { readonly value: unknown } | { readonly error: string };

/** Looks up the preparation of an action for its parameters. */
export type QuireAiPreparedLookup = (name: string, params: unknown) => QuireAiPreparedAction | undefined;

/** Preparations kept per editor; parameters repeat across calls of one conversation, such as the same picture. */
const preparedLimit = 64;

const portsByHost = new WeakMap<QuireAiToolHost, QuireAiHostPorts>();
const preparedByManager = new WeakMap<QuireAiManager, Map<string, QuireAiPreparedAction>>();

/**
 * Records the host ports of a document SDK's write authority.
 * @param host - Guarded write authority of the SDK.
 * @param ports - Host ports passed to the SDK.
 */
export function registerQuireAiHostPorts(host: QuireAiToolHost, ports: QuireAiHostPorts): void {
  portsByHost.set(host, ports);
}

/**
 * Runs `prepare` of every action operation not prepared yet, before the edit is planned.
 * A failure is kept as that operation's error; it does not stop the others.
 * @param manager - AI manager supplying the facts.
 * @param host - Write authority whose ports the actions use.
 * @param operations - Operations from the model.
 * @returns Lookup for the planner.
 */
export async function prepareQuireAiActions(manager: QuireAiManager, host: QuireAiToolHost, operations: readonly unknown[]): Promise<QuireAiPreparedLookup> {
  let cache = preparedByManager.get(manager);
  if (cache === undefined) preparedByManager.set(manager, cache = new Map());
  const ports = portsByHost.get(host) ?? {};
  for (const candidate of operations) {
    const { op, params } = (candidate ?? {}) as { op?: unknown; params?: unknown };
    const action = typeof op === "string" ? manager.registry.actions.get(op) : undefined;
    if (action?.prepare === undefined) continue;
    const key = preparedKey(action.name, params);
    if (cache.has(key)) continue;
    let entry: QuireAiPreparedAction;
    try {
      entry = { value: await action.prepare(params, ports) };
    } catch (error) {
      entry = { error: error instanceof Error ? error.message : String(error) };
    }
    cache.set(key, entry);
    if (cache.size > preparedLimit) cache.delete(cache.keys().next().value!);
  }
  const prepared = cache;
  return (name, params) => prepared.get(preparedKey(name, params));
}

/**
 * @param name - Action name.
 * @param params - Parameters.
 * @returns Key equal for equal parameters regardless of key order.
 */
function preparedKey(name: string, params: unknown): string {
  return `${name}\u0000${stableJson(params)}`;
}

/** @param value - JSON value. @returns JSON text with object keys sorted. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
