import { describe, expect, it } from "vitest";
import { allocateWordNumberingPresetAbstractId } from "../presets/materialize";
import { createDefaultWordNumberingRegistry } from "./defaults";
import { createWordNumberingInstance } from "./registry";
import { isWordNumberingLevel, isWordNumberingRegistry } from "./validation";

describe("numbering identities", () => {
  it("retains the historical registry counter when allocating a UUID instance", () => {
    const registry = { ...createDefaultWordNumberingRegistry(), nextInstanceId: 73 };
    const created = createWordNumberingInstance(registry, "quirekit-decimal");
    expect(created.registry.nextInstanceId).toBe(73);
    expect(isWordNumberingRegistry(created.registry)).toBe(true);
  });

  it.each([['num', true], ['unsupported', false]])("validates the paragraph tab alignment %s", (alignment, accepted) => {
    const registry = createDefaultWordNumberingRegistry();
    const level = { ...registry.abstractNums['quirekit-decimal']!.levels['0']!,
      paragraphTabs: [{ position: { unit: 'dxa', value: 720 }, alignment }] };
    expect(isWordNumberingLevel(level)).toBe(accepted);
  });

  it("gives lists created from the same registry different ids", () => {
    const registry = createDefaultWordNumberingRegistry();
    const mine = createWordNumberingInstance(registry, "quirekit-decimal");
    const theirs = createWordNumberingInstance(registry, "quirekit-bullet");
    expect(mine.numId).not.toBe(theirs.numId);
    expect({ ...mine.registry.nums, ...theirs.registry.nums }[mine.numId]?.abstractNumId).toBe("quirekit-decimal");
  });

  it("gives list definitions allocated from the same registry different ids", () => {
    const registry = createDefaultWordNumberingRegistry();
    expect(allocateWordNumberingPresetAbstractId(registry)).not.toBe(allocateWordNumberingPresetAbstractId(registry));
  });
});
