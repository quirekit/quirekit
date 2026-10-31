import type { Node } from "@quirekit/pm";
import type { QuireDocumentChange, QuireDocumentTextPiece } from "../../document-sdk/types";
import type { QuireAiRegistry } from "../types";
import { collectQuireAiBlocks, collectQuireAiSections } from "./collect";
import { readQuireAiFormats } from "./inline";
import { compareCharacters, compareValues } from "./change-formats";
import { compareQuireAiObjects, listQuireAiObjects, presentQuireAiNode } from "./change-objects";
import { renderBlockLine } from "./render";
import { describeQuireAiSettingChanges } from "./settings";
import { diffQuireAiSequences, type QuireAiDiffStep } from "./sequence";
import type { QuireAiChangeBlock, QuireAiChangeObject } from "./types";

/** Longest excerpt shown to locate a block. */
const excerptLength = 60;


/**
 * Lists what changed between two documents, block by block, for people reviewing an edit.
 *
 * Blocks are matched by their view line and the images they show, so unchanged blocks pair
 * exactly and a run of changed blocks pairs in order within one section: a pair is an edited
 * block, the rest are added or removed. Edited blocks compare text character by character,
 * formats on the characters both sides keep, and their images. Objects read as people see
 * them, never as their view label.
 *
 * @param source - Document before the edit.
 * @param candidate - Document after the edit.
 * @param registry - Compiled facts, which also name formats for people.
 * @returns Changes in document order.
 */
export function describeQuireAiChanges(source: Node, candidate: Node, registry: QuireAiRegistry): QuireDocumentChange[] {
  const before = collectEntries(source, registry);
  const after = collectEntries(candidate, registry);
  const changes: QuireDocumentChange[] = describeQuireAiSettingChanges(source, candidate, registry);
  let removed: QuireAiChangeBlock[] = [];
  let inserted: QuireAiChangeBlock[] = [];
  // Points after the last block passed on each side, where an unpaired block of the other side goes.
  let sourcePoint = before[0]?.range.from ?? 0;
  let candidatePoint = after[0]?.range.from ?? 0;
  // Flushes one run of unmatched blocks: same-section pairs become edits, in order.
  const flush = () => {
    const pairs = Math.min(removed.length, inserted.length);
    for (let index = 0; index < Math.max(removed.length, inserted.length); index += 1) {
      const a = removed[index];
      const b = inserted[index];
      if (index < pairs && a!.section === b!.section) changes.push(describeEdit(a!, b!, registry));
      else {
        if (a !== undefined) changes.push(describeWhole("removed", a, { from: candidatePoint, to: candidatePoint }));
        if (b !== undefined) changes.push(describeWhole("inserted", b, { from: sourcePoint, to: sourcePoint }));
      }
      if (a !== undefined) sourcePoint = a.range.to;
      if (b !== undefined) candidatePoint = b.range.to;
    }
    removed = [];
    inserted = [];
  };
  for (const step of diffQuireAiSequences(before, after, (left, right) => left.key === right.key)) {
    if (step.kind === "same") {
      flush();
      sourcePoint = before[step.a]!.range.to;
      candidatePoint = after[step.b]!.range.to;
    } else if (step.kind === "removed") removed.push(before[step.a]!);
    else inserted.push(after[step.b]!);
  }
  flush();
  return changes;
}

/**
 * Flattens every block of a document.
 * @param doc - Document.
 * @param registry - Compiled facts.
 * @returns Blocks in view order.
 */
function collectEntries(doc: Node, registry: QuireAiRegistry): QuireAiChangeBlock[] {
  return collectQuireAiSections(doc, registry).flatMap(section => collectQuireAiBlocks(section, registry).map((block): QuireAiChangeBlock => {
    const chars: string[] = [];
    const charFormats: ReadonlyMap<string, unknown>[] = [];
    const objects: QuireAiChangeObject[] = [];
    let paragraphFormats: ReadonlyMap<string, unknown> = new Map();
    if (block.node.isTextblock) {
      paragraphFormats = readQuireAiFormats(registry.paragraphFormats, format => format.read({ level: "paragraph", node: block.node, doc, pos: block.pos }));
      flattenInline(block.node, registry, chars, charFormats, objects);
    } else {
      const presented = presentQuireAiNode(block.node, registry.blocks.get(block.node.type.name)?.label?.(block.node) ?? block.node.type.name, registry);
      if (presented.object !== undefined) objects.push(presented.object);
      for (const char of presented.label) {
        chars.push(char);
        charFormats.push(new Map());
      }
    }
    return {
      section: block.section.story ? block.section.title : undefined,
      key: [`${block.section.title}\u0000${renderBlockLine(doc, block, null, registry)}`, ...objects.map(object => object.key)].join("\u0000"),
      chars, charFormats, paragraphFormats, objects,
      range: block.node.isTextblock
        ? { from: block.pos + 1, to: block.pos + block.node.nodeSize - 1 }
        : { from: block.pos, to: block.pos + block.node.nodeSize }
    };
  }));
}

/**
 * Appends the characters of inline content with their character formats, and its objects with an image.
 * @param node - Text block or inline container.
 * @param registry - Compiled facts.
 * @param chars - Receives characters.
 * @param formats - Receives each character's formats.
 * @param objects - Receives inline objects that show an image.
 */
function flattenInline(node: Node, registry: QuireAiRegistry, chars: string[], formats: ReadonlyMap<string, unknown>[], objects: QuireAiChangeObject[]): void {
  node.forEach(child => {
    if (!child.isText && !child.isLeaf) {
      flattenInline(child, registry, chars, formats, objects);
      return;
    }
    const values = child.isText
      ? readQuireAiFormats(registry.characterFormats, format => format.read({ level: "character", marks: child.marks }))
      : new Map<string, unknown>();
    const label = child.isText || child.type.name === "hardBreak" ? "" : registry.blocks.get(child.type.name)?.label?.(child) ?? child.type.name;
    const presented = label.length === 0 ? undefined : presentQuireAiNode(child, label, registry);
    if (presented?.object !== undefined) objects.push(presented.object);
    const text = child.isText ? child.text ?? "" : child.type.name === "hardBreak" ? "\n" : presented === undefined ? "" : `[${presented.label}]`;
    for (const char of text) {
      chars.push(char);
      formats.push(values);
    }
  });
}

/**
 * Describes a block that was added or removed whole.
 * @param kind - Added or removed.
 * @param entry - The block.
 * @param point - Where the block goes (added) or was (removed) in the other document.
 * @returns Change with the block's text as excerpt.
 */
function describeWhole(kind: "inserted" | "removed", entry: QuireAiChangeBlock, point: { from: number; to: number }): QuireDocumentChange {
  return {
    kind, ...(entry.section === undefined ? {} : { section: entry.section }), excerpt: excerpt(entry.chars), formats: [],
    ...(entry.objects.length === 0 ? {} : { objects: listQuireAiObjects(kind, entry.objects) }),
    source: kind === "removed" ? entry.range : point,
    candidate: kind === "inserted" ? entry.range : point
  };
}

/**
 * Describes one block changed in place.
 * @param a - Source block.
 * @param b - Candidate block.
 * @param registry - Compiled facts.
 * @returns Change with text pieces and format changes.
 */
function describeEdit(a: QuireAiChangeBlock, b: QuireAiChangeBlock, registry: QuireAiRegistry): QuireDocumentChange {
  const textChanged = a.chars.join("") !== b.chars.join("");
  const steps: QuireAiDiffStep[] = textChanged
    ? diffQuireAiSequences(a.chars, b.chars)
    : a.chars.map((_, index) => ({ kind: "same", a: index, b: index }));
  const formats = [
    ...compareValues(registry.paragraphFormats, a.paragraphFormats, b.paragraphFormats),
    ...compareCharacters(registry.characterFormats, a, b, steps)
  ];
  const objects = compareQuireAiObjects(a.objects, b.objects);
  return {
    kind: "edited",
    ...(a.section === undefined ? {} : { section: a.section }),
    excerpt: excerpt(a.chars),
    ...(textChanged ? { text: textPieces(a, b, steps) } : {}),
    formats,
    ...(objects.length === 0 ? {} : { objects }),
    source: a.range,
    candidate: b.range
  };
}

/**
 * Merges the edit script into kept, removed and inserted text pieces.
 * @param a - Source block.
 * @param b - Candidate block.
 * @param steps - Character edit script.
 * @returns Pieces in order.
 */
function textPieces(a: QuireAiChangeBlock, b: QuireAiChangeBlock, steps: readonly QuireAiDiffStep[]): QuireDocumentTextPiece[] {
  const pieces: { kind: QuireDocumentTextPiece["kind"]; text: string }[] = [];
  for (const step of steps) {
    const text = step.kind === "inserted" ? b.chars[step.b]! : a.chars[step.a]!;
    const last = pieces.at(-1);
    if (last?.kind === step.kind) last.text += text;
    else pieces.push({ kind: step.kind, text });
  }
  return pieces;
}

/** @param chars - Block characters. @returns Leading text, shortened with an ellipsis. */
function excerpt(chars: readonly string[]): string {
  const text = chars.join("").replace(/\s+/gu, " ").trim();
  return text.length > excerptLength ? `${[...text].slice(0, excerptLength).join("")}…` : text;
}
