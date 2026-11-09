import { controlFocusWithin, invalidControlFocusWithin } from "./control/focus";
import { controlSizeShortcuts, listDensityShortcuts } from "./control/sizes";
import type { UserShortcuts } from "@unocss/core";

/** UnoCSS preset 发布的 Select anatomy 类。 */
export const selectRecipeCatalog = Object.freeze([
  "qk-select__control",
  "qk-select__trigger",
  "qk-select__trigger--xs",
  "qk-select__trigger--sm",
  "qk-select__trigger--md",
  "qk-select__trigger--lg",
  "qk-select__trigger--xl",
  "qk-select__value",
  "qk-select__indicator",
  "qk-select__positioner",
  "qk-select__positioner--modal",
  "qk-select__content",
  "qk-select__content--compact",
  "qk-select__content--regular",
  "qk-select__content--border-none",
  "qk-select__content--border-subtle",
  "qk-select__content--border-default",
  "qk-select__list",
  "qk-select__item",
  "qk-select__item-label",
  "qk-select__item-shortcut",
  "qk-select__item-indicator"
]);

const resetInteractive = { outline: "0", "box-shadow": "none" } as const;

/** Select 的公开 UnoCSS shortcuts。 */
export const selectShortcuts = [
  ["qk-select__control", "inline-flex min-w-0 max-w-full", { layer: "qk-recipes" }],
  [
    "qk-select__trigger",
    [
      "flex min-w-0 max-w-full cursor-pointer items-center gap-qk-inline appearance-none border border-solid border-qk-border-default bg-qk-surface-page px-qk-inline text-qk-text-primary [&[data-placeholder-shown]:not([data-disabled])]:text-qk-text-placeholder hover:bg-qk-surface-hover data-[focus]:border-qk-border-strong data-[invalid]:border-qk-danger-border disabled:cursor-not-allowed disabled:border-qk-border-disabled disabled:bg-qk-surface-disabled disabled:text-qk-text-disabled",
      controlFocusWithin,
      "[&[data-variant=text]:not([data-invalid]):not([data-disabled])]:border-transparent [&[data-variant=text]:not([data-invalid])]:[outline:none] [&[data-variant=text]:not([data-disabled]):not(:hover)]:bg-transparent",
      `data-[invalid]:${invalidControlFocusWithin}`,
      { ...resetInteractive, "border-radius": "var(--qk-radius-control)" }
    ],
    { layer: "qk-recipes" }
  ],
  ...controlSizeShortcuts("qk-select__trigger"),
  ["qk-select__value", "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-start", { layer: "qk-recipes" }],
  ["qk-select__indicator", "inline-flex size-[16px] shrink-0 items-center justify-center text-qk-text-secondary data-[state=open]:rotate-180 transition-transform", { layer: "qk-recipes" }],
  [
    "qk-select__positioner",
    [{ "--z-index": "var(--qk-select-layer, var(--qk-layer-overlay)) !important", "z-index": "var(--z-index)", outline: "0" }],
    { layer: "qk-recipes" }
  ],
  [
    "qk-select__content",
    [
      "overflow-auto overscroll-contain border-solid bg-qk-surface-overlay p-qk-inline-tight text-qk-text-primary data-[state=open]:translate-y-0 data-[state=open]:opacity-100 data-[state=closed]:pointer-events-none data-[state=closed]:-translate-y-1 data-[state=closed]:opacity-0 transition-[opacity,transform]",
      { ...resetInteractive, "max-height": "min(248px, var(--available-height, 248px))", "border-radius": "var(--qk-radius-overlay)", "z-index": "var(--qk-select-layer, var(--qk-layer-overlay))" }
    ],
    { layer: "qk-recipes" }
  ],
  ...listDensityShortcuts("qk-select__content"),
  ["qk-select__content--border-none", "border-0 shadow-qk-overlay", { layer: "qk-recipes" }],
  ["qk-select__positioner--modal", [{ "--qk-select-layer": "calc(var(--qk-layer-modal) + 1)" }], { layer: "qk-recipes" }],
  ["qk-select__content--border-subtle", "border border-qk-border-subtle shadow-qk-raised", { layer: "qk-recipes" }],
  ["qk-select__content--border-default", "border border-qk-border-default shadow-qk-raised", { layer: "qk-recipes" }],
  ["qk-select__list", "m-0 grid auto-rows-min content-start gap-[2px] p-0", { layer: "qk-recipes" }],
  [
    "qk-select__item",
    [
      "flex min-w-0 cursor-pointer select-none items-center gap-qk-inline rounded-qk-control px-qk-inline text-qk-text-primary data-[highlighted]:bg-qk-surface-hover data-[disabled]:cursor-not-allowed data-[disabled]:text-qk-text-disabled",
      {
        ...resetInteractive,
        "min-height": "var(--qk-control-size-height)",
        "padding-block": "max(0px, calc((var(--qk-control-size-height) - var(--qk-control-size-line-height)) / 2))"
      }
    ],
    { layer: "qk-recipes" }
  ],
  ["qk-select__item-label", "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap", { layer: "qk-recipes" }],
  ["qk-select__item-shortcut", ["shrink-0 whitespace-nowrap text-qk-text-tertiary", { "font-family": "inherit", "font-size": "inherit", "letter-spacing": "0.12em" }], { layer: "qk-recipes" }],
  ["qk-select__item-indicator", "inline-flex [&[hidden]]:hidden size-[16px] shrink-0 items-center justify-center text-qk-action-text", { layer: "qk-recipes" }]
] satisfies UserShortcuts;
