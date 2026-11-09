/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { quireKitUnoUtilityCatalog } from "./catalog";

const packages = fileURLToPath(new URL("../../../md-editor/", import.meta.url));

/**
 * @param directory - Source directory.
 * @returns Every Vue component below it.
 */
function vueFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return vueFiles(path);
    return entry.name.endsWith(".vue") ? [path] : [];
  });
}

/**
 * @param source - Component source.
 * @returns Utility classes written in static class attributes; component-owned names carry a product prefix.
 */
function staticUtilities(source: string): string[] {
  return [...source.matchAll(/(?<![:\w-])class="([^"]*)"/gu)]
    .flatMap(match => match[1]!.split(/\s+/u))
    .filter(name => name !== "" && !/^(?:md-|msfe-|qk-)/u.test(name));
}

describe("precompiled stylesheet", () => {
  it("covers the utilities written in md-editor templates", () => {
    const catalog = new Set<string>(quireKitUnoUtilityCatalog);
    const used = ["editor/src", "comments/src"].flatMap(directory => vueFiles(join(packages, directory)))
      .flatMap(file => staticUtilities(readFileSync(file, "utf8")));
    expect([...new Set(used)].filter(name => !catalog.has(name))).toEqual([]);
  });
});
