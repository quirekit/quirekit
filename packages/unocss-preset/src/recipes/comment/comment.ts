import type { StaticShortcut } from '@unocss/core';

/** Review-margin comment cards: compact type, quiet quote line and progressive actions. */
export const commentShortcuts: StaticShortcut[] = [
  ['qk-comment-thread', 'relative text-qk-compact leading-qk-compact text-qk-text-secondary [box-shadow:var(--qk-elevation-raised)]', { layer: 'qk-recipes' }],
  ['qk-comment-thread__header', 'relative flex w-full min-w-0 items-center gap-qk-inline', { layer: 'qk-recipes' }],
  ['qk-comment-thread__target', 'flex min-w-0 flex-auto items-center gap-qk-inline p-0 border-0 bg-transparent text-start [color:inherit] [font:inherit] cursor-pointer', { layer: 'qk-recipes' }],
  ['qk-comment-thread__author', 'min-w-[2em] truncate font-qk-control [flex:0_1_auto]', { layer: 'qk-recipes' }],
  ['qk-comment-thread__time', 'ms-auto whitespace-nowrap text-qk-helper leading-qk-helper text-qk-text-muted [font-variant-numeric:tabular-nums]', { layer: 'qk-recipes' }],
  ['qk-comment-thread__menu', 'inline-flex', { layer: 'qk-recipes' }],
  ['qk-comment-message__menu', 'inline-flex ms-auto', { layer: 'qk-recipes' }],
  ['qk-comment-thread__actions', 'absolute flex flex-none items-center gap-[2px] [inset-block-start:50%] [inset-inline-end:-4px] [transform:translateY(-50%)]', { layer: 'qk-recipes' }],
  ['qk-comment-thread__stepper', 'flex items-center gap-[2px]', { layer: 'qk-recipes' }],
  ['qk-comment-thread__position', 'min-w-[3ch] whitespace-nowrap text-center text-qk-helper leading-qk-helper text-qk-text-muted [font-variant-numeric:tabular-nums]', { layer: 'qk-recipes' }],
  ['qk-comment-thread__quote', 'relative w-full overflow-hidden border-0 bg-transparent p-0 ps-[9px] text-start text-qk-helper leading-qk-helper text-qk-text-muted [overflow-wrap:anywhere] cursor-pointer', { layer: 'qk-recipes' }],
  ['qk-comment-thread__messages', 'mt-qk-inline grid gap-qk-surface-compact', { layer: 'qk-recipes' }],
  ['qk-comment-thread__resolved', 'flex items-center gap-qk-inline-tight text-qk-helper leading-qk-helper text-qk-success-text', { layer: 'qk-recipes' }],
  ['qk-comment-thread__composer', 'grid justify-items-end gap-qk-inline', { layer: 'qk-recipes' }],
  ['qk-comment-thread__composer-actions', 'flex w-full flex-wrap items-center justify-end gap-qk-inline-tight', { layer: 'qk-recipes' }],
  ['qk-comment-message', 'grid gap-[2px]', { layer: 'qk-recipes' }],
  ['qk-comment-message__header', 'flex min-w-0 items-center gap-qk-inline', { layer: 'qk-recipes' }],
  ['qk-comment-message__author', 'min-w-0 truncate font-qk-control text-qk-text-secondary', { layer: 'qk-recipes' }],
  ['qk-comment-message__more', 'ms-auto', { layer: 'qk-recipes' }],
  ['qk-comment-message__body', 'min-w-0 whitespace-pre-wrap text-qk-text-tertiary [overflow-wrap:anywhere]', { layer: 'qk-recipes' }],
  ['qk-comment-message__edited', 'ms-qk-inline-tight text-qk-helper leading-qk-helper text-qk-text-muted', { layer: 'qk-recipes' }],
  ['qk-comment-message__editor', 'grid gap-qk-inline', { layer: 'qk-recipes' }],
  ['qk-comment-draft', '[box-shadow:var(--qk-elevation-overlay)]', { layer: 'qk-recipes' }],
  ['qk-comment-field', 'relative grid w-full min-w-0', { layer: 'qk-recipes' }],
  ['qk-comment-mentions', 'm-0 mt-qk-inline-tight grid list-none gap-[2px] rounded-qk-group border border-qk-border-subtle bg-qk-surface-overlay p-qk-inline-tight [box-shadow:var(--qk-elevation-overlay)]', { layer: 'qk-recipes' }],
  ['qk-comment-mentions__item', 'flex min-w-0 cursor-pointer items-baseline gap-qk-inline rounded-qk-control px-qk-inline py-qk-inline-tight text-qk-compact leading-qk-compact text-qk-text-primary', { layer: 'qk-recipes' }],
  ['qk-comment-mentions__label', 'truncate font-qk-control', { layer: 'qk-recipes' }],
  ['qk-comment-mentions__description', 'min-w-0 truncate text-qk-helper leading-qk-helper text-qk-text-tertiary', { layer: 'qk-recipes' }],
  ['qk-comment-mentions__empty', 'px-qk-inline py-qk-inline-tight text-qk-helper leading-qk-helper text-qk-text-tertiary', { layer: 'qk-recipes' }],
  ['qk-comment-rail', 'relative', { layer: 'qk-recipes' }],
  ['qk-comment-rail__item', 'absolute [inset-inline:0]', { layer: 'qk-recipes' }],
];

/** Public anatomy included in both generated CSS and the token atlas. */
export const commentRecipeCatalog = Object.freeze(commentShortcuts.map(shortcut => shortcut[0]));

/** States and progressive disclosure that utilities cannot express. */
export const commentStaticCss = `
.qk-comment-thread { transition: border-color 120ms ease, box-shadow 120ms ease; --qk-button-neutral-foreground: var(--qk-color-text-muted); }
.qk-card.qk-comment-thread { gap: calc(var(--qk-space-inline-tight) * 2); }
.qk-comment-thread:hover { border-color: color-mix(in srgb, var(--qk-color-action-primary) 28%, var(--qk-color-border-subtle)); }
.qk-comment-thread[data-active] { border-color: color-mix(in srgb, var(--qk-color-action-primary) 72%, var(--qk-color-border-default)); }
.qk-comment-thread[data-resolved] { background: var(--qk-color-surface-subtle); }
/* Plain threads are flat list rows: no frame or shadow, a quiet background on hover or focus. */
.qk-card.qk-comment-thread--plain { box-shadow: none; border-color: transparent; background: transparent; border-radius: var(--qk-radius-group); transition: background-color 100ms ease; }
.qk-card.qk-comment-thread--plain:is(:hover, :focus-within, [data-active]) { background: var(--qk-color-surface-hover); }
.qk-comment-draft--plain { display: grid; gap: var(--qk-space-inline); }
/* In a flat row the time follows the name, and text lines up under the name rather than the 24px avatar. */
.qk-comment-thread--plain .qk-comment-thread__time { margin-inline-start: 0; }
.qk-comment-thread--plain :is(.qk-comment-thread__messages, .qk-comment-thread__resolved, .qk-comment-thread__composer) { padding-inline-start: calc(24px + var(--qk-space-inline)); }
.qk-comment-thread--plain .qk-comment-thread__messages + div { padding-inline-start: calc(24px + var(--qk-space-inline)); }
.qk-comment-thread__actions { visibility: hidden; }
/* With previous / next the actions take their own room in the header instead of overlaying the time. */
.qk-comment-thread__header:has(.qk-comment-thread__stepper) .qk-comment-thread__actions { position: static; transform: none; margin-inline-end: -4px; }
.qk-comment-thread__header:has(.qk-comment-thread__stepper) .qk-comment-thread__time { display: none; }
.qk-comment-thread:is(:hover, :focus-within, [data-active]) .qk-comment-thread__actions { visibility: visible; }
.qk-comment-thread:is(:hover, :focus-within, [data-active]) .qk-comment-thread__header:has(.qk-comment-thread__actions > *) .qk-comment-thread__time { visibility: hidden; }
.qk-comment-thread__quote { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.qk-comment-thread__quote::before { content: ""; position: absolute; inset-block: 1px; inset-inline-start: 0; inline-size: 2px; border-radius: 1px; background: var(--qk-color-border-subtle); pointer-events: none; }
.qk-comment-thread__quote:disabled { cursor: default; }
.qk-comment-thread__quote:not([data-state="text"]) { font-style: italic; }
.qk-comment-thread__composer-actions > small { margin-inline-end: auto; color: var(--qk-color-text-tertiary); font: var(--qk-type-helper-font-weight) var(--qk-type-helper-font-size)/var(--qk-type-helper-line-height) var(--qk-type-helper-font-family); }
.qk-comment-message[data-reply] { padding-block-start: var(--qk-space-inline); border-block-start: var(--qk-border-width-default) solid var(--qk-color-border-subtle); }
.qk-comment-message__header .qk-comment-thread__time { margin-inline-start: 0; }
.qk-comment-message__more { opacity: 0; transition: opacity 100ms ease; }
.qk-comment-message:is(:hover, :focus-within) .qk-comment-message__more, .qk-comment-message__more[aria-expanded="true"] { opacity: 1; }
.qk-comment-mentions__item[aria-selected="true"] { background: var(--qk-color-surface-hover); }
.qk-comment-rail__item { transition: inset-block-start 120ms ease; }
/* Transparent rather than hidden: a draft opening in the rail must take focus before its height is measured. */
.qk-comment-rail__item:not([data-measured]) { opacity: 0; }
@media (pointer: coarse) { .qk-comment-thread__composer-actions > small { display: none; } }
@media (prefers-reduced-motion: reduce) { .qk-comment-thread, .qk-comment-rail__item, .qk-comment-message__more { transition: none; } }
`;
