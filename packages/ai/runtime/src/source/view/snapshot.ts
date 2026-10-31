import type { QuireAiAnnotationCapability, QuireAiSourceBlockCapability } from "@quirekit/ai-contract";
import type { QuireAiSourceBlock, QuireAiSourceDocument } from "../types";
import type { QuireAiSourceIdentity } from "./identity";
import type { QuireAiSourceSnapshot, QuireAiSourceViewAnnotation, QuireAiSourceViewBlock } from "./types";

/** Reads view snapshots of one source document. */
export interface QuireAiSourceSnapshots {
  /** @returns Current blocks with ids, summaries and annotations. */
  read(): QuireAiSourceSnapshot;
  /** @param id - Annotation id such as `c2`. @returns Feature identity of the annotation, or undefined when never issued. */
  resolveAnnotation(id: string): string | undefined;
}

/**
 * Removes a container's indentation from a block's continuation lines.
 * @param source - Block source as it stands in the document.
 * @param indent - Container indentation.
 * @returns Source as the view lists it.
 */
export function stripQuireAiSourceIndent(source: string, indent: string): string {
  if (indent === "") return source;
  return source.split("\n").map((line, index) => index > 0 && line.startsWith(indent) ? line.slice(indent.length) : line).join("\n");
}

/**
 * Creates the snapshot reader: block ids from the identity table, summaries from source block
 * facts, and annotation ids issued here and kept for the document's lifetime.
 * @param document - Source document port.
 * @param identity - Block identity table.
 * @returns Snapshot reader.
 */
export function createQuireAiSourceSnapshots(document: QuireAiSourceDocument, identity: QuireAiSourceIdentity): QuireAiSourceSnapshots {
  const annotationIds = new Map<string, string>();
  let nextAnnotation = 1;
  return {
    read() {
      const text = document.text();
      const blocks = document.blocks();
      const ids = identity.assign(blocks);
      const facts = document.capabilities();
      // Several facts may present one syntax name, such as fenced code of different languages; the first summary wins.
      const presenters = new Map<string, QuireAiSourceBlockCapability[]>();
      for (const fact of facts) if (fact.kind === "source-block") for (const name of fact.names) presenters.set(name, [...presenters.get(name) ?? [], fact]);
      // Annotations come first so each block can name those starting in it.
      const annotations: QuireAiSourceViewAnnotation[] = [];
      for (const fact of facts.filter((item): item is QuireAiAnnotationCapability => item.kind === "annotation")) {
        for (const annotation of fact.read()) {
          let id = annotationIds.get(annotation.id);
          if (id === undefined) annotationIds.set(annotation.id, id = `c${nextAnnotation++}`);
          const holder = annotation.range === null ? -1 : innermost(blocks, annotation.range.from);
          annotations.push({ id, block: holder < 0 ? null : ids[holder]!, annotation, label: fact.label });
        }
      }
      annotations.sort((left, right) => (left.annotation.range?.from ?? Infinity) - (right.annotation.range?.from ?? Infinity));
      const viewBlocks = blocks.map((block, index): QuireAiSourceViewBlock => {
        const id = ids[index]!;
        const source = stripQuireAiSourceIndent(text.slice(block.from, block.to), block.indent);
        let summary: QuireAiSourceViewBlock["summary"];
        for (const fact of presenters.get(block.name) ?? []) {
          summary = fact.present?.({ text: source, name: block.name, attrs: block.attrs });
          if (summary !== undefined) break;
        }
        return { ...block, id, text: source, summary, annotations: annotations.filter(item => item.block === id).map(item => item.id) };
      });
      return { text, blocks: viewBlocks, annotations };
    },
    resolveAnnotation: id => [...annotationIds].find(([, issued]) => issued === id)?.[0]
  };
}

/**
 * @param blocks - Blocks, parents before children.
 * @param pos - Position.
 * @returns Index of the innermost block whose own source or nested blocks hold the position, or -1.
 */
function innermost(blocks: readonly QuireAiSourceBlock[], pos: number): number {
  let found = -1;
  blocks.forEach((block, index) => { if (block.from <= pos && pos <= block.end) found = index; });
  return found;
}
