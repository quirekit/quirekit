// @vitest-environment happy-dom
import { createApp, h, nextTick, reactive, shallowRef, type VNode } from "vue";
import { afterEach, expect, it, vi } from "vitest";
import { createTheme, defaultTheme } from "../../theme";
import { createUiThemeCssVariables } from "../../styles/theme";
import { QuireThemeProvider } from "../theme-provider";
import DialogRoot from "./root.vue";
import DialogContent from "./content.vue";
import DrawerRoot from "../drawer/root.vue";
import DrawerContent from "../drawer/content.vue";
import Preview from "../image-preview/image-preview.vue";
import PickerRoot from "../shared/picker/root.vue";
import PickerContent from "../shared/picker/content.vue";
import ActionMenu from "../action-menu/root.vue";
import ColorPicker from "../color-picker/color-picker.vue";
import HoverRoot from "../hover-card/root.vue";
import HoverTrigger from "../hover-card/trigger.vue";
import HoverContent from "../hover-card/content.vue";
import Toaster from "../toast/toaster.vue";
import { createQuireKitToaster } from "../toast/create-toaster";

const families = ["dialog", "drawer", "image-preview", "picker", "action-menu", "color-picker", "hover-card"] as const;
const selectors = {
  dialog: ".qk-dialog__content", drawer: ".qk-drawer__content", "image-preview": ".qk-image-preview",
  picker: ".qk-picker__sheet", "action-menu": ".qk-action-menu__surface",
  "color-picker": ".qk-color-picker__content", "hover-card": ".qk-hover-card__content"
};
const colorName = "--qk-color-selection-document";
const themeNames = new Set(Object.keys(createUiThemeCssVariables(defaultTheme)));
const cleanups: Array<() => void> = [];
afterEach(() => {
  cleanups.splice(0).reverse().forEach(cleanup => cleanup());
  vi.restoreAllMocks();
});

/**
 * Creates the real public surface, leaving its original portal behavior active.
 * @param family - Surface family under test.
 * @param sequence - Unrelated mutable presentation content.
 * @returns A themed consumer tree.
 */
function renderFamily(family: typeof families[number], sequence: number): VNode {
  const body = () => h("span", { "data-sequence": sequence }, `Content ${sequence}`);
  const modal = { open: true, modal: false, trapFocus: false, preventScroll: false, restoreFocus: false };
  if (family === "dialog") return h(DialogRoot, modal, () => h(DialogContent, { title: `Dialog ${sequence}` }, body));
  if (family === "drawer") return h(DrawerRoot, modal, () => h(DrawerContent, { title: `Drawer ${sequence}` }, body));
  if (family === "image-preview") return h(Preview, { open: true, items: [], toolbar: false }, { actions: body });
  if (family === "picker") return h(PickerRoot, { open: true, label: "Picker", presentation: "bottom" }, () =>
    h(PickerContent, { "aria-label": `Picker ${sequence}` }, body));
  if (family === "action-menu") return h(ActionMenu, {
    open: true, presentation: "desktop", title: `Action ${sequence}`,
    actions: [{ kind: "command", value: "copy", label: `Copy ${sequence}` }]
  });
  if (family === "color-picker") return h(ColorPicker, {
    open: true, label: `Color ${sequence}`, colors: [["#336699"]], recentColors: []
  });
  return h(HoverRoot, { open: true }, () => [
    h(HoverTrigger, {}, () => "Preview"), h(HoverContent, { showArrow: true }, body)
  ]);
}

/**
 * Finds the actual inherited theme ancestor without relying on marker attributes.
 * @param element - Visible or retained surface element.
 * @returns Nearest native ancestor declaring the semantic selection color.
 */
function themeOwner(element: HTMLElement): HTMLElement | undefined {
  let parent = element.parentElement;
  while (parent) {
    if (parent.style.getPropertyValue(colorName)) return parent;
    parent = parent.parentElement;
  }
  return undefined;
}

for (const family of families) {
  // This is a work-count regression, not a wall-clock budget; Nx runs several
  // package suites alongside happy-dom's expensive CSS declaration parsing.
  it(`${family} retains the provider theme across unrelated updates and theme replacement`, async () => {
    const sequence = shallowRef(0);
    const theme = shallowRef(defaultTheme);
    const host = document.createElement("div");
    document.body.append(host);
    const app = createApp({ render: () => h(QuireThemeProvider, { theme: theme.value }, () => renderFamily(family, sequence.value)) });
    app.mount(host);
    cleanups.push(() => { app.unmount(); host.remove(); });
    await vi.waitFor(() => expect(document.querySelector(selectors[family])).not.toBeNull());
    const content = document.querySelector<HTMLElement>(selectors[family])!;
    await vi.waitFor(() => expect(host.contains(content)).toBe(false));
    // ImagePreview owns a separate contrast palette inside the inherited host theme.
    const inheritedContent = family === "image-preview" ? content.parentElement! : content;
    const owner = themeOwner(inheritedContent);
    expect(owner, "Every detached surface must inherit its logical provider").toBeDefined();
    expect(owner!.style.getPropertyValue(colorName)).toBe(defaultTheme.color.selection.document);
    expect(owner!.style.display).toBe("block");
    for (const sibling of document.querySelectorAll(`.qk-${family}__backdrop,.qk-${family}__arrow`)) {
      expect(owner!.contains(sibling)).toBe(true);
    }
    const writes = vi.spyOn(CSSStyleDeclaration.prototype, "setProperty");
    for (let index = 1; index <= 3; index += 1) {
      sequence.value = index;
      await nextTick();
    }
    expect(document.querySelector(selectors[family])).toBe(content);
    expect(writes.mock.calls.filter(([name]) => themeNames.has(name))).toHaveLength(0);
    theme.value = createTheme({ scheme: "dark", sources: { primary: "#246b55" } });
    await nextTick();
    expect(themeOwner(inheritedContent)).toBe(owner);
    expect(owner!.style.getPropertyValue(colorName)).toBe(theme.value.color.selection.document);
  }, 15_000);
}

it("keeps nested modal themes, labeling and later-opened hover outside background isolation", async () => {
  const state = reactive({ inner: false, preview: false });
  const nestedTheme = shallowRef(createTheme({ scheme: "dark", sources: { primary: "#246b55" } }));
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({ render: () => h(QuireThemeProvider, { theme: defaultTheme }, () =>
    h(DialogRoot, { open: true, trapFocus: false, preventScroll: false, restoreFocus: false }, () =>
      h(DialogContent, { title: "Outer dialog" }, () => h(QuireThemeProvider, { theme: nestedTheme.value }, () =>
        h(DrawerRoot, { open: state.inner, trapFocus: false, preventScroll: false, restoreFocus: false }, () =>
          h(DrawerContent, { title: "Nested drawer" }, () => h(HoverRoot, { open: state.preview }, () => [
            h(HoverTrigger, {}, () => "Preview"), h(HoverContent, { showArrow: true }, () => "Nested preview")
          ]))
        )
      ))
    )
  ) });
  app.mount(host);
  cleanups.push(() => { app.unmount(); host.remove(); });
  await vi.waitFor(() => expect(host.getAttribute("aria-hidden")).toBe("true"));
  state.inner = true;
  await vi.waitFor(() => expect(document.querySelector(".qk-drawer__content")).not.toBeNull());
  const drawer = document.querySelector<HTMLElement>(".qk-drawer__content")!;
  const dialog = document.querySelector<HTMLElement>(".qk-dialog__content")!;
  expect(themeOwner(dialog)!.style.getPropertyValue(colorName)).toBe(defaultTheme.color.selection.document);
  expect(themeOwner(drawer)!.style.getPropertyValue(colorName)).toBe(nestedTheme.value.color.selection.document);
  expect(drawer.getAttribute("aria-labelledby")).toBe(drawer.querySelector(".qk-drawer__title")!.id);
  await vi.waitFor(() => expect(drawer.closest('[aria-hidden="true"]') === null).toBe(true));
  state.preview = true;
  await vi.waitFor(() => expect(document.querySelector(".qk-hover-card__content")).not.toBeNull());
  const preview = document.querySelector<HTMLElement>(".qk-hover-card__content")!;
  await vi.waitFor(() => expect(themeOwner(preview)?.parentElement).toBe(document.body));
  expect(themeOwner(preview)!.style.getPropertyValue(colorName)).toBe(nestedTheme.value.color.selection.document);
  expect(preview.closest('[aria-hidden="true"]') === null).toBe(true);
  expect(preview.parentElement!.classList.contains("qk-hover-card__positioner--modal")).toBe(true);
  expect(preview.parentElement!.querySelector(".qk-hover-card__arrow")?.parentElement).toBe(preview.parentElement);
  nestedTheme.value = createTheme({ sources: { primary: "#b04466" } });
  await nextTick();
  expect(themeOwner(preview)!.style.getPropertyValue(colorName)).toBe(nestedTheme.value.color.selection.document);
  expect(themeOwner(dialog)!.style.getPropertyValue(colorName)).toBe(defaultTheme.color.selection.document);
}, 15_000);

it("keeps Toast resident under its theme scope instead of introducing a portal", async () => {
  const theme = shallowRef(defaultTheme);
  const toaster = createQuireKitToaster({ placement: "bottom-end", duration: Infinity });
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp({ render: () => h(QuireThemeProvider, { theme: theme.value }, () => h(Toaster, { toaster })) });
  app.mount(host);
  cleanups.push(() => { toaster.remove(); app.unmount(); host.remove(); });
  toaster.create({ title: "Saved", type: "success", closable: true });
  await vi.waitFor(() => expect(host.querySelector(".qk-toast")).not.toBeNull());
  const toast = host.querySelector<HTMLElement>(".qk-toast")!;
  expect(themeOwner(toast)!.style.getPropertyValue(colorName)).toBe(defaultTheme.color.selection.document);
  theme.value = createTheme({ scheme: "dark" });
  await nextTick();
  expect(host.contains(toast)).toBe(true);
  expect(themeOwner(toast)!.style.getPropertyValue(colorName)).toBe(theme.value.color.selection.document);
});
