import {
  createEditor,
  type QuireMountedEditorView,
  type QuireNodeViewMap
} from "@quirekit/core";
import { StarterKit } from "@quirekit/starter-kit";
import { DecorationSet } from "@quirekit/pm";
import { describe, expect, it, vi } from "vitest";
import { FakeSvgMountDocument, type FakeSvgMountElement } from "@quirekit/view/test-support/svg-mount";
import { createHtmlRetainedDocumentView } from "./runtime";
import { createHtmlDocumentCompositionRuntime } from "./composition";

describe("retained HTML document composition", () => {
  it("resolves positions after the preedit in the suffix that holds their text", () => {
    const fixture = createFixture("abcd");
    const runtime = createHtmlDocumentCompositionRuntime({
      documentView: fixture.view,
      resolveDomPoint: (pos, side) => fixture.view.domAtPos(pos, side),
      ownerDocument: fixture.ownerDocument as unknown as Document,
      rootId: "html:root",
      regionId: "html:body"
    });
    const canonical = fixture.view.domAtPos(4);
    expect(runtime.projectDomPoint(canonical)).toBe(canonical);

    runtime.sync({ range: { from: 2, to: 2 }, text: "ni" }, presentation());
    const projected = runtime.projectDomPoint(canonical);
    expect(projected.node.nodeValue).toBe("bcd");
    expect(projected.offset).toBe(2);
    const prefix = fixture.view.domAtPos(2);
    expect(runtime.projectDomPoint(prefix)).toBe(prefix);

    runtime.sync(undefined, presentation());
    expect(runtime.projectDomPoint(canonical)).toBe(canonical);
  });

  it("inserts, updates, measures, and cancels one in-flow preedit session", () => {
    const fixture = createFixture("abc");
    const text = fixture.view.domAtPos(2).node as unknown as FakeSvgMountElement;
    const runtime = createHtmlDocumentCompositionRuntime({
      documentView: fixture.view,
      resolveDomPoint: (pos, side) => fixture.view.domAtPos(pos, side),
      ownerDocument: fixture.ownerDocument as unknown as Document,
      rootId: "html:root",
      regionId: "html:body"
    });

    const first = runtime.sync(
      { range: { from: 2, to: 2 }, text: "ni" },
      presentation()
    );
    const firstDescriptor = runtime.descriptor;

    expect(first.active).toBe(true);
    expect(text.nodeValue).toBe("a");
    expect(firstDescriptor?.textDOM.nodeValue).toBe("ni");
    expect(text.parentNode?.children.map((child) => child.textContent)).toEqual([
      "a",
      "",
      "bc"
    ]);
    expect(runtime.inputAnchor()?.left).toBe(16);

    runtime.sync(
      { range: { from: 2, to: 2 }, text: "nihao" },
      presentation()
    );
    expect(runtime.descriptor).toBe(firstDescriptor);
    expect(runtime.descriptor?.textDOM.nodeValue).toBe("nihao");

    const cancelled = runtime.sync(undefined, presentation());
    expect(cancelled.active).toBe(false);
    expect(text.nodeValue).toBe("abc");
    expect(text.parentNode?.children).toEqual([text]);
  });

  it("maps an active session across an unrelated document transaction", () => {
    const fixture = createFixture("abc");
    const runtime = createHtmlDocumentCompositionRuntime({
      documentView: fixture.view,
      resolveDomPoint: (pos, side) => fixture.view.domAtPos(pos, side),
      ownerDocument: fixture.ownerDocument as unknown as Document,
      rootId: "html:root",
      regionId: "html:body"
    });
    runtime.sync(
      { range: { from: 3, to: 3 }, text: "hao" },
      presentation()
    );
    const paragraphDOM = fixture.view.root.children[0]!.mount!.dom;
    const transaction = fixture.editor.state.pm.tr.insertText("X", 1);
    fixture.editor.view.dispatch(transaction);

    const mapped = runtime.prepareDocumentUpdate(transaction.mapping, true);
    fixture.view.update({
      documentNode: fixture.editor.state.doc,
      mapping: transaction.mapping,
      changedRanges: [{ oldRange: { from: 1, to: 1 }, newRange: { from: 1, to: 2 } }]
    });
    runtime.sync(mapped, presentation());

    expect(mapped?.range).toEqual({ from: 4, to: 4 });
    expect(runtime.descriptor?.range).toEqual({ from: 4, to: 4 });
    expect(runtime.descriptor?.textDOM.nodeValue).toBe("hao");
    expect(fixture.view.root.children[0]!.mount!.dom).toBe(paragraphDOM);
    expect(runtime.getDiagnostics().gaps).toBe(0);
  });

  it("inherits the exact retained mark flow without remounting its wrapper", () => {
    const ownerDocument = new FakeSvgMountDocument();
    const editor = createEditor({
      extensions: [StarterKit],
      content: {
        type: "doc",
        content: [{
          type: "paragraph",
          content: [{ type: "text", marks: [{ type: "bold" }], text: "abc" }]
        }]
      }
    });
    const view = createHtmlRetainedDocumentView({
      id: "marked-composition-document",
      documentNode: editor.state.doc,
      ownerDocument: ownerDocument as unknown as Document,
      source: { sourceId: "marked-composition-document" }
    });
    const textDOM = view.domAtPos(2).node;
    const markDOM = textDOM.parentNode;
    const runtime = createHtmlDocumentCompositionRuntime({
      documentView: view,
      resolveDomPoint: (pos, side) => view.domAtPos(pos, side),
      ownerDocument: ownerDocument as unknown as Document,
      rootId: "html:root",
      regionId: "html:body"
    });

    runtime.sync(
      { range: { from: 2, to: 2 }, text: "ni" },
      presentation()
    );

    expect(runtime.descriptor?.mount?.dom.parentNode).toBe(markDOM);
    expect(textDOM.parentNode).toBe(markDOM);
    runtime.sync(undefined, presentation());
    expect(textDOM.parentNode).toBe(markDOM);
  });

  it("maps composition across a transaction without remounting its NodeView", () => {
    const ownerDocument = new FakeSvgMountDocument();
    const editor = createEditor({
      extensions: [StarterKit],
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "abc" }] }]
      }
    });
    const nodeViewDOM = ownerDocument.createElement("section");
    const contentDOM = ownerDocument.createElement("div");
    const factory = vi.fn(() => ({ dom: nodeViewDOM, contentDOM }));
    nodeViewDOM.appendChild(contentDOM);
    const view = createHtmlRetainedDocumentView({
      id: "node-view-composition-document",
      documentNode: editor.state.doc,
      ownerDocument: ownerDocument as unknown as Document,
      source: { sourceId: "node-view-composition-document" },
      nodeViewEnvironment: {
        view: { dom: ownerDocument.createElement("div") } as unknown as QuireMountedEditorView,
        nodeViews: {
          paragraph: factory as unknown as QuireNodeViewMap[string]
        },
        markViews: {},
        getDecorations: () => DecorationSet.empty
      }
    });
    const descriptor = view.root.children[0];
    const runtime = createHtmlDocumentCompositionRuntime({
      documentView: view,
      resolveDomPoint: (pos, side) => view.domAtPos(pos, side),
      ownerDocument: ownerDocument as unknown as Document,
      rootId: "html:root",
      regionId: "html:body"
    });
    runtime.sync(
      { range: { from: 3, to: 3 }, text: "hao" },
      presentation()
    );
    const transaction = editor.state.pm.tr.insertText("X", 1);
    editor.dispatchTransaction(transaction);
    const mapped = runtime.prepareDocumentUpdate(transaction.mapping, true);

    view.update({
      documentNode: editor.state.doc,
      mapping: transaction.mapping,
      changedRanges: [{ oldRange: { from: 1, to: 1 }, newRange: { from: 1, to: 2 } }]
    });
    runtime.sync(mapped, presentation());

    expect(view.root.children[0]).toBe(descriptor);
    expect(view.root.children[0]?.mount?.dom).toBe(nodeViewDOM);
    expect(factory).toHaveBeenCalledOnce();
  });

  it("ends a stale session instead of inventing a replacement owner", () => {
    const fixture = createFixture("abc");
    const gaps: string[] = [];
    const runtime = createHtmlDocumentCompositionRuntime({
      documentView: fixture.view,
      resolveDomPoint: (pos, side) => fixture.view.domAtPos(pos, side),
      ownerDocument: fixture.ownerDocument as unknown as Document,
      rootId: "html:root",
      regionId: "html:body",
      onGap: (message) => gaps.push(message)
    });

    const result = runtime.sync(
      { range: { from: 99, to: 99 }, text: "stale" },
      presentation()
    );

    expect(result.active).toBe(false);
    expect(runtime.descriptor).toBeUndefined();
    expect(runtime.getDiagnostics().gaps).toBe(1);
    expect(gaps[0]).toContain("99");
  });
});

/** Creates one retained paragraph fixture. */
function createFixture(text: string): {
  readonly editor: ReturnType<typeof createEditor>;
  readonly ownerDocument: FakeSvgMountDocument;
  readonly view: ReturnType<typeof createHtmlRetainedDocumentView>;
} {
  const ownerDocument = new FakeSvgMountDocument();
  const editor = createEditor({
    extensions: [StarterKit],
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }]
    }
  });
  const view = createHtmlRetainedDocumentView({
    id: "composition-document",
    documentNode: editor.state.doc,
    ownerDocument: ownerDocument as unknown as Document,
    source: { sourceId: "composition-document" }
  });
  return { editor, ownerDocument, view };
}

/** Creates the standard composition presentation fixture. */
function presentation(): {
  readonly background: boolean;
  readonly backgroundFillStyle: string;
  readonly underline: boolean;
} {
  return {
    background: true,
    backgroundFillStyle: "rgba(191, 219, 254, 0.55)",
    underline: true
  };
}
