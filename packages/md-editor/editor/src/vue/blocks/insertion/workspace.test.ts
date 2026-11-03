// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { ensureSyntaxTree } from "@quirekit/cm-language";
import { EditorSelection } from "@quirekit/cm-state";
import { dataViewMarkdown, serializeDataView, type DataViewEditRequest } from "@quirekit/data-view";
import type { MsfeEditor } from "@quirekit/msfe-core";
import { createMdEditor } from "../../../editor";
import { captureAdjacentInsertion } from "./adjacent";
import { createBlockInsertionWriter } from "./writer";
import { openBlockWorkspace } from "./workspace";

const opened = vi.hoisted(() => ({ request: null as DataViewEditRequest | null }));
vi.mock("../../data-view/open", () => ({
  openMdDataView: (request: DataViewEditRequest) => {
    opened.request = request;
    return { close: () => request.release() };
  },
}));
const editors: MsfeEditor[] = [];
const source = "| a | b |\n| --- | --- |\n| one | two |";
/** @returns Real block writer and a captured data workspace, without opening another editor surface. */
function fixture() {
  const parent = document.createElement("div"); document.body.append(parent);
  const editor = createMdEditor({ parent, markdown: source }); editors.push(editor);
  expect(ensureSyntaxTree(editor.state, editor.state.doc.length, 5000)).not.toBeNull();
  editor.setSelection(EditorSelection.single(source.indexOf("one") + 1));
  const adjacent = captureAdjacentInsertion(editor, editor.captureTarget())!;
  const writer = createBlockInsertionWriter({ ...adjacent.target("after")!, value: "dataView" })!;
  adjacent.release();
  const task = openBlockWorkspace("dataView", editor, writer, () => writer.release());
  return { editor, task, request: opened.request! };
}
afterEach(() => { editors.splice(0).forEach(editor => editor.destroy()); document.body.replaceChildren(); opened.request = null; });

it("opens an adjacent data view draft and commits one validated fence with one undo", async () => {
  const { editor, task, request } = fixture();
  expect(task).not.toBeNull(); expect(editor.getMarkdown()).toBe(source);
  const base = serializeDataView(request.value);
  expect(await request.commit({ base: "stale", value: request.value })).toMatchObject({ accepted: false });
  expect(await request.commit({ base, value: { ...request.value, id: "other" } })).toMatchObject({ accepted: false });
  expect(await request.commit({ base, value: request.value })).toMatchObject({ accepted: true });
  expect(editor.getMarkdown()).toBe(`${source}\n\n${dataViewMarkdown(request.value)}`);
  expect(await request.commit({ base, value: request.value })).toMatchObject({ accepted: false });
  editor.undo(); expect(editor.getMarkdown()).toBe(source); expect(editor.history.canUndo).toBe(false);
  task!.close();
});
it("cancels without placeholders and refuses a changed original table", async () => {
  for (const reason of ["cancel", "touch"]) {
    const { editor, task, request } = fixture();
    expect(task).not.toBeNull();
    if (reason === "cancel") task!.close();
    else editor.run(() => ({ changes: { from: source.indexOf("one"), insert: "changed" } }));
    const before = editor.getMarkdown();
    expect(await request.commit({ base: serializeDataView(request.value), value: request.value })).toMatchObject({ accepted: false });
    expect(editor.getMarkdown()).toBe(before); task!.close();
  }
});
