import { Decoration, DecorationSet, Schema } from "@quirekit/pm";
import { describe, expect, it } from "vitest";
import type { QuireMountedEditorView } from "@quirekit/view/mounted-backend";
import { FakeSvgMountDocument } from "@quirekit/view/test-support/svg-mount";
import { createHtmlRetainedDocumentView } from "../../document/runtime";
import { resolveHtmlContainerTarget } from "./targets";

describe("retained inline targets", () => {
  it("resolves the exact run suffix inside an inline decoration and mark", () => {
    const schema = new Schema({ nodes: { doc: { content: "paragraph+" },
      paragraph: { content: "text*", toDOM: () => ["p", 0] }, text: {} },
    marks: { strong: { toDOM: () => ["strong", 0] } } });
    const doc = schema.node("doc", null, schema.node("paragraph", null, schema.text("abcdef", [schema.marks.strong!.create()])));
    const decorations = DecorationSet.create(doc, [Decoration.inline(3, 5, { class: "highlight" })]);
    const view = createHtmlRetainedDocumentView({ id: "inline-target", documentNode: doc,
      ownerDocument: new FakeSvgMountDocument() as unknown as Document, source: { sourceId: "body" },
      nodeViewEnvironment: { view: {} as QuireMountedEditorView, nodeViews: {}, markViews: {}, getDecorations: () => decorations } });
    try {
      const owners = view.descriptorsInRange({ from: 3, to: 5 }).filter(owner => owner.range.from === 3 && owner.range.to === 5);
      const wrappers = owners.filter(owner => owner.kind === "mark" || owner.kind === "inline-decoration");
      expect(wrappers).toHaveLength(2);
      for (const wrapper of wrappers) {
        expect(resolveHtmlContainerTarget(wrapper, doc)?.node.text).toBe("cd");
        wrapper.range = { from: 3, to: 8 };
        expect(resolveHtmlContainerTarget(wrapper, doc)).toBeNull();
      }
    } finally {
      view.destroy();
    }
  });
});
