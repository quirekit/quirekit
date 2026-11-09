import { EditorView } from "@quirekit/cm-view";
import { Prec } from "@quirekit/cm-state";
import { themeVariableReferences as token } from "@quirekit/ui";

/** A neutral hint that keeps text legible over both light and dark Prose surfaces. */
/** Document glyph masked with the link colour. */
const documentGlyph = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>')}")`;
const activeBlockSurface = `color-mix(in srgb, ${token.color.text.primary} 4%, transparent)`;

/** Text-like bars painted on unrendered ranges; a background needs no main thread when scrolling outruns rendering. */
const unrenderedLines = `repeating-linear-gradient(to bottom, transparent 0 6px, ${activeBlockSurface} 6px 18px, transparent 18px 28px)`;

/** Extra inner space for the heading disclosure rail and its focus outline. */
const controlInset = `max(0px, calc(32px - ${token.spacing.surface}))`;

/** Selection paint belongs to the rich editor, including block widgets outside native text lines. */
const selectionContent = "&:not([data-msfe-mode=source]) > .cm-scroller > .cm-content";

/**
 * Only editor geometry and source affordances live here. Document typography,
 * surfaces, nesting and rhythm are owned by the public Prose and CodeBlock recipes.
 */
export const proseEditorGeometry = Prec.high(EditorView.theme({
  "&": { ...token.typography.body, color: token.color.text.primary, backgroundColor: "transparent" },
  "&.cm-focused": { outline: "none" },
  // Keep controls inside the native scrollport. Grow its left edge by the same
  // inset so document text and available wrapping width remain unchanged.
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "inherit", marginLeft: `calc(-1 * ${controlInset})` },
  ".cm-content": { padding: token.spacing.surface, paddingLeft: `max(32px, ${token.spacing.surface})`, caretColor: token.color.text.primary },
  "&[data-msfe-mode=live] .cm-content, &[data-msfe-mode=locked] .cm-content": { fontFamily: "inherit", maxWidth: "none", margin: "0" },
  ".cm-line": { padding: "0", font: "inherit", letterSpacing: "inherit" },
  ".cm-gap": { backgroundImage: unrenderedLines },
  ".cm-content:not(.qk-prose)": { ...token.typography.code },
  // Source gutters share the code font so numbers sit on the same line boxes as the text; no separate surface.
  ".cm-gutters": { ...token.typography.code, color: token.color.text.muted, background: "transparent", border: "none" },
  // Source mode folds in its own gutter, so the disclosure inset reserved for rich modes is not needed.
  "&[data-msfe-mode=source] .cm-content": { paddingLeft: "4px" },
  ".cm-lineNumbers .cm-gutterElement": { minWidth: "3ch", padding: "0 6px 0 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" },
  ".cm-activeLine, .cm-activeLineGutter": { background: "transparent" },
  ".cm-lineNumbers .cm-activeLineGutter": { color: token.color.text.secondary },
  // Center the chevron in the line box instead of on the text baseline.
  ".cm-foldGutter .cm-gutterElement": { display: "flex", alignItems: "center", justifyContent: "center", width: "16px", paddingRight: "8px", color: token.color.icon.secondary },
  ".cm-foldGutter .msfe-control-icon": { display: "inline-flex", cursor: "pointer" },
  ".cm-foldGutter .msfe-control-icon svg": { width: "14px", height: "14px" },
  ".cm-foldGutter .msfe-control-icon:hover": { color: token.color.text.primary },
  // Rich surfaces use measured DOM fragments. Source mode retains CM's original
  // line-spanning rectangles; both keep its canonical selection and cursor.
  "&:not([data-msfe-mode=source]) > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": { display: "none" },
  [`${selectionContent}::selection, ${selectionContent} ::selection`]: { backgroundColor: "transparent !important" },
  // Preserve independent native selection inside a focused embedded control.
  [`${selectionContent} :focus::selection, ${selectionContent} :focus ::selection`]: { backgroundColor: "Highlight !important" },
  ".cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
    background: token.color.selection.document,
  },
  ".md-document-selection-layer, .md-document-selection": { pointerEvents: "none" },
  ".md-document-selection": { left: "0", top: "0", width: "0", height: "0" },
  ".md-document-selection svg": { display: "block", overflow: "visible" },
  ".md-document-selection path": { fill: token.color.selection.document },
  ".cm-cursor": { borderLeftColor: token.color.text.primary },
  "&[data-msfe-input-proxy] > .cm-scroller > .cm-cursorLayer": { display: "none" },
  // The public handle stem is the primary caret only while it owns a visible
  // touch endpoint. Secondary ranges and independent embedded input stay native.
  "&[data-md-mobile-selection] > .cm-scroller > .cm-cursorLayer .cm-cursor-primary": { visibility: "hidden" },
  "&[data-md-mobile-selection] > .cm-scroller > .cm-selectionLayer .cm-selectionHandle": { display: "none" },
  // Blur to a settings surface retains CM's existing position geometry. It is
  // static and passive; focus/composition and touch handles keep native ownership.
  "&[data-md-retained-selection]:not(.cm-focused) > .cm-scroller > .cm-cursorLayer": { animation: "none !important", opacity: "1" },
  "&[data-md-object-selected] > .cm-scroller > .cm-cursorLayer": { display: "none" },
  "&[data-md-retained-selection]:not(.cm-focused) > .cm-scroller > .cm-cursorLayer .cm-cursor-primary": { display: "block", visibility: "visible", borderLeftColor: token.color.text.accent },
  // The find-and-replace card floats over the text, so its top panel adds no band or height.
  ".cm-panels.cm-panels-top:has(> .msfe-search-panel)": { height: "0", overflow: "visible", border: "none", background: "transparent" },
  ".msfe-search-panel": { position: "relative" },
  ".md-active-block-layer": { pointerEvents: "none" },
  // The default 6px group corner plus the 6px paint spread makes a 12px outer corner.
  ".md-active-block": { background: activeBlockSurface, borderRadius: token.radius.group,
    boxShadow: `0 0 0 ${token.spacing.inline} ${activeBlockSurface}` },
  // Keep source DOM boundaries without adding layout height. Navigation checks
  // the actual line box rather than accepting the font's phantom rectangle.
  // A fully hidden table delimiter needs block geometry rather than a flex row.
  ".cm-line.md-hidden-line, .cm-line.md-rule, .msfe-table-separator:not(.msfe-table-active)": {
    display: "block", position: "relative", overflow: "visible", height: "0", minHeight: "0",
    fontSize: "inherit", lineHeight: "0", padding: "0",
  },
  ".cm-line.md-hidden-line > br, .cm-line.md-rule > br, .msfe-table-separator:not(.msfe-table-active) > br": { position: "absolute" },
  // A zero-height float keeps the native BR/font and static rectangle measurable
  // without interrupting Prose's sibling margin collapse. Selection never changes
  // this geometry; native navigation excludes the structural separator interior.
  ".cm-line.md-separator-line": { height: "0", minHeight: "0", lineHeight: "0", padding: "0", position: "relative", float: "inline-start", width: "100%" },
  ".cm-line.md-separator-line > br": { position: "absolute" },
  // An empty paragraph row keeps paragraph spacing, so its first typed character does not move it.
  ".cm-line.md-empty-paragraph": { marginBlock: "var(--qk-prose-block-space, var(--qk-space-surface))" },
  ".cm-line.md-empty-paragraph:first-child": { marginBlockStart: "0" },
  ".cm-line.md-empty-paragraph:last-child": { marginBlockEnd: "0" },
  // An empty row that typing joins to the paragraph above sits where that text will, so the
  // block before it, and the last blocks nested in it, end without their gap.
  ":is([data-qk-prose], ul, ol):has(+ .cm-line.md-continuation-row), :is([data-qk-prose], ul, ol):has(+ .cm-line.md-continuation-row) :is([data-qk-prose], li):last-child": { marginBottom: "0" },
  // A row hint draws where its text would start; it takes no width, so the caret stays in place.
  ".cm-line.md-line-placeholder::before": { content: "attr(data-placeholder)", position: "absolute", color: token.color.text.placeholder,
    pointerEvents: "none", whiteSpace: "nowrap", fontWeight: "inherit" },
  ".msfe-heading": { padding: "0" },
  ".msfe-link": { color: token.color.text.accent },
  // A host document reference reads as a document glyph plus title; hovering highlights it as one chip.
  ".msfe-link-reference": {
    paddingInline: "0.2em", borderRadius: "4px", textDecoration: "none", transition: "background-color 120ms",
    boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone",
  },
  ".msfe-link-reference:hover": { backgroundColor: `color-mix(in srgb, ${token.color.text.accent} 10%, transparent)` },
  ".msfe-link-reference::before": {
    content: '""', display: "inline-block", width: "1em", height: "1em", marginInlineEnd: "0.2em", verticalAlign: "-0.15em",
    backgroundColor: "currentColor", mask: `${documentGlyph} center / contain no-repeat`, WebkitMask: `${documentGlyph} center / contain no-repeat`,
  },
  ".msfe-footnote-reference": { fontSize: "0.75em", verticalAlign: "super", color: token.color.text.accent, cursor: "pointer" },
  ".msfe-footnote-backlink": { color: token.color.text.accent, cursor: "pointer" },
  ".msfe-preview": { maxWidth: "100%" },
  ".msfe-preview-displayMath, .msfe-preview-mermaid, .msfe-preview-textDiagram": { display: "block", overflowX: "auto" },
  ".msfe-preview svg": { maxWidth: "100%", height: "auto" },
  ".msfe-preview-mermaid > svg, .msfe-preview-textDiagram > svg": { display: "block", marginInline: "auto" },
  ".msfe-preview-mermaid > img": { display: "block", marginInline: "auto", maxWidth: "100%", height: "auto" },
  ".msfe-preview-mermaid[data-status=loading], .msfe-preview-textDiagram[data-status=loading]": { minHeight: "6em" },
  ".msfe-preview-controls": { display: "inline-flex", verticalAlign: "middle" },
  // An empty inline-flex box still opens a line box below block previews.
  ".msfe-preview-controls:empty": { display: "none" },
  ".md-source-marker": { color: token.color.text.tertiary },
  "li:has(> .cm-line.md-source-list-line), li:has(> [data-qk-prose=p] > .md-source-list-line)": { listStyleType: "none" },
  ".md-source-list-marker": { display: "inline-block", width: "var(--qk-prose-list-indent)", marginInlineStart: "calc(-1 * var(--qk-prose-list-indent))", whiteSpace: "pre" },
  ".md-source-quote-marker": { display: "inline-block", width: `calc(${token.spacing.surface} + var(--qk-border-width-focus))`, marginInlineStart: `calc(-1 * (${token.spacing.surface} + var(--qk-border-width-focus)))`, whiteSpace: "pre" },
  "blockquote:has(> [data-qk-prose=p] > .md-source-quote-line)::before": { display: "none" },
  ".qk-prose-container__header > .cm-line": { flex: "1", minWidth: "0", fontWeight: "inherit" },
  ".cm-line.md-container-end": { padding: `0 ${token.spacing.surface} ${token.spacing.surface}` },
  // The opening line stays in flow at zero height, like hidden fences, so CM's height map matches the
  // rendered rows; its icon floats into the first body row. Revealed source restores the line.
  "[data-qk-prose-highlight] > .cm-line.md-container-end": { padding: "0" },
  ".qk-prose-container[data-qk-prose-highlight] > .qk-prose-container__header": { float: "none", display: "block", blockSize: "auto", marginInlineEnd: "0" },
  ".qk-prose-container[data-qk-prose-highlight] > .qk-prose-container__header > .cm-line:not(.md-highlight-source)": {
    display: "block", position: "relative", overflow: "visible", height: "0", minHeight: "0", lineHeight: "0", padding: "0",
  },
  ".qk-prose-container[data-qk-prose-highlight] > .qk-prose-container__header > .cm-line:not(.md-highlight-source) > br": { position: "absolute" },
  ".qk-prose-container[data-qk-prose-highlight] > .qk-prose-container__header > .cm-line:not(.md-highlight-source) > .msfe-component-view": {
    float: "inline-start", marginInlineEnd: token.spacing.inline,
    display: "flex", alignItems: "center", lineHeight: "var(--qk-type-body-line-height)", height: "var(--qk-type-body-line-height)",
  },
  ".md-task-item": { listStyleType: "none" },
  ".msfe-node-view[data-msfe-kind='TaskMarker']": { display: "inline-flex", width: "var(--qk-prose-list-indent)", height: "1lh", alignItems: "center", verticalAlign: "top" },
  ".md-source-task-marker": { display: "inline-block", width: "var(--qk-prose-list-indent)" },
  ".md-source-task-marker, .md-source-task-marker *": { color: token.color.text.tertiary },
  ".msfe-node-view[data-msfe-kind='Image']": { display: "inline-block", maxWidth: "100%", verticalAlign: "middle" },
  ".msfe-component-view[data-msfe-component^='container-controls/']": { display: "inline-flex", verticalAlign: "middle", marginInlineEnd: token.spacing.inline },
  // A whole-fence figure owns its visual surface. The retained source wrapper
  // still maps selection, but must not add a code frame or duplicate block rhythm.
  ".qk-code-block:has(> .msfe-component-view > figure)": { border: "none", borderRadius: "0", background: "transparent", overflow: "visible", margin: "0" },
  // The opening line owns a visible header widget; retain its height while its
  // zero-width caret buffers share that row instead of making an anonymous line
  // below the block widget. Keep their native font and measurable caret height.
  ".qk-code-block > .cm-line.md-code-boundary-preview": { display: "flex", alignItems: "center", fontSize: "inherit", lineHeight: "0", position: "relative" },
  ".qk-code-block > .cm-line.md-code-boundary-preview > br": { position: "absolute" },
  // Empty source-replacement spans still own caret geometry in this flex row.
  ".qk-code-block > .cm-line.md-code-boundary-preview > span[contenteditable=false]:empty": { height: "1em", flex: "none" },
  ".qk-code-block > .cm-line:not(.md-code-boundary-preview):not(.md-hidden-line)": { ...token.typography.code, paddingInline: token.spacing.surface },
  ".qk-code-block .msfe-node-view": { display: "block", width: "100%" },
  ".qk-code-block__viewport > .cm-line": { font: "inherit", background: "transparent" },
  ".msfe-table-cell": { borderColor: token.color.border.subtle },
  ".msfe-table-pipe *": { color: "inherit" },
  ".msfe-table-header": { fontWeight: "inherit" },
  "[data-qk-prose=table]:has(> .md-source-table-line)": { padding: token.spacing.surface, background: token.color.surface.subtle, borderRadius: token.radius.group },
  ".cm-line.md-source-table-line": { ...token.typography.code, whiteSpace: "pre", overflowWrap: "normal" },
  ".cm-line.md-source-table-header": { fontWeight: token.typography.heading.fontWeight },
}));
