import { EditorView } from "@quirekit/cm-view";

/** Fallback colors; products override the custom properties with their design tokens. */
export const commentsTheme = EditorView.baseTheme({
  ".msfe-comment": { backgroundColor: "var(--msfe-comment-highlight, rgba(234, 179, 8, .16))",
    borderBottom: "2px solid var(--msfe-comment-underline, rgba(234, 179, 8, .55))" },
  ".msfe-comment-active": { backgroundColor: "var(--msfe-comment-active, rgba(234, 179, 8, .34))" },
  ".msfe-comment-marker": { display: "inline-block", width: "8px", height: "8px", margin: "0 1px", padding: "0", verticalAlign: "middle",
    border: "none", borderRadius: "50%", background: "var(--msfe-comment-underline, rgba(234, 179, 8, .55))", cursor: "pointer" },
  ".msfe-comment-marker-active": { background: "var(--msfe-comment-marker-active, rgb(202, 138, 4))" },
  // Components that replace their source show the comment as an outline.
  "[data-msfe-commented]": { outline: "2px solid var(--msfe-comment-underline, rgba(234, 179, 8, .55))", outlineOffset: "2px", borderRadius: "4px" },
  "[data-msfe-commented=active]": { outlineColor: "var(--msfe-comment-marker-active, rgb(202, 138, 4))" },
});
