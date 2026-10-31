import { describe, expect, it } from "vitest";
import { applyQuireAiSourceChanges, invertQuireAiSourceChanges, mapQuireAiSourcePos } from "./map";

describe("source change mapping", () => {
  const changes = [{ from: 2, to: 4, insert: "XYZ" }, { from: 6, to: 6, insert: "!" }];

  it("maps positions before, inside and after replacements", () => {
    expect(mapQuireAiSourcePos(changes, 1, 1)).toBe(1);
    expect(mapQuireAiSourcePos(changes, 3, -1)).toBe(2);
    expect(mapQuireAiSourcePos(changes, 3, 1)).toBe(5);
    expect(mapQuireAiSourcePos(changes, 5, 1)).toBe(6);
    expect(mapQuireAiSourcePos(changes, 6, -1)).toBe(7);
    expect(mapQuireAiSourcePos(changes, 6, 1)).toBe(8);
    expect(mapQuireAiSourcePos(changes, 8, 1)).toBe(10);
  });

  it("inverts a change set", () => {
    const before = "abcdefgh";
    const after = applyQuireAiSourceChanges(before, changes);
    expect(after).toBe("abXYZef!gh");
    const inverse = invertQuireAiSourceChanges(changes, ["cd", ""]);
    expect(applyQuireAiSourceChanges(after, inverse)).toBe(before);
  });
});
