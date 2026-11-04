import type { UserShortcuts } from "@unocss/core";
import { controlSizeShortcuts } from "../control/sizes";

/** Public table anatomy, with shared typography and content-driven row height. */
export const tableShortcuts = [
  ["qk-table", ["min-w-0 max-w-full font-qk-product", { color: "var(--qk-table-foreground)" }], { layer: "qk-recipes" }],
  ...controlSizeShortcuts("qk-table", "content"),
  ["qk-table__viewport", [{ "max-height": "var(--qk-table-max-height, none)", "overscroll-behavior": "auto" }], { layer: "qk-recipes" }],
  ["qk-table__table", [{ width: "100%", "table-layout": "fixed", "border-collapse": "separate", "border-spacing": "0", "font-size": "inherit", "line-height": "inherit" }], { layer: "qk-recipes" }],
  ["qk-table__cell", [{ padding: "var(--qk-table-cell-padding, var(--qk-table-padding))", "vertical-align": "middle", "overflow-wrap": "anywhere", "font-weight": "normal", "border-bottom": "var(--qk-table-border-width) solid var(--qk-table-border-color)" }], { layer: "qk-recipes" }],
  ["qk-table__heading", ["qk-table__cell", { color: "var(--qk-table-muted-foreground)", "background-color": "var(--qk-table-header-background)", "vertical-align": "middle", "font-weight": "var(--qk-type-control-font-weight)" }], { layer: "qk-recipes" }],
  ["qk-table__heading--sticky", [{ position: "sticky", top: "0", "z-index": "1" }], { layer: "qk-recipes" }],
  ["qk-table__row", "data-[current]:[background-color:var(--qk-table-current-background)] data-[selected]:[background-color:var(--qk-table-current-background)]", { layer: "qk-recipes" }],
  ["qk-table__sort", [{ "margin-inline": "calc(-1 * (var(--qk-table-sort-inset) + var(--qk-button-border-width)))" }], { layer: "qk-recipes" }],
  ["qk-table__row--selectable", "[&>.qk-table__cell]:align-middle", { layer: "qk-recipes" }],
  ["qk-table__selection-column", [{ width: "calc(var(--qk-control-size-height) + 2 * var(--qk-table-cell-padding, var(--qk-table-padding)))" }], { layer: "qk-recipes" }],
  ["qk-table__empty", "p-qk-group", { layer: "qk-recipes" }],
  ["qk-table__caption", "text-start pb-qk-surface font-medium", { layer: "qk-recipes" }],
  ["qk-table__status", "py-qk-inline text-qk-text-secondary", { layer: "qk-recipes" }],
  ["qk-table__footer", "pt-qk-surface", { layer: "qk-recipes" }]
] satisfies UserShortcuts;

/** Content density shares spacing roles; it does not impose a control-height row. */
export const tableStaticCss = `
.qk-table--xs { --qk-table-cell-padding: var(--qk-table-compact-padding); --qk-table-sort-inset: var(--qk-button-xs-padding-inline); }
.qk-table--sm { --qk-table-sort-inset: var(--qk-button-sm-padding-inline); }
.qk-table--md { --qk-table-sort-inset: var(--qk-button-md-padding-inline); }
.qk-table--lg { --qk-table-sort-inset: var(--qk-button-lg-padding-inline); }
.qk-table--xl { --qk-table-sort-inset: var(--qk-button-xl-padding-inline); }
.qk-table--lg, .qk-table--xl { --qk-table-cell-padding: var(--qk-table-comfortable-padding); }
`;
/** Every public anatomy and size class. */
export const tableRecipeCatalog = Object.freeze(tableShortcuts.map(shortcut => shortcut[0]));
