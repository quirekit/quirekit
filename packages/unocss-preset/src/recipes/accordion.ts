import type { UserShortcuts } from "@unocss/core";

/** UnoCSS preset 发布的 Accordion anatomy 类。 */
export const accordionRecipeCatalog = Object.freeze([
  "qk-accordion",
  "qk-accordion--plain",
  "qk-accordion--horizontal",
  "qk-accordion--vertical",
  "qk-accordion__item",
  "qk-accordion__item--plain",
  "qk-accordion__trigger",
  "qk-accordion__trigger--sm",
  "qk-accordion__trigger--md",
  "qk-accordion__heading",
  "qk-accordion__title",
  "qk-accordion__description",
  "qk-accordion__indicator",
  "qk-accordion__content",
  "qk-accordion__content-inner"
]);

/** Accordion 已批准 anatomy、方向、尺寸与状态的 UnoCSS shortcuts。 */
export const accordionShortcuts = [
  [
    "qk-accordion",
    "min-w-0 overflow-hidden rounded-qk-control border border-qk-border-default bg-qk-surface-page text-qk-text-primary",
    { layer: "qk-recipes" }
  ],
  ["qk-accordion--plain", "!border-0 !bg-transparent gap-qk-inline", { layer: "qk-recipes" }],
  ["qk-accordion--vertical", "grid", { layer: "qk-recipes" }],
  ["qk-accordion--horizontal", "flex items-stretch", { layer: "qk-recipes" }],
  [
    "qk-accordion__item",
    "min-w-0 border-0 border-qk-border-subtle data-[orientation=vertical]:border-b data-[orientation=vertical]:last:border-b-0 data-[orientation=horizontal]:flex-1 data-[orientation=horizontal]:border-r data-[orientation=horizontal]:last:border-r-0",
    { layer: "qk-recipes" }
  ],
  ["qk-accordion__item--plain", "!border-0", { layer: "qk-recipes" }],
  [
    "qk-accordion__trigger",
    [
      "flex w-full cursor-pointer select-none items-center justify-between gap-3 border-0 bg-transparent px-3 text-left text-qk-text-primary transition-colors hover:bg-qk-surface-hover data-[disabled]:cursor-not-allowed data-[disabled]:bg-transparent data-[disabled]:text-qk-text-disabled data-[focus-visible]:relative data-[focus-visible]:z-1 [outline:none] data-[focus-visible]:bg-qk-surface-hover motion-reduce:transition-none",
      { outline: "0" }
    ],
    { layer: "qk-recipes" }
  ],
  [
    "qk-accordion__trigger--sm",
    "min-h-9 py-qk-inline text-qk-compact leading-qk-compact",
    { layer: "qk-recipes" }
  ],
  [
    "qk-accordion__trigger--md",
    "min-h-11 py-2 text-qk-body leading-qk-body",
    { layer: "qk-recipes" }
  ],
  [
    "qk-accordion__heading",
    "grid min-w-0 flex-1 gap-0.5",
    { layer: "qk-recipes" }
  ],
  ["qk-accordion__title", "font-medium", { layer: "qk-recipes" }],
  [
    "qk-accordion__description",
    "font-normal text-qk-helper leading-qk-helper text-qk-text-tertiary",
    { layer: "qk-recipes" }
  ],
  [
    "qk-accordion__indicator",
    "grid size-5 shrink-0 place-items-center text-qk-icon-secondary transition-transform duration-150 data-[state=open]:rotate-90 motion-reduce:transition-none",
    { layer: "qk-recipes" }
  ],
  [
    "qk-accordion__content",
    "min-w-0 overflow-hidden data-[state=closed]:hidden",
    { layer: "qk-recipes" }
  ],
  [
    "qk-accordion__content-inner",
    "min-w-0 p-3 text-qk-compact leading-qk-compact text-qk-text-secondary",
    { layer: "qk-recipes" }
  ]
] satisfies UserShortcuts;
