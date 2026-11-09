import { describe, expect, it, vi } from "vitest";
import { EditorSelection, EditorState, Prec, type EditorState as State } from "@quirekit/cm-state";
import { ensureSyntaxTree } from "@quirekit/cm-language";
import { createMsfeReadState } from "@quirekit/msfe-core";
import { compositionEffect } from "@quirekit/msfe-core/state";
import { CodeBlock } from "./code-block";

/** Fixture presentation: plain source, or the live view with hidden syntax. */
type View = "source" | "hidden";

/** Presentation read by the pairing filter; read states have no mounted view to switch. */
const presentation = vi.hoisted(() => ({ view: "source" as "source" | "hidden" }));
vi.mock("@quirekit/msfe-core", async original => {
  const core = await original<typeof import("@quirekit/msfe-core")>();
  return { ...core,
    readSourcePresentation: (state: State) => ({ ...core.readSourcePresentation(state), mode: presentation.view === "hidden" ? "live" : "source" }),
    isSourceRevealed: () => false };
});

/** @param markdown - Source with `|` marking the caret. @param closeFence - Pairing option. @param view - Presentation. @returns Parsed editable state. */
function fixture(markdown: string, closeFence = true, view: View = "source"): State {
  const caret = markdown.indexOf("|"), doc = markdown.replace("|", "");
  presentation.view = view;
  const state = createMsfeReadState({ markdown: doc, extensions: [CodeBlock.configure({ closeFence }),
    { id: "editable-test", extensions: Prec.highest(EditorState.readOnly.of(false)) }] })
    .update({ selection: EditorSelection.cursor(caret) }).state;
  expect(ensureSyntaxTree(state, state.doc.length, 5000)).not.toBeNull(); return state;
}

/** @param state - Editable state. @returns Source with `|` at the main caret. */
function show(state: State): string {
  const head = state.selection.main.head;
  return state.sliceDoc(0, head) + "|" + state.sliceDoc(head);
}

/** @param markdown - Fixture source. @param text - Typed text. @param closeFence - Pairing option. @param view - Presentation. @returns Source after native typing. */
function type(markdown: string, text: string, closeFence = true, view: View = "source"): string {
  const state = fixture(markdown, closeFence, view), head = state.selection.main.head;
  return show(state.update({ changes: { from: head, insert: text }, selection: EditorSelection.cursor(head + text.length),
    userEvent: "input.type" }).state);
}

/** @param markdown - Fixture source. @returns Source after one native Backspace. */
function backspace(markdown: string): string {
  const state = fixture(markdown), head = state.selection.main.head;
  return show(state.update({ changes: { from: head - 1, to: head }, selection: EditorSelection.cursor(head - 1),
    userEvent: "delete.backward" }).state);
}

/** @param markdown - Fixture source. @param commits - Text each IME composition commits. @returns Source after every composition ends. */
function compose(markdown: string, ...commits: string[]): string {
  let state = fixture(markdown);
  for (const text of commits) {
    state = state.update({ effects: compositionEffect.of(true) }).state;
    const head = state.selection.main.head;
    state = state.update({ changes: { from: head, insert: text }, selection: EditorSelection.cursor(head + text.length), userEvent: "input.type.compose" }).state;
    expect(state.doc.lines).toBe(fixture(markdown).doc.lines);
    state = state.update({ effects: compositionEffect.of(false) }).state;
  }
  return show(state);
}

describe("fence pairing", () => {
  it("closes a fence committed through an input method once the composition ends", () => {
    expect(compose("|\n```\ncode\n```", "`", "`", "`")).toBe("```|\n```\n```\ncode\n```");
    expect(compose("|\n```\ncode\n```", "```")).toBe("```|\n```\n```\ncode\n```");
    expect(compose("|", "你好")).toBe("你好|");
  });

  it("closes a fence typed right after a composition", () => {
    const state = fixture("``|\n```\ncode\n```"), head = state.selection.main.head;
    expect(show(state.update({ changes: { from: head, insert: "`" }, selection: EditorSelection.cursor(head + 1), userEvent: "input.type.compose" }).state))
      .toBe("```|\n```\n```\ncode\n```");
  });

  it("closes a fence opened above an existing code block", () => {
    expect(type("text\n\n``|\n\n```\ncode\n```", "`")).toBe("text\n\n```|\n```\n\n```\ncode\n```");
    expect(type("~~|", "~")).toBe("~~~|\n~~~");
    expect(type("|\n```\ncode\n```", "```")).toBe("```|\n```\n```\ncode\n```");
  });

  it("opens a body row when the view hides fences", () => {
    expect(type("``|\n```\ncode\n```", "`", true, "hidden")).toBe("```\n|\n```\n```\ncode\n```");
    expect(type("> ``|", "`", true, "hidden")).toBe("> ```\n> |\n> ```");
  });

  it("repeats quote and list prefixes on the closing fence", () => {
    expect(type("> ``|", "`")).toBe("> ```|\n> ```");
    expect(type("- ``|", "`")).toBe("- ```|\n  ```");
  });

  it("leaves closing fences, inline text and composition input unpaired", () => {
    expect(type("```\ncode\n``|", "`")).toBe("```\ncode\n```|");
    expect(type("a ``|", "`")).toBe("a ```|");
    expect(type("``|js", "`")).toBe("```|js");
    expect(type("``|", "`", false)).toBe("```|");
  });

  it("drops the paired closer when the author types their own", () => {
    expect(type("```\ncode\n``|\n```\n\n```\nnext\n```", "`")).toBe("```\ncode\n```|\n\n```\nnext\n```");
    expect(type("```\ncode\n|\n\n```\n```\nnext\n```", "```")).toBe("```\ncode\n```|\n```\nnext\n```");
    expect(type("> ```\n> a\n> |\n> ```", "```")).toBe("> ```\n> a\n> ```|");
  });

  it("reopens the remaining code when a typed fence closes a block early", () => {
    expect(type("```js\na\n|\nb\n```\n\n```\nnext\n```", "```")).toBe("```js\na\n```|\n```\nb\n```\n\n```\nnext\n```");
    expect(type("- ```\n  a\n  |\n  b\n  ```", "```")).toBe("- ```\n  a\n  ```|\n  ```\n  b\n  ```");
  });

  it("lengthens the closing fence with its opener", () => {
    expect(type("```|\n```", "`")).toBe("````|\n````");
    expect(type("```|js\nconst a = 1\n```", "`")).toBe("````|js\nconst a = 1\n````");
    expect(type("```|\na\n````", "`")).toBe("````|\na\n````");
  });

  it("removes the paired closing fence with an empty opener", () => {
    expect(backspace("```|\n```\n\nafter")).toBe("``|\n\nafter");
    expect(backspace("> ```|\n> ```")).toBe("> ``|");
    expect(backspace("```|\ncode\n```")).toBe("``|\ncode\n```");
    expect(backspace("````|\n````")).toBe("```|\n````");
  });
});
