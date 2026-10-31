/**
 * Projects an original tool payload for the local trace UI.
 *
 * @param value - Original parsed tool arguments or result.
 * @returns JSON-compatible payload preserving shape with secrets redacted.
 */
export function projectTraceValue(value: unknown): unknown {
  return cloneTraceValue(value, new WeakSet<object>(), 0);
}

/**
 * Projects complete Tool arguments without replacing model-authored data with counts.
 *
 * @param value - Complete parsed native Pi Tool arguments.
 * @returns Complete parsed arguments with credential-like fields redacted.
 */
export function projectTraceToolArguments(
  value: unknown
): unknown {
  return projectTraceValue(value);
}

/**
 * Projects one Pi tool result into the audited presentation boundary.
 *
 * @param value - Pi tool result wrapper.
 * @returns Tool-owned details with credential-like fields redacted.
 */
export function projectTraceToolResult(value: unknown): unknown {
  const details = readToolResultDetails(value);
  return projectTraceValue(details ?? value);
}

/**
 * Reads Pi's public tool-result details.
 *
 * @param value - Candidate Pi tool result.
 * @returns Tool-owned details when present.
 */
function readToolResultDetails(value: unknown): unknown {
  if (value === null || typeof value !== "object" || !("details" in value)) {
    return undefined;
  }
  return value.details;
}

/**
 * Recursively clones one trace value while redacting secret-bearing keys.
 *
 * @param value - Current source value.
 * @param seen - Objects already visited while guarding unexpected cycles.
 * @param depth - Current structural depth.
 * @returns Safe exact-shape trace value.
 */
function cloneTraceValue(
  value: unknown,
  seen: WeakSet<object>,
  depth: number
): unknown {
  if (depth > 32) return "[depth-limit]";
  if (
    value === null
    || typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean"
    || value === undefined
  ) return value;
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[circular]";
  seen.add(value);
  if (Array.isArray(value)) {
    const result = value.map(item => cloneTraceValue(item, seen, depth + 1));
    seen.delete(value);
    return result;
  }
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = /api[-_]?key|access[-_]?token|authorization|credential|secret|password|bearer/iu
      .test(key)
      ? "[redacted]"
      : cloneTraceValue(item, seen, depth + 1);
  }
  seen.delete(value);
  return result;
}
