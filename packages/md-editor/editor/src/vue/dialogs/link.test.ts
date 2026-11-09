// @vitest-environment happy-dom
import { createApp, h, nextTick, shallowRef } from "vue";
import { afterEach, expect, it, vi } from "vitest";
import { EditorSelection } from "@quirekit/cm-state";
import { EditorView } from "@quirekit/cm-view";
import MdEditor from "../editor.vue";
import type { MdEditorInstance } from "../types";

let cleanup = (): void => {};
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.body.replaceChildren(); });

/** @param label - Exact public action. @returns Mounted button. */
async function button(label: string): Promise<HTMLButtonElement> {
  let found: HTMLButtonElement | undefined;
  await vi.waitFor(() => {
    const scope = document.querySelector("[data-md-destination]")?.closest('[role="dialog"]') ?? document;
    found = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(value => value.getAttribute("aria-label") === label || value.textContent?.trim() === label);
    expect(found).toBeDefined();
  });
  return found!;
}

/** @param markdown - Source fixture. @returns Mounted product and canonical editor. */
async function mount(markdown: string) {
  Object.defineProperty(document, "fonts", { configurable: true, value: Object.assign(new EventTarget(), { ready: Promise.resolve(), load: () => Promise.resolve([]) }) });
  const host = document.createElement("div"); document.body.append(host);
  const product = shallowRef<MdEditorInstance>();
  const app = createApp({ render: () => h(MdEditor, { ref: product, markdown, selectionToolbar: true }) });
  cleanup = () => app.unmount(); app.mount(host); await nextTick();
  await vi.waitFor(() => expect(product.value?.editor).toBeTruthy());
  return product.value!.editor!;
}

/** @param value - User's address draft. */
async function address(value: string): Promise<void> {
  const input = document.querySelector<HTMLInputElement>("[data-md-destination]")!;
  input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })); await nextTick();
}

it("opens link settings from a pointer action without changing source or history", async () => {
  const editor = await mount("some **formatted** text");
  editor.setSelection(EditorSelection.single(5, 18)); editor.focus(); await nextTick();
  const action = await button("链接");
  action.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "mouse", button: 0, bubbles: true, cancelable: true }));
  action.dispatchEvent(new PointerEvent("pointerup", { pointerType: "mouse", button: 0, bubbles: true }));
  action.click(); await nextTick();
  await vi.waitFor(() => expect(document.querySelector('[data-md-destination]')).not.toBeNull());
  expect(editor.getMarkdown()).toBe("some **formatted** text");
  expect(editor.history.canUndo).toBe(false);
});

it("hands the floating toolbar to a persistent link dialog", async () => {
  const editor = await mount("some **formatted** text");
  const view = EditorView.findFromDOM(editor.element)!;
  vi.spyOn(view, "coordsAtPos").mockReturnValue({ left: 50, right: 200, top: 100, bottom: 120 });
  editor.setSelection(EditorSelection.single(5, 18)); editor.focus(); await nextTick();
  let action: HTMLButtonElement | null = null;
  await vi.waitFor(() => {
    action = document.querySelector<HTMLButtonElement>('[data-md-floating-toolbar] button[aria-label="链接"]');
    expect(action).not.toBeNull();
  });
  action!.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "mouse", button: 0, bubbles: true, cancelable: true }));
  action!.dispatchEvent(new PointerEvent("pointerup", { pointerType: "mouse", button: 0, bubbles: true }));
  action!.click(); await nextTick();
  await vi.waitFor(() => expect(document.querySelector('[data-md-destination]')).not.toBeNull());
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  expect(document.querySelector('[data-md-destination]')).not.toBeNull();
});

it("validates the destination, focuses the address and preserves formatted selection with one undo", async () => {
  const markdown = "some **formatted** text", editor = await mount(markdown);
  editor.setSelection(EditorSelection.single(5, 18)); await nextTick();
  (await button("链接")).click(); await nextTick();
  await vi.waitFor(() => expect(document.activeElement).toBe(document.querySelector("[data-md-destination]")));
  expect(document.body.textContent).toContain("链接将应用于所选文字");
  expect((await button("插入")).disabled).toBe(true);
  await address("javascript:alert(1)");
  expect(document.body.textContent).toContain("请输入有效且安全的地址");
  expect((await button("插入")).disabled).toBe(true);
  await address("/guide");
  expect((await button("插入")).disabled).toBe(false);
  (await button("插入")).click(); await nextTick();
  expect(editor.getMarkdown()).toBe("some [**formatted**](/guide) text");
  editor.undo(); expect(editor.getMarkdown()).toBe(markdown); expect(editor.history.canUndo).toBe(false);
});

it("edits and unlinks only the captured reference usage, retaining formatted text", async () => {
  const markdown = '[**kept**][shared] and [second][shared]\n\n[shared]: /old "title"';
  const editor = await mount(markdown);
  editor.setSelection(EditorSelection.single(4)); await nextTick();
  (await button("链接")).click(); await nextTick();
  expect(document.body.textContent).toContain("编辑链接");
  await address("#new");
  (await button("应用")).click(); await nextTick();
  expect(editor.getMarkdown()).toBe('[**kept**](#new "title") and [second][shared]\n\n[shared]: /old "title"');
  editor.undo(); expect(editor.getMarkdown()).toBe(markdown);
  editor.setSelection(EditorSelection.single(4)); await nextTick();
  (await button("链接")).click(); await nextTick();
  (await button("移除链接")).click(); await nextTick();
  expect(editor.getMarkdown()).toBe('**kept** and [second][shared]\n\n[shared]: /old "title"');
  editor.undo(); expect(editor.getMarkdown()).toBe(markdown);
});

it("retains a draft and disables submission when its original content changes", async () => {
  const editor = await mount("selected text");
  editor.setSelection(EditorSelection.single(0, 8)); await nextTick();
  (await button("链接")).click(); await nextTick(); await address("/guide");
  editor.run(() => ({ changes: { from: 1, insert: "changed" } })); await nextTick();
  expect((await button("插入")).disabled).toBe(true);
  expect((document.querySelector("[data-md-destination]") as HTMLInputElement).value).toBe("/guide");
  expect(document.body.textContent).toContain("原内容已更改");
  (await button("取消")).click(); await nextTick();
  expect(editor.getMarkdown()).toBe("schangedelected text");
  editor.undo(); expect(editor.getMarkdown()).toBe("selected text"); expect(editor.history.canUndo).toBe(false);
});

it("cancels a new link without a placeholder or an undo entry", async () => {
  const editor = await mount("unchanged");
  (await button("链接")).click(); await nextTick(); await address("/draft");
  (await button("取消")).click(); await nextTick();
  expect(editor.getMarkdown()).toBe("unchanged"); expect(editor.history.canUndo).toBe(false);
});

it("hands a mobile insertion to the same link task and retains its selected text", async () => {
  const originalMatchMedia = window.matchMedia.bind(window);
  vi.spyOn(window, "matchMedia").mockImplementation(query => {
    const media = originalMatchMedia(query);
    Object.defineProperty(media, "matches", { value: query === "(max-width: 767px)" }); return media;
  });
  const editor = await mount("some **formatted** text");
  editor.setSelection(EditorSelection.single(5, 18)); await nextTick();
  (await button("插入")).click(); await nextTick();
  (await button("链接")).click(); await nextTick();
  await vi.waitFor(() => expect(document.querySelector("[data-md-destination]")).not.toBeNull());
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  expect(document.body.textContent).toContain("链接将应用于所选文字");
  await address("/mobile");
  const submit = document.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  submit.click(); await nextTick();
  expect(editor.getMarkdown()).toBe("some [**formatted**](/mobile) text");
  editor.undo(); expect(editor.getMarkdown()).toBe("some **formatted** text"); expect(editor.history.canUndo).toBe(false);
});

it("opens the same settings with the source editor's link shortcut", async () => {
  const editor = await mount("keyboard");
  editor.focus(); await nextTick();
  const input = EditorView.findFromDOM(editor.element)!.contentDOM;
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true }));
  await vi.waitFor(() => expect(document.querySelector("[data-md-destination]")).not.toBeNull());
  expect(document.body.textContent).toContain("插入链接");
  (await button("取消")).click(); await nextTick();
  expect(editor.getMarkdown()).toBe("keyboard"); expect(editor.history.canUndo).toBe(false);
});

it("renames a plain label only when explicitly changed", async () => {
  const editor = await mount("[old](/old)");
  editor.setSelection(EditorSelection.single(2)); await nextTick();
  (await button("链接")).click(); await nextTick();
  const input = document.querySelector<HTMLInputElement>('input[placeholder="链接显示的文字"]')!;
  input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true })); await nextTick();
  expect((await button("应用")).disabled).toBe(true);
  expect(document.body.textContent).toContain("请填写链接显示的文字");
  input.value = "[new]"; input.dispatchEvent(new Event("input", { bubbles: true })); await nextTick();
  (await button("应用")).click(); await nextTick();
  expect(editor.getMarkdown()).toBe("[\\[new\\]](/old)");
  editor.undo(); expect(editor.getMarkdown()).toBe("[old](/old)"); expect(editor.history.canUndo).toBe(false);
});
