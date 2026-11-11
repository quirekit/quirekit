import { Heading } from "@quirekit/msfe-heading";
import { Bold } from "@quirekit/msfe-bold";
import { CodeBlock, fencePairing } from "@quirekit/msfe-code-block";
import { Link } from "@quirekit/msfe-link";
import { Blockquote, ListMarkers, Emphasis, InlineCode, Strikethrough, Table, HorizontalRule } from "@quirekit/msfe-prose";
import { CustomContainer, type ContainerStorage } from "@quirekit/msfe-markdown-extras";
import { Decoration, keymap } from "@quirekit/cm-view";
import { Prec } from "@quirekit/cm-state";
import { commandKeyBinding } from "@quirekit/msfe-core";
import { semanticProjection, prefixProjection, emphasisProjection, tableProjection } from "./projection/marks";
import { containerProjection, mdContainerTypes } from "./projection/container";
import { withHighlightIcons, nativeHighlightIcon } from "./projection/highlight";
import type { MdContainerOptions } from "../types";
import { paragraphInput, markupInput, fenceInput, tableInput, lineBreakInput, exitInput } from "../input/behavior";
import { deleteListMarkupBackward } from "../input/list";
import { deleteForward } from "../input/edges/forward";
import { tableCellInput } from "../input/table";
import { unwrapQuoteLine } from "../input/quote";
import { prefixBoundary, setextBoundary, containerBoundary } from "./boundaries/blocks";
import { linkBoundary } from "./boundaries/inline";
import { tableBoundary, tableRowBoundary } from "./boundaries/table";

/** Safe link labels use the same paired-boundary editing as other inline styles. */
export const ProseLink = Link.extend({
  /** @returns Protected destination and editable label facts. */
  addEditingBoundaries: () => [linkBoundary],
});

/** Native heading blocks own typography; the source feature retains commands and marker reveal. */
export const ProseHeading = Heading.extend({ addCodeMirrorExtensions: () => [],
  /** @returns Structural heading markers shared by every input operation. */
  addEditingBoundaries: () => [prefixBoundary(["ATXHeading1", "ATXHeading2", "ATXHeading3", "ATXHeading4", "ATXHeading5", "ATXHeading6"], "HeaderMark"), setextBoundary],
  /** @returns Heading splits and explicit breaks, delegating nested continuation to the enclosing block. */
  addBlockInput: () => [{ nodes: ["ATXHeading1", "ATXHeading2", "ATXHeading3", "ATXHeading4", "ATXHeading5", "ATXHeading6", "SetextHeading1", "SetextHeading2"],
    enter: paragraphInput, lineBreak: lineBreakInput, exit: exitInput }],
});
/** Strong text inherits the public Prose emphasis weight. */
export const ProseBold = Bold.extend({ addCodeMirrorExtensions: () => [],
  /** @returns Existing source ranges rendered through the public strong element. */
  addProjections() { return this.parent!().map(projection => semanticProjection(projection, { "msfe-bold": "strong" })); },
});
/** Editable code retains feature semantics and receives the public CodeBlock frame. */
export const ProseCodeBlock = CodeBlock.extend({
  /** @returns Closing-fence pairing only; product typography replaces the base fence theme. */
  addCodeMirrorExtensions() { return this.options.closeFence ? fencePairing : []; },
  /** @returns Literal input isolation and explicit exit for code blocks. */
  addBlockInput: () => [
    { nodes: ["FencedCode"], enter: fenceInput, lineBreak: "native", exit: exitInput },
    { nodes: ["CodeBlock"], enter: "native", lineBreak: "native", exit: exitInput },
  ],
  /** @returns Header geometry that preserves editable fences when syntax is revealed. */
  addProjections() { return this.parent!().map(projection => ({ ...projection,
    /** @param input - Confirmed code and source visibility. @returns Existing code projection with an inactive boundary marker. */
    decorate(input) {
      const ranges = [...projection.decorate(input)];
      if (!input.active && input.node.name === "FencedCode" && input.node.getChildren("CodeMark").length === 2) {
        ranges.push(Decoration.line({ class: "md-code-boundary-preview" }).range(input.state.doc.lineAt(input.node.from).from));
        ranges.push(Decoration.line({ class: "md-hidden-line" }).range(input.state.doc.lineAt(input.node.to).from));
      }
      return ranges;
    },
  })); },
});
/** Quote structure is owned by native wrappers, never repeated row borders. */
export const ProseBlockquote = Blockquote.extend({ addProjectionLayers: () => [],
  /** @returns Backspace that moves a later quote line out as its own paragraph. */
  addCodeMirrorExtensions: () => [Prec.highest(keymap.of([commandKeyBinding("Backspace", unwrapQuoteLine)]))],
  /** @returns Per-line quote prefixes; nested quote levels retain separate ownership. */
  addEditingBoundaries: () => [prefixBoundary(["QuoteMark"], null)],
  /** @returns Quote continuation and one-level exit determined by current source. */
  addBlockInput: () => [{ nodes: ["Blockquote"], enter: markupInput, lineBreak: lineBreakInput, exit: exitInput }],
  addProjections: () => [{ nodes: ["QuoteMark"], decorate: prefixProjection }],
});
/** Native list markers and indentation remain governed by the original list commands. */
export const ProseListMarkers = ListMarkers.extend({ addProjections: () => [{ nodes: ["ListMark"], decorate: prefixProjection }],
  /** @returns Backspace/Delete at item text edges, ahead of Markdown's own markup deletion. */
  addCodeMirrorExtensions: () => [Prec.highest(keymap.of([commandKeyBinding("Backspace", deleteListMarkupBackward),
    commandKeyBinding("Delete", deleteForward)]))],
  /** @returns List and task prefixes as complete structural units. */
  addEditingBoundaries: () => [prefixBoundary(["ListItem"], "ListMark"), prefixBoundary(["TaskMarker"], null)],
  /** @returns List/task continuation, empty-item outdent and explicit block exit. */
  addBlockInput: () => [{ nodes: ["ListItem", "BulletList", "OrderedList"], enter: markupInput, lineBreak: lineBreakInput, exit: exitInput }],
});
/** Shared native inline element roles. */
export const ProseEmphasis = Emphasis.extend({ addProjectionLayers: () => [],
  addProjections: () => [{ nodes: ["Emphasis"], decorate: emphasisProjection }],
});
/** Inline code normalization remains source-owned. */
export const ProseInlineCode = InlineCode.extend({
  /** @returns Original normalization with native code markup. */
  addProjections() { return this.parent!().map(projection => semanticProjection(projection, { "msfe-inline-code": "code" })); },
});
/** Deletion styling shares the native Prose element. */
export const ProseStrikethrough = Strikethrough.extend({
  /** @returns Original ranges rendered through the public deletion element. */
  addProjections() { return this.parent!().map(projection => semanticProjection(projection, { "msfe-strike": "del" })); },
});
/** Cells retain MSFE's measured grid and commands while consuming Prose styles. */
export const ProseTable = Table.extend({
  /** @returns Shared navigation and edit protection for table structure. */
  addEditingBoundaries: () => [tableBoundary, tableRowBoundary],
  /** @returns In-cell line breaks routed through the same atomic input boundary as other blocks. */
  addBlockInput: () => [{ nodes: ["Table"], enter: tableInput, lineBreak: tableInput, exit: exitInput }],
  /** @returns Cell edges and literal pipes that keep the row structure. */
  addCodeMirrorExtensions() { return [this.parent!(), tableCellInput]; },
  /** @returns Source-owned table geometry using public cell roles. */
  addProjections() { return this.parent!().map(tableProjection); },
});
/** Containers retain source queries and disclosure state; only presentation is replaced. */
export const ProseContainer = CustomContainer.extend<MdContainerOptions, ContainerStorage>({
  /** @returns The container's editable title/body and hidden shell. */
  addEditingBoundaries: () => [containerBoundary],
  /** @returns Product container names and a static highlight icon for hosts without a framework renderer. */
  addOptions() { return { ...this.parent!(), types: mdContainerTypes, highlightIcon: nativeHighlightIcon, highlightLabel: (emoji: string) => `Change icon ${emoji}` }; },
  addProjections: () => [{ nodes: ["CustomContainer"], decorate: containerProjection }],
  /** @returns Disclosure layers whose control pass also replaces each highlight's opening line with its icon. */
  addProjectionLayers() {
    const { highlightIcon, highlightLabel } = this.options;
    return this.parent!().map(layer => layer.key === "container-controls" ? withHighlightIcons(layer, highlightIcon, highlightLabel, () => this.editor) : layer);
  },
  /** @returns Container paragraph input while nested semantic blocks retain nearer ownership. */
  addBlockInput: () => [{ nodes: ["CustomContainer"], enter: paragraphInput, lineBreak: lineBreakInput, exit: exitInput }],
});
/** A thematic break is one Prose rule; active syntax is still editable. */
export const ProseHorizontalRule = HorizontalRule.extend({
  /** @returns A thematic break is selected and deleted as one object. */
  addEditingBoundaries: () => [{ nodes: ["HorizontalRule"],
    /** @param context - Confirmed rule. @returns A complete source owner without editable marker text. */
    resolve: ({ node }) => ({ from: node.from, to: node.to, contentFrom: node.from, contentTo: node.to, kind: "atom", deletion: "protect" }),
  }],
  /** @returns A paragraph after a thematic break. */
  addBlockInput: () => [{ nodes: ["HorizontalRule"], enter: paragraphInput, lineBreak: "native", exit: exitInput }],
  addProjections: () => [{ nodes: ["HorizontalRule"],
  /** @param input - Confirmed rule. @returns A semantic line or active source. */
  decorate({ state, node, active }) {
    if (active) return [];
    return [Decoration.line({ attributes: { "data-qk-prose": "hr", role: "separator" }, class: "md-rule" }).range(state.doc.lineAt(node.from).from),
      Decoration.replace({}).range(node.from, node.to)];
  },
}] });
