import { expect, it } from "vitest";
import { createReviewDiff } from "./review-diff";

it("retains distant edits beyond the former preview truncation", () => {
  const source = Array.from({ length: 300 }, (_, index) => `unchanged line ${index}`);
  const candidate = [...source];
  candidate[2] = "first edit";
  candidate[290] = "distant final edit";
  const patch = createReviewDiff(source.join("\n"), candidate.join("\n"));
  expect(patch).toContain("+first edit");
  expect(patch).toContain("+distant final edit");
  expect(patch).toContain("-unchanged line 290");
});
it("shows formatting-only JSON changes and empty/no-op differences accurately", () => {
  expect(createReviewDiff('"bold": false', '"bold": true')).toContain('+"bold": true');
  expect(createReviewDiff("same", "same")).toBe("");
  expect(createReviewDiff("", "new")).toContain("+new");
});

it("gives distant changes separate hunks with only their own context", () => {
  const source = Array.from({ length: 200 }, (_, index) => `line ${index}`);
  const candidate = [...source.slice(0, 10), "inserted", ...source.slice(10, 150), ...source.slice(151), "appended note"];
  const patch = createReviewDiff(source.join("\n"), candidate.join("\n"));
  expect(patch.match(/^@@/gmu)).toHaveLength(3);
  expect(patch).toContain("@@ -8,6 +8,7 @@");
  expect(patch).not.toContain("line 100");
  expect(patch.split("\n").filter(line => /^[-+][^-+]/u.test(line))).toEqual(["+inserted", "-line 150", "+appended note"]);
});

it("handles a whole-document change too large to pass as call arguments", () => {
  const after = Array.from({ length: 200_000 }, (_, index) => `line ${index}`).join("\n");
  expect(createReviewDiff("", after).split("\n").length).toBeGreaterThan(200_000);
});

it("reconstructs both sides from a minimal script on random edits", () => {
  let seed = 7;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let round = 0; round < 50; round += 1) {
    const source = Array.from({ length: 30 }, () => String(Math.floor(random() * 6)));
    const candidate = source.flatMap(line => random() < 0.2 ? [] : random() < 0.2 ? [line, "x"] : [line]);
    const patch = createReviewDiff(source.join("\n"), candidate.join("\n"));
    if (patch === "") continue;
    const body = patch.split("\n").slice(2, -1).filter(line => !line.startsWith("@@"));
    const changed = body.filter(line => !line.startsWith(" ")).length;
    expect(changed).toBe(source.length + candidate.length - 2 * lcs(source, candidate));
  }
});

/**
 * @param a - First sequence.
 * @param b - Second sequence.
 * @returns Longest common subsequence length.
 */
function lcs(a: readonly string[], b: readonly string[]): number {
  const row = new Array<number>(b.length + 1).fill(0);
  for (const left of a) {
    let diagonal = 0;
    for (let j = 1; j <= b.length; j += 1) {
      const above = row[j]!;
      row[j] = left === b[j - 1] ? diagonal + 1 : Math.max(row[j]!, row[j - 1]!);
      diagonal = above;
    }
  }
  return row[b.length]!;
}
