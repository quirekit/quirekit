/** One step of an edit script between two sequences. */
export type QuireAiDiffStep =
  | { readonly kind: "same"; readonly a: number; readonly b: number }
  | { readonly kind: "removed"; readonly a: number }
  | { readonly kind: "inserted"; readonly b: number };

/** Edit distance beyond which the changed middle is reported as one replacement. */
const maxDistance = 1000;

/**
 * Computes a shortest edit script with Myers' O((N+M)·D) algorithm.
 *
 * Common prefix and suffix are matched first, so the search only covers the
 * changed middle; a middle further apart than the cap becomes a plain replacement.
 *
 * @param a - Source items.
 * @param b - Candidate items.
 * @param equal - Item equality.
 * @returns Steps covering every item of both sequences in order.
 */
export function diffQuireAiSequences<T>(a: readonly T[], b: readonly T[], equal: (left: T, right: T) => boolean = Object.is): QuireAiDiffStep[] {
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && equal(a[prefix]!, b[prefix]!)) prefix += 1;
  let suffix = 0;
  while (suffix < a.length - prefix && suffix < b.length - prefix && equal(a[a.length - 1 - suffix]!, b[b.length - 1 - suffix]!)) suffix += 1;
  const n = a.length - prefix - suffix;
  const m = b.length - prefix - suffix;
  const middle = myers(n, m, (x, y) => equal(a[prefix + x]!, b[prefix + y]!))
    ?? [...range(n).map((x): QuireAiDiffStep => ({ kind: "removed", a: x })), ...range(m).map((y): QuireAiDiffStep => ({ kind: "inserted", b: y }))];
  return [
    ...range(prefix).map((index): QuireAiDiffStep => ({ kind: "same", a: index, b: index })),
    ...middle.map((step): QuireAiDiffStep => step.kind === "same" ? { kind: "same", a: step.a + prefix, b: step.b + prefix }
      : step.kind === "removed" ? { kind: "removed", a: step.a + prefix } : { kind: "inserted", b: step.b + prefix }),
    ...range(suffix).map((index): QuireAiDiffStep => ({ kind: "same", a: a.length - suffix + index, b: b.length - suffix + index }))
  ];
}

/**
 * Myers search over index spaces.
 * @param n - Source length.
 * @param m - Candidate length.
 * @param equal - Equality of source index x and candidate index y.
 * @returns Steps, or null when the distance exceeds the cap.
 */
function myers(n: number, m: number, equal: (x: number, y: number) => boolean): QuireAiDiffStep[] | null {
  const offset = n + m;
  const furthest = new Int32Array(2 * offset + 2);
  // trace[d] keeps diagonals -d..d of the frontier before step d, indexed by k + d.
  const trace: Int32Array[] = [];
  for (let d = 0; d <= Math.min(offset, maxDistance); d += 1) {
    trace.push(furthest.slice(offset - d, offset + d + 1));
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && furthest[offset + k - 1]! < furthest[offset + k + 1]!)
        ? furthest[offset + k + 1]!
        : furthest[offset + k - 1]! + 1;
      let y = x - k;
      while (x < n && y < m && equal(x, y)) { x += 1; y += 1; }
      furthest[offset + k] = x;
      if (x >= n && y >= m) return backtrack(n, m, trace);
    }
  }
  return null;
}

/**
 * Recovers the script from the recorded frontiers.
 * @param n - Source length.
 * @param m - Candidate length.
 * @param trace - Frontier diagonals before each edit count.
 * @returns Steps in order.
 */
function backtrack(n: number, m: number, trace: readonly Int32Array[]): QuireAiDiffStep[] {
  const steps: QuireAiDiffStep[] = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 1; d > 0; d -= 1) {
    const frontier = trace[d]!;
    const k = x - y;
    const down = k === -d || (k !== d && frontier[d + k - 1]! < frontier[d + k + 1]!);
    const previousX = frontier[d + (down ? k + 1 : k - 1)]!;
    const previousY = previousX - (down ? k + 1 : k - 1);
    while (x > previousX && y > previousY) { x -= 1; y -= 1; steps.push({ kind: "same", a: x, b: y }); }
    if (down) { y -= 1; steps.push({ kind: "inserted", b: y }); } else { x -= 1; steps.push({ kind: "removed", a: x }); }
  }
  while (x > 0 && y > 0) { x -= 1; y -= 1; steps.push({ kind: "same", a: x, b: y }); }
  return steps.reverse();
}

/** @param length - Count. @returns 0..length-1. */
function range(length: number): number[] {
  return Array.from({ length }, (_, index) => index);
}
