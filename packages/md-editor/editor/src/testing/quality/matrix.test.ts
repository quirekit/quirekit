// @vitest-environment happy-dom
import { afterAll, describe, expect, it } from "vitest";
import { qualityBlocks, qualityCells } from "./fixtures";
import { runQualityCell } from "./run";
import { knownQualityGaps } from "./known";
import type { QualityResult } from "./types";

const results: QualityResult[] = [];

describe("document-view input quality", () => {
  it.each(qualityBlocks.map(block => block.name))("keeps every input inside the invariants: %s", name => {
    const block = qualityCells().filter(cell => cell.block === name).map(runQualityCell);
    results.push(...block);
    const failing = block.filter(result => result.violations.length).map(result => result.cell.id);
    // New failures are regressions; a known gap that now passes must leave the list.
    expect(failing.filter(id => !knownQualityGaps.has(id))).toEqual([]);
    expect([...knownQualityGaps].filter(id => id.startsWith(`${name}/`) && !failing.includes(id))).toEqual([]);
  });

  afterAll(() => {
    const total = results.reduce((sum, result) => sum + result.cell.weight, 0);
    const passed = results.filter(result => !result.violations.length).reduce((sum, result) => sum + result.cell.weight, 0);
    const failing = results.filter(result => result.violations.length);
    console.info(`input quality ${(100 * passed / total).toFixed(1)} (${results.length - failing.length}/${results.length} cells)\n`
      + failing.map(result => `${result.cell.id}: ${JSON.stringify(result.cell.source)} → ${JSON.stringify(result.after)}\n  `
        + result.violations.map(item => `${item.rule} ${item.detail}`).join("\n  ")).join("\n"));
  });
});
