import { describe, expect, it } from "vitest";
import { paginateQuireMeasuredContainer } from "./paginate";
import type { QuireMeasuredContainerItem } from "./types";

/** @param index - Source position. @param patch - Pagination constraints. @returns Ten-pixel measured line. */
function line(index: number, patch: Partial<QuireMeasuredContainerItem> = {}): QuireMeasuredContainerItem {
  return { id: String(index), range: { from: index, to: index + 1 }, height: 10, canSplit: false, ...patch };
}

/**
 * Builds the Word probe: single-line fillers, a six-line keep-with-next paragraph P, then a six-line
 * keep-together paragraph Q, paginated on a page of whole lines.
 * @param fillers - Lines before P.
 * @param control - Widow/orphan minimum of both paragraphs.
 * @param heading - Whether a keep-with-next heading line precedes P.
 * @param lines - Lines per page.
 * @returns First page result.
 */
function probe(fillers: number, control = 2, heading = false, lines = 10) {
  const items: QuireMeasuredContainerItem[] = Array.from({ length: fillers }, (_, index) => line(index));
  if (heading) items.push(line(items.length, { keepWithNext: true, keepTogether: true }));
  const paragraph = (group: string, patch: Partial<QuireMeasuredContainerItem>) => {
    for (let count = 0; count < 6; count += 1) {
      items.push(line(items.length, { group, groupWidows: control, groupOrphans: control, ...patch }));
    }
  };
  paragraph("P", { keepWithNext: true });
  paragraph("Q", { keepTogether: true });
  return paginateQuireMeasuredContainer({ container: { id: "body", range: { from: 0, to: items.length }, items },
    startIndex: 0, availableHeight: lines * 10, isPageTop: true, incomingEndInfo: { openNodes: [], openMarks: [] } });
}

describe("keep-with-next on a splittable paragraph", () => {
  it("carries only the widow minimum to the next page with its successor", () => {
    expect(probe(3)).toMatchObject({ kind: "spill", nextIndex: 7, consumedHeight: 70 });
  });
  it("carries a single line when widow control is off", () => {
    expect(probe(3, 1)).toMatchObject({ kind: "spill", nextIndex: 8, consumedHeight: 80 });
  });
  it("keeps a natural break inside the paragraph, whose tail already meets the successor", () => {
    expect(probe(10, 2, false, 13)).toMatchObject({ kind: "spill", nextIndex: 13, consumedHeight: 130 });
  });
  it("keeps a preceding heading with the paragraph's first lines only", () => {
    expect(probe(2, 2, true)).toMatchObject({ kind: "spill", nextIndex: 7, consumedHeight: 70 });
  });
  it("moves a paragraph too short to split as a whole", () => {
    const items = [line(0), line(1), ...[2, 3, 4].map(index => line(index, { group: "P", keepWithNext: true, groupWidows: 2, groupOrphans: 2 })),
      line(5, { group: "Q", keepTogether: true }), line(6, { group: "Q", keepTogether: true })];
    expect(paginateQuireMeasuredContainer({ container: { id: "body", range: { from: 0, to: 7 }, items },
      startIndex: 0, availableHeight: 60, isPageTop: true, incomingEndInfo: { openNodes: [], openMarks: [] }
    })).toMatchObject({ kind: "spill", nextIndex: 2, consumedHeight: 20 });
  });
  it("never empties a page when the paragraph continues from the previous one", () => {
    const items = [...[0, 1, 2].map(index => line(index, { group: "P", keepWithNext: true, groupWidows: 2, groupOrphans: 2 })),
      ...[3, 4, 5].map(index => line(index, { group: "P", keepWithNext: true, groupWidows: 2, groupOrphans: 2 })),
      ...[6, 7, 8].map(index => line(index, { group: "Q", keepTogether: true }))];
    expect(paginateQuireMeasuredContainer({ container: { id: "body", range: { from: 0, to: 9 }, items },
      startIndex: 3, availableHeight: 50, isPageTop: true, incomingEndInfo: { openNodes: [], openMarks: [] }
    })).toMatchObject({ kind: "spill", nextIndex: 6 });
  });
});
