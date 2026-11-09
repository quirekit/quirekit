import type { QuireBlockTone } from "./types";

/** Fixed handle width, so hosts can reserve its gutter before it mounts. */
export const quireBlockHandleWidth = 42;

/** Each tone derives from semantic feedback colors, so both schemes stay readable. */
const colors: Readonly<Record<QuireBlockTone, string>> = {
  blue: "var(--qk-color-info-solid)",
  indigo: "var(--qk-color-action-primary)",
  green: "var(--qk-color-success-solid)",
  orange: "var(--qk-color-warning-solid)",
  teal: "color-mix(in oklab, var(--qk-color-info-solid), var(--qk-color-success-solid))",
  purple: "color-mix(in oklab, var(--qk-color-info-solid), var(--qk-color-danger-solid))",
  neutral: "var(--qk-color-icon-secondary)",
};

/**
 * @param tone - Block color family.
 * @returns CSS color usable inline, including in overlays outside the editor root.
 */
export function quireBlockToneColor(tone: QuireBlockTone): string {
  return colors[tone];
}
