import { getChangedRanges, type QuireNodeViewMap } from "@quirekit/core";
import { Decoration, DecorationSet, EditorState, Schema } from "@quirekit/pm";
import { describe, expect, it, vi } from "vitest";
import { FakeSvgMountDocument, FakeSvgMountElement } from "@quirekit/view/test-support/svg-mount";
import type { QuireMountedEditorView } from "@quirekit/view/mounted-backend";
import { createHtmlRetainedDocumentView } from "../runtime";
import { createHtmlMutationBoundary } from "./runtime";

describe("retained HTML mutation boundary", () => {
  it("refreshes one authorized text snapshot without reading unchanged siblings", () => {
    const fixture = createFixture();
    const records: MutationRecord[] = [];
    const boundary = createHtmlMutationBoundary({
      contentSurface: fixture.contentSurface,
      root: fixture.view.root,
      observerFactory: () => ({ observe: vi.fn(), disconnect: vi.fn(), takeRecords: () => records.splice(0) })
    });
    const sibling = fixture.view.root.children[1]!.mount!.dom as Element;
    const attributes = vi.spyOn(sibling, "getAttributeNames");

    fixture.textDOM.nodeValue = "accepted";
    records.push(createRecord("characterData", fixture.textDOM));
    boundary.drainOwnedWrites({ ownershipChanged: false });
    expect(attributes).not.toHaveBeenCalled();

    fixture.textDOM.nodeValue = "foreign";
    boundary.process([createRecord("characterData", fixture.textDOM)]);
    expect(fixture.textDOM.nodeValue).toBe("accepted");
    boundary.destroy();
  });

  it("keeps the authority snapshot when an authorized phase has no DOM writes", () => {
    const fixture = createFixture();
    const boundary = createHtmlMutationBoundary({
      contentSurface: fixture.contentSurface, root: fixture.view.root,
      observerFactory: () => ({ observe: vi.fn(), disconnect: vi.fn(), takeRecords: () => [] })
    });
    const attributes = vi.spyOn(fixture.view.root.children[0]!.mount!.dom as Element, "getAttributeNames");
    boundary.drainOwnedWrites({ ownershipChanged: false });
    expect(attributes).not.toHaveBeenCalled();
    fixture.textDOM.nodeValue = "foreign";
    boundary.process([createRecord("characterData", fixture.textDOM)]);
    expect(fixture.textDOM.nodeValue).toBe("first");
    boundary.destroy();
  });

  it("classifies pending external writes before an authorized update begins", () => {
    const fixture = createFixture();
    const records: MutationRecord[] = [];
    const boundary = createHtmlMutationBoundary({
      contentSurface: fixture.contentSurface, root: fixture.view.root,
      observerFactory: () => ({ observe: vi.fn(), disconnect: vi.fn(), takeRecords: () => records.splice(0) })
    });
    fixture.textDOM.nodeValue = "foreign before input";
    records.push(createRecord("characterData", fixture.textDOM));
    boundary.beginOwnedWrites();
    expect(fixture.textDOM.nodeValue).toBe("first");
    fixture.textDOM.nodeValue = "accepted";
    records.push(createRecord("characterData", fixture.textDOM));
    boundary.drainOwnedWrites({ ownershipChanged: false });
    fixture.textDOM.nodeValue = "foreign after input";
    boundary.process([createRecord("characterData", fixture.textDOM)]);
    expect(fixture.textDOM.nodeValue).toBe("accepted");
    boundary.destroy();
  });

  it("captures added subtrees and retires removed children from the recovery authority", () => {
    const fixture = createFixture();
    const records: MutationRecord[] = [];
    const boundary = createHtmlMutationBoundary({
      contentSurface: fixture.contentSurface, root: fixture.view.root,
      observerFactory: () => ({ observe: vi.fn(), disconnect: vi.fn(), takeRecords: () => records.splice(0) })
    });
    const state = EditorState.create({ doc: fixture.view.root.node });
    const added = state.schema.node("paragraph", null, state.schema.text("third"));
    const insertion = state.tr.insert(state.doc.content.size, added);
    fixture.view.update({ documentNode: insertion.doc, mapping: insertion.mapping, changedRanges: getChangedRanges(insertion) });
    const root = fixture.view.root.mount!.dom;
    const child = root.childNodes[root.childNodes.length - 1]!;
    records.push({ type: "childList", target: root, addedNodes: [child] } as unknown as MutationRecord);
    boundary.drainOwnedWrites({ ownershipChanged: true });
    child.firstChild!.nodeValue = "foreign";
    boundary.process([createRecord("characterData", child.firstChild!)]);
    expect(child.firstChild!.nodeValue).toBe("third");

    const removal = state.apply(insertion).tr.delete(state.doc.content.size, insertion.doc.content.size);
    fixture.view.update({ documentNode: removal.doc, mapping: removal.mapping, changedRanges: getChangedRanges(removal) });
    records.push({ type: "childList", target: root, addedNodes: [] } as unknown as MutationRecord);
    boundary.drainOwnedWrites({ ownershipChanged: true });
    root.appendChild(child);
    boundary.process([createRecord("childList", root)]);
    expect(root.childNodes).toHaveLength(2);
    expect(child.parentNode).toBeNull();
    boundary.destroy();
  });

  it("preserves canonical child recovery while refreshing one element's attributes", () => {
    const fixture = createFixture();
    const records: MutationRecord[] = [];
    const boundary = createHtmlMutationBoundary({
      contentSurface: fixture.contentSurface, root: fixture.view.root,
      observerFactory: () => ({ observe: vi.fn(), disconnect: vi.fn(), takeRecords: () => records.splice(0) })
    });
    const paragraph = fixture.view.root.children[0]!.mount!.dom as Element;
    paragraph.setAttribute("data-value", "accepted");
    records.push(createRecord("attributes", paragraph));
    boundary.drainOwnedWrites({ ownershipChanged: false });
    paragraph.setAttribute("data-value", "foreign");
    paragraph.removeChild(fixture.textDOM);
    boundary.process([createRecord("attributes", paragraph), createRecord("childList", paragraph)]);
    expect(paragraph.getAttribute("data-value")).toBe("accepted");
    expect(fixture.textDOM.parentNode).toBe(paragraph);
    expect(fixture.textDOM.nodeValue).toBe("first");
    boundary.destroy();
  });

  it("retains complete capture when an observer is unavailable", () => {
    const fixture = createFixture();
    const boundary = createHtmlMutationBoundary({ contentSurface: fixture.contentSurface, root: fixture.view.root });
    fixture.textDOM.nodeValue = "accepted";
    boundary.drainOwnedWrites({ ownershipChanged: false });
    fixture.textDOM.nodeValue = "foreign";
    boundary.process([createRecord("characterData", fixture.textDOM)]);
    expect(fixture.textDOM.nodeValue).toBe("accepted");
    boundary.destroy();
  });

  it("drains observer records produced by authorized writes", () => {
    const fixture = createFixture();
    const takeRecords = vi.fn(() => [createRecord("characterData", fixture.textDOM)]);
    const boundary = createHtmlMutationBoundary({
      contentSurface: fixture.contentSurface,
      root: fixture.view.root,
      observerFactory: () => ({ observe: vi.fn(), disconnect: vi.fn(), takeRecords })
    });

    boundary.drainOwnedWrites();

    expect(takeRecords).toHaveBeenCalledOnce();
    expect(boundary.getDiagnostics().ownedRecordsDrained).toBe(1);
    expect(boundary.getDiagnostics().recoveries).toBe(0);
  });

  it("restores only the smallest unauthorized owner scope", () => {
    const fixture = createFixture();
    const sibling = fixture.view.root.children[1]?.mount?.dom;
    const boundary = createHtmlMutationBoundary({
      contentSurface: fixture.contentSurface,
      root: fixture.view.root
    });

    fixture.textDOM.nodeValue = "browser edit";
    boundary.process([createRecord("characterData", fixture.textDOM)]);

    expect(fixture.textDOM.nodeValue).toBe("first");
    expect(fixture.view.root.children[1]?.mount?.dom).toBe(sibling);
    expect(boundary.getDiagnostics().recoveries).toBe(1);
  });

  it("offers NodeView-owned mutations to ignoreMutation", () => {
    const ownerDocument = new FakeSvgMountDocument();
    const schema = createSchema("card");
    const ignored = vi.fn(() => true);
    const factory = (() => {
      const dom = ownerDocument.createElement("article");
      return { dom, ignoreMutation: ignored };
    }) as unknown as QuireNodeViewMap[string];
    const view = createHtmlRetainedDocumentView({
      id: "mutation:node-view",
      documentNode: schema.node("doc", null, [schema.node("card")]),
      ownerDocument: ownerDocument as unknown as Document,
      source: { sourceId: "mutation:node-view" },
      nodeViewEnvironment: {
        view: { dom: ownerDocument.createElement("main") } as unknown as QuireMountedEditorView,
        nodeViews: { card: factory },
        markViews: {},
        getDecorations: () => DecorationSet.empty
      }
    });
    const contentSurface = ownerDocument.createElement("div");
    const nodeViewDOM = view.root.children[0]!.mount!.dom;
    contentSurface.appendChild(view.root.mount!.dom as unknown as FakeSvgMountElement);
    const boundary = createHtmlMutationBoundary({
      contentSurface: contentSurface as unknown as HTMLElement,
      root: view.root
    });

    boundary.process([createRecord("attributes", nodeViewDOM)]);

    expect(ignored).toHaveBeenCalledOnce();
    expect(boundary.getDiagnostics().ignoredNodeViewRecords).toBe(1);
    expect(boundary.getDiagnostics().recoveries).toBe(0);
  });

  it("preserves widget chrome updates while its parent retains placement and prose authority", () => {
    const fixture = createFixture(true);
    const widget = fixture.widgetDOM!;
    const boundary = createHtmlMutationBoundary({ contentSurface: fixture.contentSurface, root: fixture.view.root });
    widget.setAttribute("aria-label", "Collapse section");
    const child = widget.ownerDocument.createElement("span");
    widget.appendChild(child);
    boundary.process([createRecord("attributes", widget as unknown as Node), createRecord("childList", widget as unknown as Node)]);
    expect(widget.getAttribute("aria-label")).toBe("Collapse section");
    expect(widget.childNodes).toContain(child);
    expect(boundary.getDiagnostics().ignoredWidgetRecords).toBe(2);
    expect(boundary.getDiagnostics().recoveries).toBe(0);

    const parent = widget.parentNode!;
    parent.removeChild(widget);
    boundary.process([createRecord("childList", parent as unknown as Node)]);
    expect(widget.parentNode).toBe(parent);
    fixture.textDOM.nodeValue = "unauthorized edit";
    boundary.process([createRecord("characterData", fixture.textDOM)]);
    expect(fixture.textDOM.nodeValue).toBe("first");
    expect(boundary.getDiagnostics().recoveries).toBe(2);
  });

  it("restores an externally replaced immortal root and bounds retries", () => {
    const fixture = createFixture();
    const boundary = createHtmlMutationBoundary({
      contentSurface: fixture.contentSurface,
      root: fixture.view.root,
      maxRecoveriesPerOwner: 2
    });
    const rootDOM = fixture.view.root.mount!.dom;

    fixture.contentSurface.removeChild(rootDOM);
    boundary.process([createRecord("childList", fixture.contentSurface)]);
    expect(fixture.contentSurface.childNodes[0]).toBe(rootDOM);

    fixture.textDOM.nodeValue = "one";
    boundary.process([createRecord("characterData", fixture.textDOM)]);
    fixture.textDOM.nodeValue = "two";
    boundary.process([createRecord("characterData", fixture.textDOM)]);
    fixture.textDOM.nodeValue = "three";
    boundary.process([createRecord("characterData", fixture.textDOM)]);

    expect(boundary.getDiagnostics().rootReplacements).toBe(1);
    expect(boundary.getDiagnostics().recoveryLimitHits).toBe(1);
  });
});

/** @param withWidget - Includes a control owned by a keyed widget. @returns A two-block retained document fixture. */
function createFixture(withWidget = false) {
  const ownerDocument = new FakeSvgMountDocument();
  const schema = createSchema("paragraph");
  const documentNode = schema.node("doc", null, [
    schema.node("paragraph", null, schema.text("first")),
    schema.node("paragraph", null, schema.text("second"))
  ]);
  const widgetDOM = withWidget ? ownerDocument.createElement("button") : undefined;
  widgetDOM?.setAttribute("aria-label", "折叠章节");
  const view = createHtmlRetainedDocumentView({
    id: "mutation:document",
    documentNode,
    ownerDocument: ownerDocument as unknown as Document,
    source: { sourceId: "mutation:document" },
    ...(widgetDOM ? { nodeViewEnvironment: {
      view: { dom: ownerDocument.createElement("main") } as unknown as QuireMountedEditorView,
      nodeViews: {}, markViews: {},
      getDecorations: () => DecorationSet.create(documentNode, [Decoration.widget(1, widgetDOM as unknown as HTMLElement, { key: "control" })])
    } } : {})
  });
  const contentSurface = ownerDocument.createElement("div");
  contentSurface.appendChild(view.root.mount!.dom as unknown as FakeSvgMountElement);
  const first = view.root.children[0]!;
  const textDOM = first.kind === "node" ? first.children.find(child => child.kind === "text")!.mount!.dom : null;
  if (!textDOM) {
    throw new Error("Expected retained text DOM.");
  }
  return { view, contentSurface: contentSurface as unknown as HTMLElement, textDOM, widgetDOM };
}

/** Creates a schema with one named block node. */
function createSchema(nodeName: "paragraph" | "card"): Schema {
  if (nodeName === "card") {
    return new Schema({
      nodes: {
        doc: { content: "block+" },
        card: { group: "block", toDOM: () => ["article"] },
        text: {}
      }
    });
  }
  return new Schema({
    nodes: {
      doc: { content: "block+" },
      paragraph: {
        content: "text*",
        group: "block",
        toDOM: () => ["p", 0]
      },
      text: {}
    }
  });
}

/** Creates the narrow MutationRecord facts consumed by the boundary. */
function createRecord(type: MutationRecordType, target: Node): MutationRecord {
  return { type, target } as MutationRecord;
}
