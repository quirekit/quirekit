import { tooltipVariableReferences } from "@quirekit/ui";
import type { UserShortcuts } from "@unocss/core";

/** 由 preset 输出的 Tooltip anatomy 类。 */
export const tooltipRecipeCatalog = Object.freeze([
  "qk-tooltip__positioner",
  "qk-tooltip__content",
  "qk-tooltip__shortcut",
  "qk-tooltip__arrow",
  "qk-tooltip__arrow-tip"
]);

/** 使用显式组件 token 的 Tooltip UnoCSS shortcuts。 */
export const tooltipShortcuts = [
  [
    "qk-tooltip__positioner",
    [
      {
        "--z-index": `${tooltipVariableReferences.layer} !important`,
        "z-index": tooltipVariableReferences.layer
      }
    ],
    { layer: "qk-recipes" }
  ],
  [
    "qk-tooltip__content",
    [
      "pointer-events-none flex w-max max-w-[calc(100vw-var(--qk-space-page)*2)] items-center whitespace-normal transition-opacity data-[state=closed]:opacity-0 data-[state=open]:opacity-100 motion-reduce:transition-none",
      {
        "box-sizing": "border-box",
        outline: "0",
        background: tooltipVariableReferences.background,
        color: tooltipVariableReferences.foreground,
        "border-color": tooltipVariableReferences.borderColor,
        "border-style": "solid",
        "border-width": tooltipVariableReferences.borderWidth,
        "border-radius": tooltipVariableReferences.radius,
        "box-shadow": tooltipVariableReferences.shadow,
        "padding-block": tooltipVariableReferences.paddingBlock,
        "padding-inline": tooltipVariableReferences.paddingInline,
        gap: tooltipVariableReferences.gap,
        "font-family": tooltipVariableReferences.typography.fontFamily,
        "font-size": tooltipVariableReferences.typography.fontSize,
        "line-height": tooltipVariableReferences.typography.lineHeight,
        "font-weight": tooltipVariableReferences.typography.fontWeight,
        "letter-spacing": tooltipVariableReferences.typography.letterSpacing,
        "transition-duration": tooltipVariableReferences.motionDuration,
        "transition-timing-function": tooltipVariableReferences.enterEasing
      }
    ],
    { layer: "qk-recipes" }
  ],
  [
    "qk-tooltip__shortcut",
    [
      "whitespace-nowrap",
      { "font-family": "inherit", "font-size": "inherit", "font-weight": "inherit", "letter-spacing": "0.12em", "margin-inline-start": "0.25em", opacity: "0.72" }
    ],
    { layer: "qk-recipes" }
  ],
  [
    "qk-tooltip__arrow",
    [
      "pointer-events-none",
      {
        "--arrow-size": tooltipVariableReferences.arrowSize,
        "--arrow-background": tooltipVariableReferences.background,
        width: tooltipVariableReferences.arrowSize,
        height: tooltipVariableReferences.arrowSize
      }
    ],
    { layer: "qk-recipes" }
  ],
  [
    "qk-tooltip__arrow-tip",
    [
      "size-full",
      {
        background: tooltipVariableReferences.background,
        "border-color": tooltipVariableReferences.borderColor,
        "border-style": "solid",
        "border-width": tooltipVariableReferences.borderWidth
      }
    ],
    { layer: "qk-recipes" }
  ]
] satisfies UserShortcuts;
