import { describe, expect, it, vi } from "vitest";
import { EditorState } from "@quirekit/cm-state";
import { markdown } from "@quirekit/cm-lang-markdown";
import { codeFolding, ensureSyntaxTree, foldedRanges } from "@quirekit/cm-language";
import { EditorView } from "@quirekit/cm-view";
import { TaskScope, type ComponentView, type MsfeEditor, type MsfeViewStateUpdate } from "@quirekit/msfe-core";
import { headingFolding } from "./extension";
import { headingFoldSnapshot, headingFoldSupport } from "./state";
import type { HeadingFoldControlProps } from "../types";

const DOC = "# One\n\nbody\n\n# Two\n\nend";

/** @param doc - Fixture source. @returns Fully parsed source with native folding. */
function parsed(doc = DOC): EditorState {
  const state = EditorState.create({ doc, extensions: [markdown(), codeFolding(), headingFoldSnapshot.extension, headingFoldSupport] });
  ensureSyntaxTree(state, doc.length, 1000);
  return state.update({}).state;
}

/** @param editor - Owner handed to the extension. @param controls - Optional host control. @returns The layer's build function for a given state. */
function layerBuilder(editor: () => MsfeEditor, controls?: (mount: { props: HeadingFoldControlProps }) => { update(props: HeadingFoldControlProps): void; destroy(): void }) {
  const extension = headingFolding({ folding: true, levels: [1, 2, 3, 4, 5, 6], toggleLabel: (expanded: boolean, title: string) => `${expanded}:${title}`, ...(controls ? { controls } : {}) } as never, "heading", editor);
  const layer = extension.layers![0]!;
  return (state: EditorState) => layer.build({
    getState: () => headingFoldSnapshot.read(state), from: 0, to: state.doc.length,
    query: () => ({ matches: state.doc.toString().split("\n").reduce<{ list: { from: number }[]; at: number }>((all, line) => {
      if (line.startsWith("#")) all.list.push({ from: all.at });
      all.at += line.length + 1;
      return all;
    }, { list: [], at: 0 }).list }),
  } as never) as unknown as { from: number; view: ComponentView }[];
}

describe("heading fold controls", () => {
  it("keep the same view inputs when an edit leaves their display unchanged", () => {
    const build = layerBuilder(() => ({}) as MsfeEditor), before = parsed();
    const first = build(before), second = build(before.update({ changes: { from: DOC.indexOf("body"), insert: "x" } }).state);
    expect(second).toHaveLength(2);
    expect(second.map(item => item.view.props)).toEqual(first.map(item => item.view.props));
    second.forEach((item, index) => { expect(item.view.props).toBe(first[index]!.view.props); expect(item.view.renderer).toBe(first[index]!.view.renderer); });
  });

  it("publish new inputs when the title changes", () => {
    const build = layerBuilder(() => ({}) as MsfeEditor), before = parsed();
    const [first] = build(before), [second] = build(before.update({ changes: { from: 2, insert: "New " } }).state);
    expect(second!.view.props).not.toBe(first!.view.props);
    expect(second!.view.props).toMatchObject({ label: "true:New One" });
  });

  it("toggle the heading at the control's current position, not its position when built", () => {
    let state = parsed();
    const scope = new TaskScope(), documentScope = scope.fork();
    const editor = { scope, documentScope, get state() { return state; },
      updateViewState(update: MsfeViewStateUpdate) { state = state.update(update).state; return { ok: true }; } } as unknown as MsfeEditor;
    let received: HeadingFoldControlProps | undefined;
    const build = layerBuilder(() => editor, mount => { received = mount.props; return { update(next) { received = next; }, destroy() {} }; });
    const [, second] = build(state);
    second!.view.renderer({ dom: {} as HTMLElement, props: second!.view.props, host: undefined, scope, requestMeasure() {} } as never);

    state = state.update({ changes: { from: 0, insert: "lead\n\n" } }).state;
    ensureSyntaxTree(state, state.doc.length, 1000);
    state = state.update({}).state;
    const moved = state.doc.toString().indexOf("# Two");
    const find = vi.spyOn(EditorView, "findFromDOM").mockReturnValue({ posAtDOM: () => moved } as unknown as EditorView);
    received!.toggle();
    find.mockRestore();

    let folded = 0;
    foldedRanges(state).between(0, state.doc.length, from => { folded = from; });
    expect(folded).toBe(moved + "# Two".length);
  });
});
