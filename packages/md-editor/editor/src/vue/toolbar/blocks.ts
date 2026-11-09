import type { MdEditorLocale } from "../types";
import { SOURCE_CARET } from "@quirekit/msfe-core";
import { mdEditorMessages } from "../messages";

/** @param locale - Language for labels and the one required definition term. @returns Empty canonical Markdown skeletons; SOURCE_CARET marks the caret, or selects a required term. */
export function insertionBlocks(locale: MdEditorLocale) {
  const text = mdEditorMessages[locale], c = SOURCE_CARET;
  return [
    { id: "quote", feature: "blockquote", label: text.quote, source: "> " },
    { id: "list", feature: "listMarkers", label: text.list, source: "- " },
    { id: "ordered", feature: "listMarkers", label: text.ordered, source: "1. " },
    { id: "task", feature: "taskItem", label: text.task, source: "- [ ] " },
    { id: "table", feature: "table", label: text.table, source: `| ${c} |  |\n| --- | --- |\n|  |  |` },
    { id: "code", feature: "code-block", label: text.code, source: `\`\`\`\n${c}\n\`\`\`` },
    { id: "note", feature: "customContainer", label: text.note, source: `::: note\n${c}\n:::` },
    { id: "warning", feature: "customContainer", label: text.warning, source: `::: warning\n${c}\n:::` },
    { id: "details", feature: "customContainer", label: text.details, source: `::: details\n${c}\n:::` },
    { id: "highlight", feature: "customContainer", label: text.highlightBlock, source: `::: highlight {emoji=📌 color=orange}\n${c}\n:::` },
    { id: "nested", feature: "customContainer", label: text.nested, source: `:::: note\n${c}\n\n::: warning\n\n:::\n::::` },
    // Asterisks remain a divider at document start, where --- can open YAML metadata.
    { id: "divider", feature: "horizontalRule", label: text.divider, source: "***" },
    // A definition needs a term line, so the term is selected for typing over.
    { id: "definition", feature: "definitionList", label: text.definition, source: `${c}${locale === "en" ? "Term" : "术语"}${c}\n: ` },
  ];
}

/** @param locale - New diagram content language. @returns Starting Mermaid flowchart for a new text diagram; other languages come from the workspace templates. */
export function textDiagramTemplate(locale: MdEditorLocale): string {
  return locale === "en" ? "flowchart LR\n  A[Idea] --> B[Draft]\n  B --> C[Review]\n  C --> D[Publish]" : "flowchart LR\n  A[想法] --> B[草稿]\n  B --> C[审阅]\n  C --> D[发布]";
}
