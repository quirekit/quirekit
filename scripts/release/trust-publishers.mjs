#!/usr/bin/env node
// Registers the public repository's release workflow as the npm trusted publisher of every public
// package, so releases run from GitHub Actions without tokens or one-time passwords. Run it in a
// terminal right before the next release: npm expires a configuration whose first publish does not
// happen within two days. The first package asks for browser authentication; choose "skip 2FA for
// 5 minutes" there so the following ones go through (about 80 fit in one window).

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readPolicy, readWorkspace } from "../licensing/workspace.mjs";
import { releaseClosure } from "../public/select.mjs";

const root = resolve(import.meta.dirname, "../..");
const config = JSON.parse(readFileSync(join(root, "scripts/public/config.json"), "utf8"));
const repository = config.remote.replace(/^git@github\.com:/u, "").replace(/\.git$/u, "");
const policy = readPolicy(root);
const open = readWorkspace(root).filter(({ directory, manifest }) =>
  directory !== "" && !manifest.private && !policy.packages.commercial.includes(manifest.name));
const names = [...releaseClosure(open, config.npmRoots)].sort();
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

process.stdout.write(`Trusting ${repository} .github/workflows/release.yml for ${names.length} packages\n`);
const failed = [];
for (const [index, name] of names.entries()) {
  // npm 11.15+ provides `npm trust`; npx keeps the machine's own npm untouched.
  const { status } = spawnSync("npx", ["--yes", "npm@^11.15.0", "trust", "github", name,
    "--file", "release.yml", "--repo", repository, "--allow-publish", "--yes"],
  { stdio: "inherit", env: { ...process.env, npm_config_registry: "https://registry.npmjs.org/" } });
  process.stdout.write(`${status === 0 ? "trusted" : "failed "} ${index + 1}/${names.length} ${name}\n`);
  if (status !== 0) failed.push(name);
  await sleep(2000);
}
process.stdout.write(failed.length ? `\nRe-run for: ${failed.join(" ")}\n` : "\nAll packages trust the release workflow.\n");
