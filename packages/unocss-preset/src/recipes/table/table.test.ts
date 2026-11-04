import { createGenerator } from "@unocss/core";
import type { Theme } from "@unocss/preset-wind3";
import { presetWind3 } from "@unocss/preset-wind3";
import { describe, expect, it } from "vitest";
import { tableRecipeCatalog, tableShortcuts } from "./table";
import { quireKitUnoTheme } from "../../theme/bridge";

describe("Table recipe", () => {
  it("keeps cell padding, wrapping and sticky headings without a fixed row height", async () => {
    const generator = await createGenerator<Theme>({ presets: [presetWind3()], theme: quireKitUnoTheme, shortcuts: tableShortcuts });
    const { css, matched } = await generator.generate(tableRecipeCatalog.join(" "));
    for (const name of tableRecipeCatalog) expect(matched.has(name)).toBe(true);
    expect(css).toContain("overflow-wrap:anywhere");
    expect(css).toContain("position:sticky");
    expect(css).toContain("var(--qk-table-padding)");
    expect(css).toContain("var(--qk-table-current-background)");
    expect(css).toContain("border-collapse:separate");
    expect(css).not.toMatch(/\.qk-table__cell\{[^}]*height:/);
    // Text, tags and buttons in one row share a center line.
    expect(css).toMatch(/\.qk-table__cell\{[^}]*vertical-align:middle/);
  });
});
