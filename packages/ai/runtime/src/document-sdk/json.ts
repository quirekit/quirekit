import { QuireDocumentSdkError } from "./error";

/**
 * Copies JSON protocol data without retaining mutable caller objects.
 * @param value - Candidate protocol value.
 * @returns Deeply frozen JSON data.
 */
export function copyDocumentJson<Value>(value: Value): Value {
  const active = new Set<object>();
  /**
   * Validates and detaches one JSON subtree.
   * @param item - Value in the current subtree.
   * @returns Detached JSON subtree.
   */
  function copy(item: unknown): unknown {
    if (item === null || typeof item === "string" || typeof item === "boolean") return item;
    if (typeof item === "number" && Number.isFinite(item)) return item;
    if (typeof item !== "object" || active.has(item)) {
      throw new QuireDocumentSdkError("invalid-json", "Document protocol data must be finite, acyclic JSON.");
    }
    if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype
      && Object.getPrototypeOf(item) !== null) {
      throw new QuireDocumentSdkError("invalid-json", "Document protocol objects must be plain JSON records.");
    }
    active.add(item);
    const result = Array.isArray(item) ? Array.from(item, copy) : Object.fromEntries(
      Object.entries(item).filter(([, child]) => child !== undefined)
        .map(([key, child]) => [key, copy(child)])
    );
    active.delete(item);
    return Object.freeze(result);
  }
  return copy(value) as Value;
}

/**
 * Creates an order-independent identity for an invocation payload.
 * @param value - Validated JSON data.
 * @returns Canonical JSON text used only inside the SDK.
 */
export function documentJsonKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(documentJsonKey).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${documentJsonKey(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
