// @vitest-environment happy-dom
import { createApp, h, nextTick, ref, shallowRef } from "vue";
import { afterEach, expect, it, vi } from "vitest";
import { ensureSyntaxTree } from "@quirekit/cm-language";
import { EditorSelection } from "@quirekit/cm-state";
import { createMdEditor } from "../../editor";
import Insertion from "./insertion.vue";

const cleanups: Array<() => void> = [];
const table = "| a | b |\n| --- | --- |\n| one | two |";
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); document.body.replaceChildren(); });

/** @returns A mounted mobile insertion task over a real table selection and source history. */
async function fixture() {
  const source = document.createElement("div"), host = document.createElement("div");
  document.body.append(source, host);
  const editor = createMdEditor({ parent: source, markdown: table });
  expect(ensureSyntaxTree(editor.state, editor.state.doc.length, 5000)).not.toBeNull();
  editor.run(() => ({ selection: EditorSelection.cursor(table.indexOf("one") + 1) }));
  const state = shallowRef(editor.state), open = ref(true);
  const app = createApp({ render: () => h(Insertion, { editor, state: state.value, open: open.value, locale: "zh-CN",
    "onUpdate:open": value => { open.value = value; } }) });
  app.mount(host);
  cleanups.push(() => { app.unmount(); editor.destroy(); });
  await nextTick();
  return { editor, state, open };
}

/** @param label - Visible product action. @returns Its mounted public button. */
async function button(label: string): Promise<HTMLButtonElement> {
  let found: HTMLButtonElement | undefined;
  await vi.waitFor(() => {
    found = [...document.querySelectorAll<HTMLButtonElement>("button")].find(value => value.textContent?.trim() === label || value.getAttribute("aria-label") === label);
    expect(found).toBeDefined();
  });
  return found!;
}

it("explains a restricted position and inserts after the complete table with one undo", async () => {
  const { editor, open } = await fixture();
  expect(document.body.textContent).toContain("表格单元格仅支持行内内容");
  (await button("在表格后插入")).click(); await nextTick();
  (await button("分隔线")).click();
  await vi.waitFor(() => expect(open.value).toBe(false));
  expect(editor.getMarkdown()).toBe(`${table}\n\n***`);
  editor.undo(); expect(editor.getMarkdown()).toBe(table);
  expect(editor.history.canUndo).toBe(false);
});

it("returns from a chosen boundary and dismisses without creating a placeholder", async () => {
  const { editor, open } = await fixture();
  (await button("在表格前插入")).click(); await nextTick();
  (await button("返回")).click(); await nextTick();
  expect(document.body.textContent).toContain("表格单元格仅支持行内内容");
  open.value = false; await nextTick();
  expect(editor.getMarkdown()).toBe(table);
  expect(editor.history.canUndo).toBe(false);
});

it("keeps a parameter draft after the original block changes, without inserting at the new caret", async () => {
  const { editor, state, open } = await fixture();
  (await button("在表格后插入")).click(); await nextTick();
  (await button("图片")).click(); await nextTick();
  const input = document.querySelector<HTMLInputElement>('input[placeholder="https://example.com/…"]')!;
  expect(input).not.toBeNull();
  input.value = "https://example.com";
  input.dispatchEvent(new Event("input", { bubbles: true })); await nextTick();
  editor.run(() => ({ changes: { from: table.indexOf("one"), insert: "changed" }, selection: EditorSelection.cursor(0) }));
  state.value = editor.state; await nextTick();
  const before = editor.getMarkdown();
  (await button("确定")).click(); await nextTick();
  expect(editor.getMarkdown()).toBe(before);
  expect(open.value).toBe(true);
  expect(input.value).toBe("https://example.com");
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("原内容已更改");
});
