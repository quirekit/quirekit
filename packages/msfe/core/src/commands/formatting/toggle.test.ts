import { describe, expect, it, vi } from "vitest";
import { EditorSelection, EditorState } from "@quirekit/cm-state";
import { ensureSyntaxTree, syntaxTree } from "@quirekit/cm-language";
import { markdown } from "@quirekit/cm-lang-markdown";
import { GFM } from "@quirekit/lezer-markdown";
import { toggleSourceMark } from "./toggle";
import { pendingMarkCleanup } from "./pending";
import { querySourceInline } from "./context";

const bold = { node: "StrongEmphasis", marker: "**", markerNode: "EmphasisMark" };
const italic = { node: "Emphasis", marker: "*", markerNode: "EmphasisMark" };
const strike = { node: "Strikethrough", marker: "~~", markerNode: "StrikethroughMark" };
/** @param doc - Source fixture. @param text - Selected prose. @returns An accepted parser state. */
function selected(doc: string, text: string): EditorState {
  const from = doc.indexOf(text), state = EditorState.create({ doc, selection: EditorSelection.single(from, from + text.length), extensions: markdown({ extensions: GFM }) });
  ensureSyntaxTree(state, doc.length, 1000); return state;
}

describe("semantic inline formatting", () => {
  it("stops a style at the end of its text for the text that follows, and removes it from inside", () => {
    const at = (doc: string, offset: number) => {
      const state = EditorState.create({ doc, selection: EditorSelection.cursor(offset), extensions: markdown({ extensions: GFM }) });
      ensureSyntaxTree(state, doc.length, 1000); return state.update(toggleSourceMark(bold)(state)!).state;
    };
    const end = at("说 **手感**", 6);
    expect([end.doc.toString(), end.selection.main.head]).toEqual(["说 **手感**", 8]);
    const middle = at("说 **手感** 好", 6);
    expect([middle.doc.toString(), middle.selection.main.head]).toEqual(["说 **手感** 好", 8]);
    expect(at("说 **手感**", 5).doc.toString()).toBe("说 手感");
  });

  it("keeps existing bold and italic when the surrounding punctuation admits the new format", () => {
    const state = selected("可以，***清晰***、继续。", "清晰"), spec = toggleSourceMark(strike)(state);
    expect(spec).not.toBeNull();
    const next = state.update(spec!).state;
    expect(next.doc.toString()).toBe("可以，~~***清晰***~~、继续。");
    expect(next.sliceDoc(next.selection.main.from, next.selection.main.to)).toBe("清晰");
    ensureSyntaxTree(next, next.doc.length, 1000);
    expect(syntaxTree(next).toString()).toContain("Strikethrough(StrikethroughMark,Emphasis(EmphasisMark,StrongEmphasis");
  });
  it("refuses mixed delimiter runs beside a word without adding spaces or losing existing formats", () => {
    const state = selected("可以***清晰***、继续。", "清晰");
    expect(toggleSourceMark(strike)(state)).toBeNull();
    expect(state.doc.toString()).toBe("可以***清晰***、继续。");
  });
  for (const order of [[bold, italic, strike], [bold, strike, italic], [strike, italic, bold], [italic, strike, bold]]) {
    it(`retains each style for ${order.map(mark => mark.node).join(" → ")}`, () => {
      let state = selected("可以，清晰、继续。", "清晰");
      for (const mark of order) {
        const spec = toggleSourceMark(mark)(state); expect(spec).not.toBeNull(); state = state.update(spec!).state;
        ensureSyntaxTree(state, state.doc.length, 1000);
      }
      for (const mark of order) expect(syntaxTree(state).toString()).toContain(mark.node + "(");
      for (const mark of [...order].reverse()) { const spec = toggleSourceMark(mark)(state); expect(spec).not.toBeNull(); state = state.update(spec!).state; ensureSyntaxTree(state, state.doc.length, 1000); }
      expect(state.doc.toString()).toBe("可以，清晰、继续。");
    });
  }
  it("formats a single table cell, and each cell a selection crosses", () => {
    const source = "| A | B |\n| --- | --- |\n| left | right |";
    const state = selected(source, "left");
    expect(state.update(toggleSourceMark(bold)(state)!).state.doc.toString()).toContain("| **left** | right |");
    const crossing = selected(source, "left | right");
    expect(crossing.update(toggleSourceMark(bold)(crossing)!).state.doc.toString()).toContain("| **left** | **right** |");
  });
  it("rejects literal code and structural markers", () => {
    for (const [source, text] of [["`literal`", "literal"], ["```ts\ncode\n```", "code"], ["| a | b |\n| --- | --- |", "---"]]) {
      const state = selected(source!, text!);
      expect(querySourceInline(state, state.selection.main).reason).not.toBeNull();
      expect(toggleSourceMark(bold)(state)).toBeNull();
    }
  });
  it("removes a whole active mark at a caret instead of inserting literal markers", () => {
    const state = selected("可以**清晰**。", "清晰"), caret = state.update({ selection: { anchor: state.selection.main.from + 1 } }).state;
    expect(caret.update(toggleSourceMark(bold)(caret)!).state.doc.toString()).toBe("可以清晰。");
  });
  it("preserves reversed selections and applies multiple ranges atomically", () => {
    const source = "first and second";
    // Multiple cursors must be enabled by the host; the command does not add that policy.
    const multiple = EditorState.create({ doc: source, selection: EditorSelection.create([EditorSelection.range(5, 0), EditorSelection.range(10, 16)]),
      extensions: [markdown({ extensions: GFM }), EditorState.allowMultipleSelections.of(true)] });
    const spec = toggleSourceMark(bold)(multiple)!;
    const next = multiple.update(spec).state;
    expect(next.doc.toString()).toBe("**first** and **second**");
    expect(next.selection.ranges.map(range => next.sliceDoc(range.from, range.to))).toEqual(["first", "second"]);
    expect(next.selection.ranges[0]!.anchor).toBeGreaterThan(next.selection.ranges[0]!.head);
  });
  it("removes a mark from only the selected part and does not serialize for availability", () => {
    const state = selected("**complete** text", "plete");
    const serialize = vi.spyOn(state.doc, "toString");
    expect(querySourceInline(state, state.selection.main).reason).toBeNull();
    expect(serialize).not.toHaveBeenCalled();
    serialize.mockRestore();
    expect(state.update(toggleSourceMark(bold)(state)!).state.doc.toString()).toBe("**com**plete text");
  });
  it("keeps empty prose seeds editable, but refuses empty code and table syntax", () => {
    const empty = selected("", "");
    const next = empty.update(toggleSourceMark(bold)(empty)!).state;
    expect(next.doc.toString()).toBe("****"); expect(next.selection.main.head).toBe(2);
    const code = selected("```\n\n```", "").update({ selection: { anchor: 4 } }).state;
    expect(toggleSourceMark(bold)(code)).toBeNull();
    const delimiter = selected("# heading", "#");
    expect(toggleSourceMark(bold)(delimiter)).toBeNull();
  });
  it("refuses the whole command when one range is not prose", () => {
    const doc = "first\n\n`code`", state = EditorState.create({ doc,
      selection: EditorSelection.create([EditorSelection.range(0, 5), EditorSelection.range(8, 12)]),
      extensions: [markdown({ extensions: GFM }), EditorState.allowMultipleSelections.of(true)] });
    expect(toggleSourceMark(bold)(state)).toBeNull(); expect(state.doc.toString()).toBe(doc);
  });
  it("admits paragraph ends and the outer edge of code without entering literal contents", () => {
    for (const source of ["prose", "`code`", "text\n\nafter"]) {
      const at = source.indexOf("\n") < 0 ? source.length : source.indexOf("\n");
      const state = selected(source, "").update({ selection: { anchor: at } }).state;
      expect(querySourceInline(state, state.selection.main).reason, source).toBeNull();
    }
  });
});

describe("pending empty marker pairs", () => {
  /** @param doc - Source with one ¦ caret. @returns State after one collapsed bold toggle. */
  const toggled = (doc: string) => {
    const state = EditorState.create({ doc: doc.replace("¦", ""), selection: EditorSelection.cursor(doc.indexOf("¦")), extensions: [markdown({ extensions: GFM }), pendingMarkCleanup] });
    ensureSyntaxTree(state, state.doc.length, 1000);
    return state.update(toggleSourceMark(bold)(state)!).state;
  };
  /** @param state - Result. @returns Source with the caret marked. */
  const marked = (state: EditorState) => state.doc.sliceString(0, state.selection.main.head) + "¦" + state.doc.sliceString(state.selection.main.head);

  it("removes the pair when the caret leaves it, a second toggle cancels it, and Enter drops it", () => {
    const state = toggled("前中¦间后");
    expect(marked(state)).toBe("前中**¦**间后");
    expect(marked(state.update({ selection: EditorSelection.cursor(7), userEvent: "select" }).state)).toBe("前中间¦后");
    expect(marked(state.update(toggleSourceMark(bold)(state)!).state)).toBe("前中¦间后");
    expect(marked(state.update({ changes: { from: 4, insert: "\n\n" }, selection: EditorSelection.cursor(6), userEvent: "input" }).state)).toBe("前中\n\n¦间后");
  });

  it("keeps the pair once text is typed into it", () => {
    const typed = toggled("前¦后").update({ changes: { from: 3, insert: "粗" }, selection: EditorSelection.cursor(4), userEvent: "input.type" }).state;
    expect(marked(typed.update({ selection: EditorSelection.cursor(6), userEvent: "select" }).state)).toBe("前**粗**¦后");
  });
});

describe("formatting selections that partly overlap a style or cross blocks", () => {
  /** @param doc - Source. @param from - Selection start. @param to - Selection end. @returns Source after one bold toggle, or null on refusal. */
  const toggle = (doc: string, from: number, to: number) => {
    const state = EditorState.create({ doc, selection: EditorSelection.single(from, to), extensions: markdown({ extensions: GFM }) });
    ensureSyntaxTree(state, doc.length, 1000);
    const spec = toggleSourceMark(bold)(state);
    return spec ? state.update(spec).state.doc.toString() : null;
  };

  it.each([
    ["前**粗体**后尾", 4, 8, "前**粗体后**尾"],
    ["前**粗体**后", 0, 4, "**前粗体**后"],
    ["**甲**中**乙**", 0, 11, "**甲中乙**"],
    ["**甲乙丙**", 3, 4, "**甲**乙**丙**"],
    ["**甲乙丙**", 2, 3, "甲**乙丙**"],
    ["**甲乙丙**", 4, 5, "**甲乙**丙"],
    ["前**粗**后", 1, 6, "前粗后"],
    ["甲\n\n乙", 0, 4, "**甲**\n\n**乙**"],
    ["**甲**\n\n**乙**", 0, 12, "甲\n\n乙"],
    ["**甲**\n\n乙", 0, 8, "**甲**\n\n**乙**"],
    ["# 标题\n\n正文", 2, 8, "# **标题**\n\n**正文**"],
    ["- 甲\n- 乙", 2, 7, "- **甲**\n- **乙**"],
  ])("%s [%i, %i]", (doc, from, to, expected) => expect(toggle(doc, from, to)).toBe(expected));
});
