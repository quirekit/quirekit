#!/usr/bin/env node
// Points the `latest` dist-tag of every public package at its current workspace version. Releases
// publish under the `alpha` tag; while there is no stable release, run this after each one so a
// plain `npm install` gets the same version. Once a stable version exists, `latest` follows only
// stable releases and this command is no longer used. npm asks for a one-time password, which
// this script requests once and again only when npm rejects an expired one.

import { execFile, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { promisify } from "node:util";
import { readPolicy, readWorkspace } from "../licensing/workspace.mjs";
import { releaseClosure } from "../public/select.mjs";

const run = promisify(execFile);
const root = resolve(import.meta.dirname, "../..");
const registry = "https://registry.npmjs.org/";
const config = JSON.parse(readFileSync(join(root, "scripts/public/config.json"), "utf8"));
const policy = readPolicy(root);
const open = readWorkspace(root).filter(({ directory, manifest }) =>
  directory !== "" && !manifest.private && !policy.packages.commercial.includes(manifest.name));
const released = releaseClosure(open, config.npmRoots);
const versions = new Map(open.filter(({ manifest }) => released.has(manifest.name)).map(({ manifest }) => [manifest.name, manifest.version]));

/**
 * @param {string} name - Package name.
 * @returns {Promise<Record<string, string>>} Its dist-tags, or an empty map when unpublished.
 */
async function distTags(name) {
  const { stdout } = await run("npm", ["view", name, "dist-tags", "--json", "--registry", registry]).catch(() => ({ stdout: "{}" }));
  return JSON.parse(stdout || "{}");
}

// Phase 1: find packages whose `latest` lags behind the published workspace version.
process.stdout.write(`Checking dist-tags of ${versions.size} packages on npm...\n`);
const entries = [...versions];
const tagsByName = new Map();
for (let index = 0; index < entries.length; index += 12) {
  const batch = entries.slice(index, index + 12);
  const results = await Promise.all(batch.map(([name]) => distTags(name)));
  batch.forEach(([name], offset) => tagsByName.set(name, results[offset]));
  process.stdout.write(`  ${Math.min(index + 12, entries.length)}/${entries.length}\r`);
}
const pending = [];
for (const [name, version] of entries) {
  const tags = tagsByName.get(name);
  if (!Object.values(tags).includes(version)) process.stdout.write(`skip ${name}: ${version} is not published yet\n`);
  else if (tags.latest !== version) pending.push([name, version]);
}
process.stdout.write(`${pending.length} of ${versions.size} packages need latest -> current version\n`);

// A granular token that may bypass 2FA (NPM_TOKEN) skips per-package authentication. It goes
// into a throwaway npmrc rather than the command line, so it never shows in process listings.
const tokenDirectory = process.env.NPM_TOKEN ? mkdtempSync(join(tmpdir(), "quirekit-npm-")) : undefined;
if (tokenDirectory) writeFileSync(join(tokenDirectory, ".npmrc"), `//registry.npmjs.org/:_authToken=${process.env.NPM_TOKEN}\n`, { mode: 0o600 });
const tokenArgs = tokenDirectory ? ["--userconfig", join(tokenDirectory, ".npmrc")] : [];

// Phase 2: retag one by one. With an authenticator app, the one-time password is reused until npm
// rejects it; with a security key (Touch ID, passkey) npm prints a browser link instead, so its
// prompts must reach the terminal.
const prompt = createInterface({ input: process.stdin, output: process.stdout });
let otp = pending.length > 0 && !tokenDirectory
  ? (await prompt.question("npm one-time password (press Enter if you use a security key or Touch ID): ")).trim()
  : "";
prompt.pause();
for (const [name, version] of pending) {
  const args = ["dist-tag", "add", `${name}@${version}`, "latest", "--registry", registry, ...tokenArgs];
  if (!otp) {
    // npm opens its browser flow itself; the terminal shows the link and waits for it.
    const status = spawnSync("npm", args, { stdio: "inherit" }).status;
    process.stdout.write(status === 0 ? `latest -> ${name}@${version}\n` : `failed ${name}\n`);
    continue;
  }
  for (;;) {
    const result = await run("npm", [...args, "--otp", otp]).then(() => null, (error) => `${error.stdout}${error.stderr}`);
    if (result === null) { process.stdout.write(`latest -> ${name}@${version}\n`); break; }
    if (!/EOTP|one-time password/iu.test(result)) { process.stdout.write(`failed ${name}: ${result.trim().split("\n").at(-1)}\n`); break; }
    prompt.resume();
    otp = (await prompt.question("The password expired. Next npm one-time password: ")).trim();
    prompt.pause();
  }
}
prompt.close();
if (tokenDirectory) rmSync(tokenDirectory, { recursive: true, force: true });
