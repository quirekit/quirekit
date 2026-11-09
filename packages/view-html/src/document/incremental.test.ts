import { getChangedRanges } from "@quirekit/core";
import { EditorState, Schema, type Transaction } from "@quirekit/pm";
import { describe, expect, it } from "vitest";
import { FakeSvgMountDocument } from "@quirekit/view/test-support/svg-mount";
import { createHtmlRetainedDocumentView, HtmlDomMappingGapError } from "./runtime";
import type { HtmlRetainedDocumentView } from "./types";

/**
 * Reads mapping facts independently of retained descriptor identities.
 * @param view - Current or independently rebuilt view.
 * @param pos - Canonical boundary.
 * @param side - Boundary bias.
 * @returns Semantic DOM point facts, or the explicit mapping gap.
 */
function point(view: HtmlRetainedDocumentView, pos: number, side: number) {
  try {
    const mapped = view.domAtPos(pos, side);
    return { type: mapped.node.nodeType, value: mapped.node.nodeValue, offset: mapped.offset,
      roundTrip: view.posAtDOM(mapped.node, mapped.offset, side) };
  } catch (error) {
    if (error instanceof HtmlDomMappingGapError) return error.code;
    throw error;
  }
}

/**
 * Verifies mappings against an independent mount.
 * @param view - Incrementally updated owner.
 * @param step - Operation context.
 */
function verify(view: HtmlRetainedDocumentView, step: string): void {
  const doc = view.root.node;
  const fresh = createHtmlRetainedDocumentView({ id: "oracle", documentNode: doc,
    ownerDocument: new FakeSvgMountDocument() as unknown as Document, source: { sourceId: "body" } });
  try {
    const owners = view.descriptorsInRange({ from: 0, to: doc.content.size });
    expect(owners.map(owner => ({ kind: owner.kind, range: owner.range })), step)
      .toEqual(fresh.descriptorsInRange({ from: 0, to: doc.content.size }).map(owner => ({ kind: owner.kind, range: owner.range })));
    for (let pos = 0; pos <= doc.content.size; pos++) {
      for (const side of [-1, 0, 1]) expect(point(view, pos, side), `${step}, position ${pos}, side ${side}`).toEqual(point(fresh, pos, side));
    }
    doc.descendants((node, pos) => {
      if (node.isBlock) expect(view.nodeDOM(pos)?.textContent).toEqual(fresh.nodeDOM(pos)?.textContent);
    });
    for (const owner of owners) expect(view.descriptorById(owner.id)).toBe(owner);
  } finally {
    fresh.destroy();
  }
}

/**
 * Builds a repeatable sequence mixing content and structural changes.
 * @param state - Current canonical state.
 * @param iteration - Deterministic edit kind.
 * @returns Next text, formatting or structural edit.
 */
function edit(state: EditorState, iteration: number): Transaction {
  const tr = state.tr;
  const first = state.doc.firstChild!;
  switch (iteration % 8) {
    case 0: return tr.insertText("字x", 2);
    case 1: return tr.addMark(1, Math.min(first.nodeSize - 1, 4), state.schema.marks.strong!.create());
    case 2: return tr.split(3).insertText("!", tr.doc.content.size - 3);
    case 3: return tr.join(first.nodeSize);
    case 4: return tr.removeMark(1, first.nodeSize - 1);
    case 5: return tr.delete(2, 3);
    case 6: return tr.delete(0, first.nodeSize).insert(tr.doc.content.size, first);
    default: return tr.insert(0, state.schema.node("paragraph", null, state.schema.text("new text")));
  }
}

describe("retained HTML incremental ownership", () => {
  it("updates neighboring text when deletion collapses onto a mark boundary", () => {
    const schema = new Schema({
      nodes: {
        doc: { content: "paragraph+" },
        paragraph: { content: "text*", toDOM: () => ["p", 0] },
        text: {}
      },
      marks: { strong: { toDOM: () => ["strong", 0] } }
    });
    const doc = schema.node("doc", null, schema.node("paragraph", null, [
      schema.text("ab"), schema.text("c", [schema.marks.strong!.create()]), schema.text("de")
    ]));
    for (const from of [2, 4]) {
      const state = EditorState.create({ schema, doc });
      const view = createHtmlRetainedDocumentView({
        id: "boundary",
        documentNode: doc,
        ownerDocument: new FakeSvgMountDocument() as unknown as Document,
        source: { sourceId: "body" }
      });
      try {
        const transaction = state.tr.delete(from, from + 1);
        view.update({ documentNode: transaction.doc, mapping: transaction.mapping, changedRanges: getChangedRanges(transaction) });
        verify(view, `mark boundary ${from}`);
      } finally {
        view.destroy();
      }
    }
  });

  it("matches a fresh mount through seeded edits at unrelated paragraph positions", () => {
    const schema = new Schema({
      nodes: {
        doc: { content: "paragraph+" },
        paragraph: { content: "text*", toDOM: () => ["p", 0] },
        text: {}
      },
      marks: { strong: { toDOM: () => ["strong", 0] } }
    });
    let state = EditorState.create({
      schema,
      doc: schema.node("doc", null, Array.from({ length: 8 }, (_, index) =>
        schema.node("paragraph", null, schema.text(`Paragraph ${index} text`))))
    });
    const view = createHtmlRetainedDocumentView({
      id: "seeded",
      documentNode: state.doc,
      ownerDocument: new FakeSvgMountDocument() as unknown as Document,
      source: { sourceId: "body" }
    });
    let seed = 503;
    try {
      for (let iteration = 0; iteration < 64; iteration++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const block = seed % state.doc.childCount;
        let from = 1;
        for (let index = 0; index < block; index++) from += state.doc.child(index).nodeSize;
        const length = state.doc.child(block).content.size;
        from += (seed >>> 8) % Math.max(1, length);
        const transaction = state.tr;
        if (iteration % 3 === 0 || length === 0) {
          transaction.insertText("字", from);
        } else if (iteration % 3 === 1) {
          transaction.delete(from, from + 1);
        } else {
          transaction.addMark(from, from + 1, schema.marks.strong!.create());
        }
        state = state.apply(transaction);
        view.update({ documentNode: state.doc, mapping: transaction.mapping, changedRanges: getChangedRanges(transaction) });
        verify(view, `seeded step ${iteration}`);
      }
    } finally {
      view.destroy();
    }
  });

  it("remaps descendants when moving a paragraph beside an equivalent sibling", () => {
    const schema = new Schema({ nodes: { doc: { content: "paragraph+" },
      paragraph: { content: "text*", toDOM: () => ["p", 0] }, text: {} } });
    const state = EditorState.create({ schema, doc: schema.node("doc", null,
      ["n", "tail", "n"].map(text => schema.node("paragraph", null, schema.text(text)))) });
    const view = createHtmlRetainedDocumentView({ id: "duplicates", documentNode: state.doc,
      ownerDocument: new FakeSvgMountDocument() as unknown as Document, source: { sourceId: "body" } });
    try {
      const first = state.doc.firstChild!;
      const transaction = state.tr.delete(0, first.nodeSize);
      transaction.insert(transaction.doc.content.size, first);
      view.update({ documentNode: transaction.doc, mapping: transaction.mapping, changedRanges: getChangedRanges(transaction) });
      verify(view, "duplicate paragraph move");
    } finally {
      view.destroy();
    }
  });

  it("matches a fresh mount through text edits, marks, split/join, moves and inverse steps", () => {
    const schema = new Schema({ nodes: { doc: { content: "paragraph+" },
      paragraph: { content: "text*", toDOM: () => ["p", 0] }, text: {} },
    marks: { strong: { toDOM: () => ["strong", 0] } } });
    let state = EditorState.create({ schema, doc: schema.node("doc", null,
      Array.from({ length: 12 }, (_, index) => schema.node("paragraph", null, schema.text(`Block ${index} 🙂 text`)))) });
    const view = createHtmlRetainedDocumentView({ id: "incremental", documentNode: state.doc,
      ownerDocument: new FakeSvgMountDocument() as unknown as Document, source: { sourceId: "body" } });
    try {
      for (let iteration = 0; iteration < 32; iteration++) {
        const previous = state.doc;
        const transaction = edit(state, iteration);
        state = state.apply(transaction);
        expect(() => view.update({ documentNode: state.doc, mapping: transaction.mapping, changedRanges: getChangedRanges(transaction) }),
          `Step ${iteration}: ${JSON.stringify(transaction.steps.map(step => step.toJSON()))}`).not.toThrow();
        verify(view, `step ${iteration}`);
        if (iteration % 4 === 3) {
          const inverse = state.tr;
          for (let index = transaction.steps.length - 1; index >= 0; index--) {
            inverse.step(transaction.steps[index]!.invert(transaction.docs[index]!));
          }
          state = state.apply(inverse);
          view.update({ documentNode: state.doc, mapping: inverse.mapping, changedRanges: getChangedRanges(inverse) });
          expect(state.doc.eq(previous)).toBe(true);
          verify(view, `inverse ${iteration}`);
        }
      }
    } finally {
      view.destroy();
    }
  });
});
