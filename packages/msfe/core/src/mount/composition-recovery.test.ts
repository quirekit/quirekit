// @vitest-environment happy-dom
import { beforeAll, expect, it } from "vitest";
import { EditorView } from "@quirekit/cm-view";
import { createMsfeEditor } from "../editor/create";
import { compositionField } from "../state/fields";

// happy-dom dispatches selectionchange synchronously inside editor updates; browsers queue it as a task.
beforeAll(() => {
  const prototype = Object.getPrototypeOf(document) as Document, dispatch = prototype.dispatchEvent, deferred = new WeakSet<Event>();
  prototype.dispatchEvent = function (this: Document, event: Event) {
    // happy-dom routes the deferred dispatch through this method again; that pass must go through.
    if (event.type !== "selectionchange" || deferred.has(event)) return dispatch.call(this, event);
    deferred.add(event);
    setTimeout(() => dispatch.call(this, event));
    return true;
  };
});

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

it("ends a lost composition on pointer down once its lingering composed DOM has gone quiet", () => {
  const { view, dispose } = stuckComposition();
  try {
    view.docView.hasComposition = { from: 0, to: 1 };
    view.inputState.compositionActiveAt = Date.now();
    view.contentDOM.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 1, clientY: 1 }));
    // An active composition keeps its preedit through a press.
    expect(view.compositionStarted).toBe(true);
    view.inputState.compositionActiveAt = Date.now() - 1000;
    view.contentDOM.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0, clientX: 1, clientY: 1 }));
    expect(view.compositionStarted).toBe(false);
  } finally { dispose(); }
});

it("releases the editing guard when CodeMirror has left composition but the end never reached it", async () => {
  const { view, dispose } = stuckComposition();
  try {
    view.inputState.composing = -1;
    view.dispatch({});
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(view.state.field(compositionField)).toBe(false);
  } finally { dispose(); }
});

it("ends a lost composition and releases the editing guard when the editor loses focus", async () => {
  const { view, dispose } = stuckComposition();
  try {
    view.contentDOM.dispatchEvent(new FocusEvent("blur"));
    expect(view.compositionStarted).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(view.state.field(compositionField)).toBe(false);
  } finally { dispose(); }
});

it("releases the editing guard shortly after a reported composition end", async () => {
  const { view, dispose } = stuckComposition();
  try {
    view.contentDOM.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "" }));
    expect(view.state.field(compositionField)).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(view.state.field(compositionField)).toBe(false);
  } finally { dispose(); }
});
