import type { CommandSpec } from "@quirekit/core";
import { resolveWordNumberingRegistry, resolveWordParagraphNumbering } from "../../model";
import { isWordNumberingLevel } from "../../model/validation";
import { allocateWordNumberingPresetAbstractId, areWordNumberingLevelsEqual } from "../../presets/materialize";
import { cloneWordNumberingPresetLevel } from "../../presets/ownership";
import { mergeCanonicalLevel } from "../../templates/merge";
import type { UpdateWordNumberingDefinitionOptions } from "../../templates/types";
import { installWordNumberingDefinition } from "./install";

/**
 * Edits a captured concrete definition without coercing it into an installed preset.
 *
 * @returns Atomic copy-on-write command guarded against stale document definitions.
 */
export function createUpdateWordNumberingDefinitionCommand(): CommandSpec {
  return value => context => {
    const input = value as UpdateWordNumberingDefinitionOptions | undefined;
    if (!input?.target || !Array.isArray(input.levels)) return false;
    const { target } = input;
    const registry = resolveWordNumberingRegistry(context.tr.doc.attrs.wordNumberingRegistry);
    const instance = registry.nums[target.reference.numId];
    const definition = instance && registry.abstractNums[instance.abstractNumId];
    const paragraph = context.tr.doc.nodeAt(target.position);
    const reference = resolveWordParagraphNumbering(paragraph?.attrs.wordNumbering);
    if (!definition || JSON.stringify(definition) !== JSON.stringify(target.definition)
      || JSON.stringify(reference) !== JSON.stringify(target.reference)) return false;
    const levels = { ...definition.levels };
    const seen = new Set<number>();
    let changed = false;
    for (const override of input.levels) {
      const base = levels[String(override.level)];
      if (!base || seen.has(override.level)) return false;
      seen.add(override.level);
      const next = mergeCanonicalLevel(base, override);
      if (!isWordNumberingLevel(next)) return false;
      changed ||= !areWordNumberingLevelsEqual(base, next);
      levels[String(override.level)] = cloneWordNumberingPresetLevel(next);
    }
    if (input.startOverride !== undefined && input.startOverride !== null
      && (!Number.isInteger(input.startOverride) || input.startOverride < 0)) return false;
    const referenceChanged = input.startOverride !== undefined
      && input.startOverride !== reference!.startOverride;
    if (!changed && !referenceChanged) return false;
    if (changed) {
      const id = allocateWordNumberingPresetAbstractId(registry);
      installWordNumberingDefinition(context, { ...definition, id, levels }, instance!.id);
    }
    if (referenceChanged) {
      const current = context.tr.doc.nodeAt(target.position)!;
      context.tr.setNodeMarkup(target.position, undefined, {
        ...current.attrs, wordNumbering: { ...current.attrs.wordNumbering, startOverride: input.startOverride }
      });
    }
    context.dispatch?.(context.tr);
    return true;
  };
}
