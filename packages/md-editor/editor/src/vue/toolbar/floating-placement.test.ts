import { expect, it } from "vitest";
import { mdFloatingGap, mdFloatingMargin, placeMdFloatingToolbar, type MdFloatingAnchor } from "./floating-placement";

const size = { width: 300, height: 40 };
/** @param patch - Fields that differ from a selection in the middle of an 800px layer. @returns Anchor fixture. */
function anchor(patch: Partial<MdFloatingAnchor> = {}): MdFloatingAnchor {
  return { center: 400, top: 500, bottom: 524, layerWidth: 800, clearTop: 0, ...patch };
}

it("centers above the selection with a gap", () => {
  expect(placeMdFloatingToolbar(anchor(), size)).toEqual({ left: 250, top: 500 - mdFloatingGap - 40, side: "top" });
});

it("keeps the toolbar inside the layer at either edge", () => {
  expect(placeMdFloatingToolbar(anchor({ center: 20 }), size).left).toBe(mdFloatingMargin);
  expect(placeMdFloatingToolbar(anchor({ center: 790 }), size).left).toBe(800 - 300 - mdFloatingMargin);
});

it("moves below the selection when sticky chrome covers the space above", () => {
  expect(placeMdFloatingToolbar(anchor({ clearTop: 470 }), size)).toEqual({ left: 250, top: 524 + mdFloatingGap, side: "bottom" });
  expect(placeMdFloatingToolbar(anchor({ clearTop: 452 }), size).side).toBe("top");
});

it("stays at the left margin when the layer is narrower than the toolbar", () => {
  expect(placeMdFloatingToolbar(anchor({ layerWidth: 200, center: 100 }), size).left).toBe(mdFloatingMargin);
});
