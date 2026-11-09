import { getChangedRanges } from "@quirekit/core";
import { EditorState, Schema } from "@quirekit/pm";
import { describe, expect, it, vi } from "vitest";
import { FakeSvgMountDocument } from "@quirekit/view/test-support/svg-mount";
import { HtmlDescriptorPositionIndex } from "../reconcile/ownership/position-index";
import {
  createHtmlRetainedDocumentView,
  HtmlDomMappingGapError
} from "./runtime";

describe("retained HTML document view", registerDocumentViewTests);

/** Registers retained document facade behavior. */
function registerDocumentViewTests(): void {
  it("reuses ownership indexes through text changes and rebuilds on a split", () => {
    const fixture = createRuntimeFixture();
    const sibling = fixture.view.root.children[1]!.mount!.dom;
    const rebuild = vi.spyOn(HtmlDescriptorPositionIndex.prototype, "rebuild");
    try {
      const transaction = fixture.state.tr.insertText("!", 1);
      const result = fixture.view.update({ documentNode: transaction.doc,
        mapping: transaction.mapping, changedRanges: getChangedRanges(transaction) });
      expect(rebuild).not.toHaveBeenCalled();
      expect(result.ownershipChanged).toBe(false);
      expect(fixture.view.nodeDOM(transaction.doc.child(0).nodeSize)).toBe(sibling);
      const point = fixture.view.domAtPos(10);
      expect(fixture.view.posAtDOM(point.node, point.offset)).toBe(10);

      const split = fixture.state.apply(transaction).tr.split(3);
      const changed = fixture.view.update({ documentNode: split.doc,
        mapping: split.mapping, changedRanges: getChangedRanges(split) });
      expect(rebuild).toHaveBeenCalledOnce();
      expect(changed.ownershipChanged).toBe(true);
      const splitPoint = fixture.view.domAtPos(5);
      expect(fixture.view.posAtDOM(splitPoint.node, splitPoint.offset)).toBe(5);
    } finally {
      rebuild.mockRestore();
      fixture.view.destroy();
    }
  });
  it("keeps the document facade and sibling DOM across text input", testPersistentUpdate);
  it("maps document and DOM points only through retained ownership", testOwnedMappings);
  it("updates stale DOM positions through transaction mappings", testMappedDOMPosition);
  it("reports named gaps for mountless and unowned products", testMappingGaps);
  it("rejects compacted DOM boundaries that cross semantic gaps", testCompactedBoundaryGap);
  it("destroys retained ownership exactly once", testDestroyOnce);
}

/** Proves the facade owns one persistent descriptor tree. */
function testPersistentUpdate(): void {
  const schema = new Schema({
    nodes: {
      doc: { content: "block+" },
      paragraph: { content: "text*", group: "block", toDOM: () => ["p", 0] },
      text: {}
    }
  });
  const documentNode = schema.node("doc", null, [
    schema.node("paragraph", null, schema.text("first")),
    schema.node("paragraph", null, schema.text("second"))
  ]);
  const state = EditorState.create({ schema, doc: documentNode });
  const transaction = state.tr.insertText("!", 2);
  const view = createHtmlRetainedDocumentView({
    id: "html:document",
    documentNode,
    ownerDocument: new FakeSvgMountDocument() as unknown as Document,
    source: { sourceId: "doc:body" }
  });
  const root = view.root;
  const siblingDOM = root.children[1]?.mount?.dom;

  const result = view.update({
    documentNode: transaction.doc,
    mapping: transaction.mapping,
    changedRanges: getChangedRanges(transaction)
  });

  expect(view.root).toBe(root);
  expect(view.root.children[1]?.mount?.dom).toBe(siblingDOM);
  expect(result.trace.textWrites).toHaveLength(1);
  expect(result.trace.rootReplacements).toBe(0);
}

/** Proves round trips and node lookup resolve through descriptor ownership. */
function testOwnedMappings(): void {
  const fixture = createRuntimeFixture();
  const text = fixture.view.root.children[0]?.kind === "node"
    ? fixture.view.root.children[0].children[0]
    : undefined;
  const point = fixture.view.domAtPos(3);

  expect(point.node).toBe(text?.mount?.dom);
  expect(point.offset).toBe(2);
  expect(point.descriptorId).toBe(text?.id);
  expect(fixture.view.posAtDOM(point.node, point.offset)).toBe(3);
  expect(fixture.view.nodeDOM(0)).toBe(fixture.view.root.children[0]?.mount?.dom);
}

/** Proves an existing DOM owner resolves against its newly mapped range. */
function testMappedDOMPosition(): void {
  const fixture = createRuntimeFixture();
  const textDOM = fixture.view.domAtPos(2).node;
  const transaction = fixture.state.tr.insertText("!", 1);

  fixture.view.update({
    documentNode: transaction.doc,
    mapping: transaction.mapping,
    changedRanges: getChangedRanges(transaction)
  });

  expect(fixture.view.posAtDOM(textDOM, 2)).toBe(3);
}

/** Proves the facade never fabricates points for absent descriptor mounts. */
function testMappingGaps(): void {
  const schema = new Schema({
    nodes: {
      doc: { content: "block+" },
      missing: { group: "block" },
      text: {}
    }
  });
  const documentNode = schema.node("doc", null, [schema.node("missing")]);
  const ownerDocument = new FakeSvgMountDocument();
  const view = createHtmlRetainedDocumentView({
    id: "html:gaps",
    documentNode,
    ownerDocument: ownerDocument as unknown as Document,
    source: { sourceId: "doc:gaps" }
  });
  const unowned = ownerDocument.createElement("span") as unknown as Node;

  expect(() => view.nodeDOM(0)).toThrow(HtmlDomMappingGapError);
  expect(() => view.domAtPos(0)).toThrowError(
    expect.objectContaining({ name: "HtmlDomMappingGapError", code: "html-dom-mapping-gap" })
  );
  expect(() => view.posAtDOM(unowned, 0)).toThrowError(
    expect.objectContaining({ name: "HtmlDomMappingGapError", code: "html-dom-mapping-gap" })
  );
}

/** Proves represented siblings cannot hide an unrepresented semantic child. */
function testCompactedBoundaryGap(): void {
  const schema = new Schema({
    nodes: {
      doc: { content: "block+" },
      paragraph: { content: "text*", group: "block", toDOM: () => ["p", 0] },
      missing: { group: "block" },
      text: {}
    }
  });
  const first = schema.node("paragraph", null, schema.text("a"));
  const gap = schema.node("missing");
  const last = schema.node("paragraph", null, schema.text("b"));
  const documentNode = schema.node("doc", null, [first, gap, last]);
  const view = createHtmlRetainedDocumentView({
    id: "html:compacted-gap",
    documentNode,
    ownerDocument: new FakeSvgMountDocument() as unknown as Document,
    source: { sourceId: "doc:body" }
  });
  const rootDOM = view.root.mount?.contentDOM;

  expect(rootDOM?.childNodes).toHaveLength(2);
  expect(view.posAtDOM(rootDOM!, 0)).toBe(0);
  expect(view.posAtDOM(rootDOM!, 2)).toBe(documentNode.content.size);
  expect(() => view.posAtDOM(rootDOM!, 1, -1)).toThrow(HtmlDomMappingGapError);
  expect(() => view.posAtDOM(rootDOM!, 1, 1)).toThrow(HtmlDomMappingGapError);
}

/** Proves repeated facade cleanup invokes root ownership release only once. */
function testDestroyOnce(): void {
  const fixture = createRuntimeFixture();
  const destroy = vi.spyOn(fixture.view.root, "destroy");

  fixture.view.destroy();
  fixture.view.destroy();

  expect(destroy).toHaveBeenCalledTimes(1);
  expect(fixture.view.root.destroyed).toBe(true);
  expect(() => fixture.view.domAtPos(1)).toThrow(HtmlDomMappingGapError);
}

/**
 * Creates a standard retained runtime fixture.
 *
 * @returns Schema, PM state, and persistent retained document view.
 */
function createRuntimeFixture() {
  const schema = new Schema({
    nodes: {
      doc: { content: "block+" },
      paragraph: { content: "text*", group: "block", toDOM: () => ["p", 0] },
      text: {}
    }
  });
  const documentNode = schema.node("doc", null, [
    schema.node("paragraph", null, schema.text("first")),
    schema.node("paragraph", null, schema.text("second"))
  ]);
  const state = EditorState.create({ schema, doc: documentNode });
  const view = createHtmlRetainedDocumentView({
    id: "html:runtime",
    documentNode,
    ownerDocument: new FakeSvgMountDocument() as unknown as Document,
    source: { sourceId: "doc:body" }
  });

  return { schema, state, view };
}
