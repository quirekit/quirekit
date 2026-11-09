/** Shared highlighter palette and geometry for retained documents and Markdown Prose. */
export const proseHighlightCss = `
/* Shared by the editable container wrapper, MdProse reading output and the block menu swatches. */
.qk-prose-container[data-qk-prose-highlight], .qk-prose-highlight-swatch { --qk-prose-highlight-surface: var(--qk-color-warning-surface); --qk-prose-highlight-edge: var(--qk-color-warning-border); }
:is(.qk-prose-container, .qk-prose-highlight-swatch)[data-qk-prose-highlight="red"] { --qk-prose-highlight-surface: var(--qk-color-danger-surface); --qk-prose-highlight-edge: var(--qk-color-danger-border); }
:is(.qk-prose-container, .qk-prose-highlight-swatch)[data-qk-prose-highlight="green"] { --qk-prose-highlight-surface: var(--qk-color-success-surface); --qk-prose-highlight-edge: var(--qk-color-success-border); }
:is(.qk-prose-container, .qk-prose-highlight-swatch)[data-qk-prose-highlight="blue"] { --qk-prose-highlight-surface: var(--qk-color-info-surface); --qk-prose-highlight-edge: var(--qk-color-info-border); }
:is(.qk-prose-container, .qk-prose-highlight-swatch)[data-qk-prose-highlight="purple"] {
  --qk-prose-highlight-surface: color-mix(in oklab, var(--qk-color-info-surface), var(--qk-color-danger-surface));
  --qk-prose-highlight-edge: color-mix(in oklab, var(--qk-color-info-border), var(--qk-color-danger-border));
}
:is(.qk-prose-container, .qk-prose-highlight-swatch)[data-qk-prose-highlight="gray"] { --qk-prose-highlight-surface: var(--qk-color-surface-subtle); --qk-prose-highlight-edge: var(--qk-color-border-default); }
:is(.qk-prose-container, .qk-prose-highlight-swatch)[data-qk-prose-highlight-text="orange"] { color: var(--qk-color-warning-text); }
:is(.qk-prose-container, .qk-prose-highlight-swatch)[data-qk-prose-highlight-text="red"] { color: var(--qk-color-danger-text); }
:is(.qk-prose-container, .qk-prose-highlight-swatch)[data-qk-prose-highlight-text="green"] { color: var(--qk-color-success-text); }
:is(.qk-prose-container, .qk-prose-highlight-swatch)[data-qk-prose-highlight-text="blue"] { color: var(--qk-color-info-text); }
:is(.qk-prose-container, .qk-prose-highlight-swatch)[data-qk-prose-highlight-text="purple"] { color: color-mix(in oklab, var(--qk-color-info-text), var(--qk-color-danger-text)); }
:is(.qk-prose-container, .qk-prose-highlight-swatch)[data-qk-prose-highlight-text="gray"] { color: var(--qk-color-text-secondary); }
/* The icon floats at the start of the first row; later rows use the full width. */
.qk-prose-container[data-qk-prose-highlight] {
  --qk-prose-container-surface: var(--qk-prose-highlight-surface);
  --qk-prose-container-border: transparent;
  --qk-prose-highlight-icon-size: 1.75em;
  position: relative; display: flow-root; padding: var(--qk-space-surface);
}
.qk-prose-container[data-qk-prose-highlight] > .qk-prose-container__header {
  float: inline-start; display: flex; align-items: center; block-size: var(--qk-type-body-line-height); margin-inline-end: var(--qk-space-inline);
  padding: 0; font-weight: inherit;
}
.qk-prose-container[data-qk-prose-highlight] > .qk-prose-container__body { display: block; min-block-size: var(--qk-type-body-line-height); padding: 0; }
.qk-prose-highlight-icon { display: inline-flex; align-items: center; justify-content: center; inline-size: var(--qk-prose-highlight-icon-size, 1.75em); padding: 0; }
`;
