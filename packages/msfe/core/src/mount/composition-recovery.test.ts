// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { EditorView } from "@quirekit/cm-view";
import { createMsfeEditor } from "../editor/create";
import { compositionField } from "../state/fields";

/** @returns A mounted editor whose browser lost the end of a native composition. */
function stuckComposition() {
  const parent = document.createElement("div"); document.body.append(parent);
  const editor = createMsfeEditor({ parent, mode: "live", markdown: "开始结束" });
  const view = EditorView.findFromDOM(editor.element)!;
  view.contentDOM.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "" }));
  expect(view.compositionStarted).toBe(true);
  expect(view.state.field(compositionField)).toBe(true);
  return { view, dispose: () => { editor.destroy(); parent.remove(); } };
}

it("ends a composition whose compositionend was lost when an ordinary key arrives", () => {
  const { view, dispose } = stuckComposition();
  try {
    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Process", keyCode: 229 }));
    expect(view.compositionStarted).toBe(true);
    view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "a", keyCode: 65 }));
    expect(view.compositionStarted).toBe(false);
  } finally { dispose(); }
});

it("ends a lost composition on pointer down so mouse selection is not treated as preedit", () => {
  const { view, dispose } = stuckComposition();
  try {
    view.contentDOM.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 1, clientY: 1 }));
    expect(view.compositionStarted).toBe(false);
  } finally { dispose(); }
});

it("restarts cleanly when a new composition begins before the previous one reported its end", async () => {
  const { view, dispose } = stuckComposition();
  try {
    // The lost composition had already changed the DOM a few times.
    view.inputState.composing = 3;
    view.contentDOM.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "" }));
    expect(view.compositionStarted).toBe(true);
    expect(view.inputState.composing).toBe(0);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(view.state.field(compositionField)).toBe(true);
  } finally { dispose(); }
});
