#!/usr/bin/env node
// Applies pending changesets: checks the release plan first, then runs `changeset version` to bump
// every package of the shared version and write their CHANGELOG.md entries.
//
// Two checks run before any file changes. Every changeset summary needs an English part and a
// Chinese part, because the changelog and the GitHub release notes are bilingual. And a plan that
// moves a 0.x version to 1.0 or beyond is refused unless RELEASE_ALLOW_MAJOR=1: pnpm publishes
// `workspace:*` peer dependencies as exact versions, so changesets turns any minor change into a
// major bump of every peer dependent, and the fixed group then carries the whole set to 1.0.0.
// Before 1.0, write changesets as `patch`.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const changeset = join(root, "node_modules/@changesets/cli/bin.js");

/**
 * Reads the release plan `changeset status` computes, without changing any file.
 * @returns {{ changesets: { id: string, summary: string }[], releases: { name: string, type: string, oldVersion: string, newVersion: string }[] }} Plan.
 */
function readPlan() {
  const directory = mkdtempSync(join(tmpdir(), "quirekit-release-plan-"));
  try {
    const output = join(directory, "plan.json");
    execFileSync(process.execPath, [changeset, "status", `--output=${output}`], { cwd: root, stdio: ["ignore", "ignore", "inherit"] });
    return JSON.parse(readFileSync(output, "utf8"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const read = readPlan();
const plan = { ...read, releases: read.releases.filter(({ type }) => type !== "none") };
if (plan.changesets.length === 0) {
  process.stdout.write("No changesets to apply. Add one with `pnpm changeset`.\n");
  process.exit(1);
}

const problems = [];
for (const { id, summary } of plan.changesets) {
  if (!/[A-Za-z]{3}/u.test(summary) || !/\p{Script=Han}/u.test(summary)) {
    problems.push(`.changeset/${id}.md needs an English paragraph followed by a Chinese paragraph.`);
  }
}
const crossing = plan.releases.filter(({ oldVersion, newVersion }) =>
  oldVersion.startsWith("0.") && !newVersion.startsWith("0."));
if (crossing.length > 0 && process.env.RELEASE_ALLOW_MAJOR !== "1") {
  const trigger = plan.changesets.filter(({ id }) => crossing.some(({ name }) =>
    plan.releases.find((release) => release.name === name)?.changesets?.includes(id)));
  problems.push(`The plan moves ${crossing.length} packages from ${crossing[0].oldVersion} to ${crossing[0].newVersion}. ` +
    `Before 1.0 write changesets as \`patch\`${trigger.length ? ` (check ${trigger.map(({ id }) => `.changeset/${id}.md`).join(", ")})` : ""}, ` +
    "or set RELEASE_ALLOW_MAJOR=1 for an intended 1.0.");
}
if (problems.length > 0) {
  process.stderr.write(`${problems.join("\n")}\n`);
  process.exit(1);
}

execFileSync(process.execPath, [changeset, "version"], { cwd: root, stdio: "inherit" });
const versions = [...new Set(plan.releases.map(({ newVersion }) => newVersion))];
process.stdout.write([
  `Versioned ${plan.releases.length} packages to ${versions.join(", ")}.`,
  "Next: review the CHANGELOG.md entries, commit, run `pnpm public:sync` and push the public repository;",
  "its release workflow publishes the new version and tags it. A package that is new to npm is published",
  "by hand once and then registered with `pnpm release:trust` before that push."
].join("\n") + "\n");
