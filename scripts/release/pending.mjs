#!/usr/bin/env node
// Lists the public packages whose current version is not on npm yet, so the release workflow can
// stop before installing and building when a push carries no new version. Needs no installed
// dependencies. Under GitHub Actions it writes `count` and `version` (the version every pending
// package shares, empty when they differ or none are pending) to $GITHUB_OUTPUT.

import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { readPolicy, readWorkspace } from "../licensing/workspace.mjs";

const root = resolve(import.meta.dirname, "../..");
// The public tree's policy has no commercial list; the maintainers' tree keeps those unpublished.
const commercial = readPolicy(root).packages?.commercial ?? [];
const packages = readWorkspace(root)
  .map(({ directory, manifest }) => ({ directory, manifest }))
  .filter(({ directory, manifest }) =>
    directory !== "" && !manifest.private && !commercial.includes(manifest.name));

/**
 * Asks the registry whether one package version is published, retrying transient failures.
 * @param {string} name - Package name.
 * @param {string} version - Exact version.
 * @returns {Promise<boolean>} Whether the version exists on npm.
 */
async function published(name, version) {
  const url = `https://registry.npmjs.org/${name.replace("/", "%2f")}/${version}`;
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (response.ok) return true;
    if (response.status === 404) return false;
    if (attempt === 3) throw new Error(`${name}@${version}: registry answered ${response.status}`);
    await new Promise((done) => setTimeout(done, 2000 * attempt));
  }
}

const pending = [];
for (let index = 0; index < packages.length; index += 16) {
  const batch = packages.slice(index, index + 16);
  const states = await Promise.all(batch.map(({ manifest }) => published(manifest.name, manifest.version)));
  batch.forEach(({ manifest }, offset) => { if (!states[offset]) pending.push(manifest); });
}

const versions = [...new Set(pending.map(({ version }) => version))];
const version = versions.length === 1 ? versions[0] : "";
process.stdout.write(pending.length === 0
  ? `All ${packages.length} public packages are already on npm.\n`
  : `${pending.length} of ${packages.length} packages are not on npm yet:\n${pending.map(({ name, version: v }) => `  ${name}@${v}`).join("\n")}\n`);
if (versions.length > 1) process.stdout.write(`Pending versions differ (${versions.join(", ")}); no release tag will be created.\n`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `count=${pending.length}\nversion=${version}\n`);
