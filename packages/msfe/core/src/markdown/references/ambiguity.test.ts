import { describe, expect, it } from "vitest";
import { ensureSyntaxTree, syntaxTree } from "@quirekit/cm-language";
import { createDocumentState } from "../../mount/state";
import { sourceDocument, sourceNode } from "../../source/authoring/adapter";
import { readSourceDestination } from "../../source/destination";
import { patchSourceDestination } from "../../source/patch";
import type { EditorState } from "@quirekit/cm-state";

/** @param state - Source snapshot. @returns Completed accepted state, never an independent display tree. */
function complete(state: EditorState): EditorState {
  expect(ensureSyntaxTree(state, state.doc.length, 3000)).not.toBeNull();
  return state.update({}).state;
}

/** @param state - Completed source. @returns Canonical link/image ranges and resolved destinations. */
function links(state: EditorState) {
  const result: { from: number; to: number; text: string; url: string }[] = [];
  syntaxTree(state).iterate({ enter(node) {
    if (!/^(?:Link|Image)$/u.test(node.name)) return;
    const value = readSourceDestination(sourceDocument(state), sourceNode(node.node));
    if (value) result.push({ from: node.from, to: node.to, text: state.sliceDoc(value.labelFrom, value.labelTo), url: value.url });
  } });
  return result;
}

describe("reference labels participate in the accepted grammar", () => {
  it.each([
    ["[foo][bar][baz]\n\n[baz]: /z", ["bar:/z"]],
    ["[foo][bar][baz]\n\n[foo]: /f\n[baz]: /z", ["bar:/z"]],
    ["[foo][bar][baz]\n\n[bar]: /b\n[baz]: /z", ["foo:/b", "baz:/z"]],
    ["[**foo**][bar][baz]\n\n[baz]: /z", ["bar:/z"]],
    ["![foo][bar][baz]\n\n[baz]: /z", ["bar:/z"]],
    ["[foo][bar](https://a.test)", ["bar:https://a.test"]],
    ["[outer [missing]][id]\n\n[id]: /outer", ["outer [missing]:/outer"]],
    ["[outer [inner](url)][id]\n\n[id]: /outer", ["inner:url", "id:/outer"]],
    ["[x][missing] [x][] [x]\n\n[x]: /x", ["x:/x", "x:/x"]],
  ])("resolves %s", (text, expected) => {
    expect(links(complete(createDocumentState(text, []))).map(value => `${value.text}:${value.url}`)).toEqual(expected);
  });

  it("changes grouping when a definition is added or removed and patches only the confirmed use", () => {
    const text = "[foo][bar][baz]\n\n[baz]: /z";
    let state = complete(createDocumentState(text, []));
    expect(links(state)[0]).toMatchObject({ from: 5, to: 15, text: "bar" });
    const node = syntaxTree(state).topNode.firstChild!.getChild("Link")!;
    const changes = patchSourceDestination(sourceDocument(state), sourceNode(node), { url: "/new" })!;
    expect(state.update({ changes }).state.doc.toString()).toBe("[foo][bar](/new)\n\n[baz]: /z");
    state = complete(state.update({ changes: { from: state.doc.length, insert: "\n[bar]: /b" } }).state);
    expect(links(state).map(value => value.text)).toEqual(["foo", "baz"]);
    state = complete(state.update({ changes: { from: text.length, to: state.doc.length } }).state);
    expect(links(state).map(value => value.text)).toEqual(["bar"]);
  });
});
