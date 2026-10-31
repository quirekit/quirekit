/** Cached endpoints are safe because canonical document nodes are immutable. */
const revisions = new WeakMap<object, string>();

/**
 * Creates a deterministic revision token for one canonical editor document.
 *
 * The digest is an optimistic-concurrency token, not a security primitive.
 * Equivalent canonical JSON produces the same token in browser and Node hosts.
 *
 * @param document - Canonical document with a JSON representation.
 * @returns Stable revision token for the exact document endpoint.
 */
export function createQuireAiDocumentRevision(
  document: { readonly toJSON: () => unknown }
): string {
  const cached = revisions.get(document);
  if (cached !== undefined) return cached;
  const source = serializeStableJson(document.toJSON());
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    first = Math.imul((first ^ code) >>> 0, 0x01000193) >>> 0;
    second = Math.imul((second ^ code) >>> 0, 0x85ebca6b) >>> 0;
  }
  const revision = `qk-doc-${first.toString(16).padStart(8, "0")}${second
    .toString(16)
    .padStart(8, "0")}`;
  revisions.set(document, revision);
  return revision;
}

/**
 * Serializes JSON-shaped state independently of object key insertion order.
 *
 * @param value - Canonical JSON-shaped value.
 * @returns Stable structural text for optimistic concurrency hashing.
 */
function serializeStableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(serializeStableJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Readonly<Record<string, unknown>>;
    return `{${Object.keys(record).sort().map(key => (
      `${JSON.stringify(key)}:${serializeStableJson(record[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
