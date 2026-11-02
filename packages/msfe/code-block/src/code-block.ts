import { Node, sourceCommand, defineSource, sourceDocument, sourceNode } from "@quirekit/msfe-core";
import { readCodeBlock, patchCodeBlock } from "./source";
import { codeBlockRenderer } from "./renderer";
import { Decoration, EditorView } from "@quirekit/cm-view";
import { syntaxTree } from "@quirekit/cm-language";
import type { Range } from "@quirekit/cm-state";
import type { MsfeCommand, MsfeExtension } from "@quirekit/msfe-core";
import type { CodeBlockOptions } from "./types";
import { emptyCodeLayer } from "./empty/layer";
import { codeBlockBoundary } from "./boundaries";
import { indentCode } from "./indent";

/** @returns Code container projection retaining the outer editor as the only input owner. */
function codeBlockBackend(): MsfeExtension {
  return { id: "code-block", commands: { setCodeLanguage }, projections: [{ nodes: ["FencedCode", "CodeBlock"], decorate({ state, node, active, from, to }) {
    const ranges: Range<Decoration>[] = [];
    const first = state.doc.lineAt(Math.max(from, node.from)).number;
    const last = state.doc.lineAt(Math.min(to, node.to)).number;
    const start = state.doc.lineAt(node.from).number, end = state.doc.lineAt(node.to).number;
    const marks = node.getChildren("CodeMark"), projected = !active && marks.length === 2;
    for (let number = first; number <= last; number++) {
      // Boundaries come from source, never viewport adjacency, so scrolling cannot move corners.
      const classes = ["msfe-code-line", number === start && node.name === "FencedCode" ? "msfe-code-start" : "",
        node.name === "CodeBlock" ? "msfe-code-indented" : "",
        node.name === "CodeBlock" && number === start ? "msfe-code-indented-start" : "",
        node.name === "CodeBlock" && number === end ? "msfe-code-indented-end" : "",
        node.name === "FencedCode" && number === start + 1 ? "msfe-code-body-start" : "",
        number === end && marks.length === 2 ? "msfe-code-end" : "",
        number === end && projected ? "msfe-code-end-preview" : "",
        number === start && projected ? "msfe-code-start-preview" : ""];
      ranges.push(Decoration.line({ class: classes.filter(Boolean).join(" ") }).range(state.doc.line(number).from));
    }
    if (projected) for (const mark of [...marks, ...node.getChildren("CodeInfo")]) {
      // Hide each fence token independently; never replace a line break from a viewport plugin.
      ranges.push(Decoration.replace({}).range(mark.from, mark.to));
    }
    return ranges;
  } }], extensions: EditorView.baseTheme({
    ".msfe-code-line": { fontFamily: "ui-monospace, SFMono-Regular, monospace", backgroundColor: "#8095a014", fontSize: ".92em" },
    // The projected opening fence shows only its header view; the hidden info string adds no line box of its own.
    ".cm-line.msfe-code-start-preview": { display: "flex", alignItems: "center", position: "relative", fontSize: "inherit", lineHeight: "0" },
    ".cm-line.msfe-code-start-preview > br": { position: "absolute" },
    ".cm-line.msfe-code-start-preview > .msfe-node-view": { display: "block", width: "100%", lineHeight: "normal" },
    // The projected closing fence takes no height until the caret reveals it; its BR stays measurable for selection.
    ".cm-line.msfe-code-end-preview": { height: "0", minHeight: "0", lineHeight: "0", fontSize: "inherit", padding: "0", overflow: "visible", position: "relative", display: "block" },
    ".cm-line.msfe-code-end-preview > br": { position: "absolute" },
  }) };
}

/**
 * Changes only the selected fenced code block's info string.
 * @param language - Safe single-line info string.
 * @returns A source command, or not-applicable outside a confirmed fenced block.
 */
export function setCodeLanguage(language: string): MsfeCommand {
  return state => {
    if (/[\r\n`~]/u.test(language) || state.selection.ranges.length !== 1) return null;
    let node = syntaxTree(state).resolveInner(state.selection.main.head, -1);
    while (node.name !== "FencedCode" && node.parent) node = node.parent;
    if (node.name !== "FencedCode") return null;
    const changes = patchCodeBlock(sourceDocument(state), sourceNode(node), { language });
    return changes === null ? null : { changes };
  };
}

/** Configurable fence semantics with independently replaceable component rendering. */
export const CodeBlock = Node.create<CodeBlockOptions>({ name: "code-block",
  /** @returns A source-neutral empty code input entry. */
  addOptions: () => ({ emptyLine: true, emptyLineLabel: "输入代码" }),
  /** @returns Declarative shell ownership, active only when syntax is hidden. */
  addEditingBoundaries: () => [codeBlockBoundary],
  /** @returns Measured placeholder only when the canonical block has no body line. */
  addProjectionLayers() { return emptyCodeLayer(this.name, this.options, () => this.editor); },
  addCommands() { return { setCodeLanguage: (language: string) => sourceCommand(setCodeLanguage(language)),
    indentCode: () => sourceCommand(indentCode(1)), outdentCode: () => sourceCommand(indentCode(-1)) }; },
  /** @returns Code-editor indentation inside fenced bodies; elsewhere the keys fall through to other owners. */
  addKeyboardShortcuts() { return { Tab: () => this.editor.commands.indentCode(), "Shift-Tab": () => this.editor.commands.outdentCode(),
    "Mod-]": () => this.editor.commands.indentCode(), "Mod-[": () => this.editor.commands.outdentCode() }; },
  addAttributes() { return { language: { default: "", validate: value => typeof value === "string" && /^[a-zA-Z0-9_+#.-]{0,40}$/u.test(value) } }; },
  addSource() { return defineSource({ nodes: ["FencedCode"], placement: "before", read: readCodeBlock, patch: patchCodeBlock,
    source: (document, node) => document.lineAt(node.from).text, renderer: codeBlockRenderer }); },
  addProjections() { return codeBlockBackend().projections!; },
  addCodeMirrorExtensions() { return codeBlockBackend().extensions!; },
});

/** @returns Independently configured source-backed code container. */
export function codeBlock() { return CodeBlock.configure({}); }
