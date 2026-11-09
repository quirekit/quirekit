import { segmentedCssVariableNames, segmentedVariableReferences, themeVariableReferences } from "@quirekit/ui";
import type { UserShortcuts } from "@unocss/core";

/** UnoCSS preset 发布的 Segmented Control recipe 类。 */
export const segmentedRecipeCatalog = Object.freeze([
  "qk-segmented",
  "qk-segmented--horizontal",
  "qk-segmented--vertical",
  "qk-segmented--equal",
  "qk-segmented--square",
  "qk-segmented--pill",
  "qk-segmented--xs",
  "qk-segmented--sm",
  "qk-segmented--md",
  "qk-segmented--lg",
  "qk-segmented--xl",
  "qk-segmented__indicator",
  "qk-segmented__item",
  "qk-segmented__item--xs",
  "qk-segmented__item--sm",
  "qk-segmented__item--md",
  "qk-segmented__item--lg",
  "qk-segmented__item--xl",
  "qk-segmented__label"
]);

/** Segmented Control 已批准 anatomy、方向、尺寸和状态的 UnoCSS shortcuts。 */
export const segmentedShortcuts = [
  [
    "qk-segmented",
    [
      "relative isolate m-0 inline-flex max-w-full [&:not(.qk-segmented--equal)]:w-fit select-none bg-qk-segmented-track-background p-qk-segmented-track-inset font-qk-segmented-family tracking-qk-segmented text-qk-segmented-foreground",
      {
        "font-weight": segmentedVariableReferences.typography.fontWeight
      }
    ],
    { layer: "qk-recipes" }
  ],
  [
    "qk-segmented--square",
    [{
      [segmentedCssVariableNames.trackRadius]: "0px",
      [segmentedCssVariableNames.indicatorRadius]: "0px"
    }],
    { layer: "qk-recipes" }
  ],
  [
    "qk-segmented--pill",
    [{
      [segmentedCssVariableNames.trackRadius]: themeVariableReferences.radius.pill,
      [segmentedCssVariableNames.indicatorRadius]: themeVariableReferences.radius.pill
    }],
    { layer: "qk-recipes" }
  ],
  [
    "qk-segmented--horizontal",
    "flex-row items-stretch",
    { layer: "qk-recipes" }
  ],
  [
    "qk-segmented--vertical",
    "h-auto flex-col items-stretch",
    { layer: "qk-recipes" }
  ],
  [
    "qk-segmented--equal",
    "w-full [&>[data-part=item]]:flex-1",
    { layer: "qk-recipes" }
  ],
  ["qk-segmented--xs", "rounded-qk-segmented-track data-[orientation=horizontal]:h-qk-segmented-xs", { layer: "qk-recipes" }],
  ["qk-segmented--sm", "rounded-qk-segmented-track data-[orientation=horizontal]:h-qk-segmented-sm", { layer: "qk-recipes" }],
  ["qk-segmented--md", "rounded-qk-segmented-track data-[orientation=horizontal]:h-qk-segmented-md", { layer: "qk-recipes" }],
  ["qk-segmented--lg", "rounded-qk-segmented-track data-[orientation=horizontal]:h-qk-segmented-lg", { layer: "qk-recipes" }],
  ["qk-segmented--xl", "rounded-qk-segmented-track data-[orientation=horizontal]:h-qk-segmented-xl", { layer: "qk-recipes" }],
  [
    "qk-segmented__indicator",
    [
      "pointer-events-none z-0 rounded-qk-segmented-indicator bg-qk-segmented-selected-background data-[orientation=horizontal]:top-qk-segmented-track-inset data-[orientation=vertical]:left-qk-segmented-track-inset motion-reduce:!transition-none",
      {
        width: "var(--width)",
        height: "var(--height)",
        "--transition-duration":
          segmentedVariableReferences.transitionDuration,
        "--transition-timing-function":
          segmentedVariableReferences.transitionEasing
      }
    ],
    { layer: "qk-recipes" }
  ],
  [
    "qk-segmented__item",
    [
      "relative z-1 inline-flex min-w-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-qk-segmented-indicator border border-transparent bg-transparent transition-colors duration-qk-segmented ease-qk-segmented data-[state=unchecked]:data-[hover]:bg-qk-segmented-hover-background data-[state=unchecked]:data-[hover]:text-qk-segmented-hover-foreground data-[state=checked]:bg-transparent data-[state=checked]:text-qk-segmented-selected-foreground [outline:none] data-[focus-visible]:underline data-[focus-visible]:underline-offset-4 data-[disabled]:cursor-not-allowed data-[disabled]:text-qk-segmented-disabled-foreground motion-reduce:transition-none",
      { outline: "0" }
    ],
    { layer: "qk-recipes" }
  ],
  ["qk-segmented__item--xs", "data-[orientation=horizontal]:h-full data-[orientation=vertical]:h-qk-segmented-xs gap-qk-segmented-xs-gap px-qk-segmented-xs-inline text-qk-segmented-xs leading-qk-segmented-xs", { layer: "qk-recipes" }],
  ["qk-segmented__item--sm", "data-[orientation=horizontal]:h-full data-[orientation=vertical]:h-qk-segmented-sm gap-qk-segmented-sm-gap px-qk-segmented-sm-inline text-qk-segmented-sm leading-qk-segmented-sm", { layer: "qk-recipes" }],
  ["qk-segmented__item--md", "data-[orientation=horizontal]:h-full data-[orientation=vertical]:h-qk-segmented-md gap-qk-segmented-md-gap px-qk-segmented-md-inline text-qk-segmented-md leading-qk-segmented-md", { layer: "qk-recipes" }],
  ["qk-segmented__item--lg", "data-[orientation=horizontal]:h-full data-[orientation=vertical]:h-qk-segmented-lg gap-qk-segmented-lg-gap px-qk-segmented-lg-inline text-qk-segmented-lg leading-qk-segmented-lg", { layer: "qk-recipes" }],
  ["qk-segmented__item--xl", "data-[orientation=horizontal]:h-full data-[orientation=vertical]:h-qk-segmented-xl gap-qk-segmented-xl-gap px-qk-segmented-xl-inline text-qk-segmented-xl leading-qk-segmented-xl", { layer: "qk-recipes" }],
  ["qk-segmented__label", "relative z-1 inline-flex min-w-0 items-center justify-center gap-1 truncate [line-height:normal]", { layer: "qk-recipes" }]
] satisfies UserShortcuts;
