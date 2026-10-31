import type { Node } from "@quirekit/pm";
import type { QuireDocumentObjectChange } from "../../document-sdk/types";
import type { QuireAiRegistry } from "../types";
import { diffQuireAiSequences } from "./sequence";
import type { QuireAiChangeObject } from "./types";

/** Most objects one change lists, so a rewritten gallery stays readable. */
const objectLimit = 6;

/**
 * Reads how people see a node, with its image when it has one.
 * @param node - Block or inline node.
 * @param label - Its view label.
 * @param registry - Compiled facts.
 * @returns People-facing name, and the object to compare when it shows an image.
 */
export function presentQuireAiNode(node: Node, label: string, registry: QuireAiRegistry): { label: string; object?: QuireAiChangeObject } {
  const presented = registry.blocks.get(node.type.name)?.present?.(node);
  if (presented === undefined) return { label };
  if (presented.image === undefined) return { label: presented.label };
  // The source is part of the key, so a replaced image differs even when its label does not.
  return { label: presented.label, object: { key: `${label}\u0000${JSON.stringify(presented.image.source)}`, label: presented.label, image: presented.image } };
}

/**
 * Pairs the objects of an edited block and lists those whose image changed, was added or was removed.
 *
 * Objects are matched by key, so unchanged ones pair exactly and a run of changed ones pairs in
 * order. A pair showing the same image is left to the text change, such as a new caption.
 *
 * @param before - Objects of the source block.
 * @param after - Objects of the candidate block.
 * @returns Object changes in order, at most a bounded number.
 */
export function compareQuireAiObjects(before: readonly QuireAiChangeObject[], after: readonly QuireAiChangeObject[]): QuireDocumentObjectChange[] {
  const changes: QuireDocumentObjectChange[] = [];
  let removed: QuireAiChangeObject[] = [];
  let inserted: QuireAiChangeObject[] = [];
  const flush = () => {
    for (let index = 0; index < Math.max(removed.length, inserted.length); index += 1) {
      const a = removed[index];
      const b = inserted[index];
      if (a !== undefined && b !== undefined) {
        if (JSON.stringify(a.image.source) !== JSON.stringify(b.image.source)) changes.push({ kind: "edited", label: b.label, before: a.image, after: b.image });
      } else if (a !== undefined) changes.push({ kind: "removed", label: a.label, before: a.image });
      else changes.push({ kind: "inserted", label: b!.label, after: b!.image });
    }
    removed = [];
    inserted = [];
  };
  for (const step of diffQuireAiSequences(before, after, (left, right) => left.key === right.key)) {
    if (step.kind === "same") flush();
    else if (step.kind === "removed") removed.push(before[step.a]!);
    else inserted.push(after[step.b]!);
  }
  flush();
  return changes.slice(0, objectLimit);
}

/**
 * @param kind - Whether the block was added or removed whole.
 * @param objects - Its objects.
 * @returns Each object as added or removed, at most a bounded number.
 */
export function listQuireAiObjects(kind: "inserted" | "removed", objects: readonly QuireAiChangeObject[]): QuireDocumentObjectChange[] {
  return objects.slice(0, objectLimit).map(object => kind === "inserted"
    ? { kind, label: object.label, after: object.image }
    : { kind, label: object.label, before: object.image });
}
