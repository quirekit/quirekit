/** Unchanged lines kept around each change. */
const context = 3;

/** Edit distance beyond which the changed middle is shown as one replacement. */
const maxDistance = 1000;

/** One line of the edit script. */
type Edit = readonly [kind: " " | "-" | "+", line: string];

/**
 * Produces a read-only unified diff with one hunk per separate change.
 *
 * Distant changes, such as a body edit and a note added at the end of the
 * document, get their own hunks instead of one block spanning everything between.
 *
 * @param before - Full source text.
 * @param after - Full candidate text.
 * @returns Unified diff, or an empty string when the texts are equal.
 */
export function createReviewDiff(before: string, after: string): string {
  if (before === after) return "";
  const edits = diffLines(before.split("\n"), after.split("\n"));
  const lines = ["--- before", "+++ after"];
  // Appended line by line: spreading a large hunk into push() overflows the call stack.
  for (const hunk of groupHunks(edits)) for (const line of hunk) lines.push(line);
  return `${lines.join("\n")}\n`;
}

/**
 * Computes a shortest line edit script.
 * @param left - Source lines.
 * @param right - Candidate lines.
 * @returns Edit script covering every line of both sides.
 */
function diffLines(left: readonly string[], right: readonly string[]): Edit[] {
  let prefix = 0;
  while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < left.length - prefix && suffix < right.length - prefix
    && left[left.length - 1 - suffix] === right[right.length - 1 - suffix]) suffix += 1;
  const a = left.slice(prefix, left.length - suffix);
  const b = right.slice(prefix, right.length - suffix);
  return [
    ...left.slice(0, prefix).map((line): Edit => [" ", line]),
    ...(myers(a, b) ?? [...a.map((line): Edit => ["-", line]), ...b.map((line): Edit => ["+", line])]),
    ...left.slice(left.length - suffix).map((line): Edit => [" ", line])
  ];
}

/**
 * Myers' O((N+M)·D) shortest edit script.
 * @param a - Source lines.
 * @param b - Candidate lines.
 * @returns Edit script, or null when the distance exceeds the cap.
 */
function myers(a: readonly string[], b: readonly string[]): Edit[] | null {
  const n = a.length;
  const m = b.length;
  const offset = n + m;
  const furthest = new Int32Array(2 * offset + 2);
  // trace[d] keeps diagonals -d..d of the frontier before step d, indexed by k + d.
  const trace: Int32Array[] = [];
  // Forward phase: furthest x reached on each diagonal k = x - y after d edits.
  for (let d = 0; d <= Math.min(offset, maxDistance); d += 1) {
    trace.push(furthest.slice(offset - d, offset + d + 1));
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && furthest[offset + k - 1]! < furthest[offset + k + 1]!)
        ? furthest[offset + k + 1]!
        : furthest[offset + k - 1]! + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x += 1; y += 1; }
      furthest[offset + k] = x;
      if (x >= n && y >= m) return backtrack(a, b, trace);
    }
  }
  return null;
}

/**
 * Walks the recorded frontiers back from the end to recover the script.
 * @param a - Source lines.
 * @param b - Candidate lines.
 * @param trace - Frontier diagonals before each edit count.
 * @returns Edit script in document order.
 */
function backtrack(a: readonly string[], b: readonly string[], trace: readonly Int32Array[]): Edit[] {
  const edits: Edit[] = [];
  let x = a.length;
  let y = b.length;
  for (let d = trace.length - 1; d > 0; d -= 1) {
    const frontier = trace[d]!;
    const k = x - y;
    const down = k === -d || (k !== d && frontier[d + k - 1]! < frontier[d + k + 1]!);
    const previousX = frontier[d + (down ? k + 1 : k - 1)]!;
    const previousY = previousX - (down ? k + 1 : k - 1);
    while (x > previousX && y > previousY) { x -= 1; y -= 1; edits.push([" ", a[x]!]); }
    if (down) { y -= 1; edits.push(["+", b[y]!]); } else { x -= 1; edits.push(["-", a[x]!]); }
  }
  while (x > 0 && y > 0) { x -= 1; y -= 1; edits.push([" ", a[x]!]); }
  return edits.reverse();
}

/**
 * Splits an edit script into hunks with surrounding context.
 * @param edits - Complete edit script.
 * @returns Hunks, each starting with its `@@` header.
 */
function groupHunks(edits: readonly Edit[]): string[][] {
  const changed = edits.flatMap((edit, index) => edit[0] === " " ? [] : [index]);
  const hunks: string[][] = [];
  let cursor = 0;
  while (cursor < changed.length) {
    // Extend the hunk while the next change is close enough for contexts to touch.
    let last = cursor;
    while (last + 1 < changed.length && changed[last + 1]! - changed[last]! <= 2 * context + 1) last += 1;
    const start = Math.max(0, changed[cursor]! - context);
    const end = Math.min(edits.length, changed[last]! + context + 1);
    const before = edits.slice(0, start);
    const oldStart = before.filter(edit => edit[0] !== "+").length;
    const newStart = before.filter(edit => edit[0] !== "-").length;
    const body = edits.slice(start, end);
    const oldCount = body.filter(edit => edit[0] !== "+").length;
    const newCount = body.filter(edit => edit[0] !== "-").length;
    hunks.push([`@@ -${oldStart + 1},${oldCount} +${newStart + 1},${newCount} @@`, ...body.map(([kind, line]) => `${kind}${line}`)]);
    cursor = last + 1;
  }
  return hunks;
}
