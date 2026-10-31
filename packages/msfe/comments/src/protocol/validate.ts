import { checkDate, checkHash, checkId, checkOffset, checkPerson, checkText, isRecord, IssueCollector } from "./fields";
import type { CommentsExchange, CommentsValidation } from "./types";

/** Identities already used in the document, shared across threads and messages. */
interface SeenIds {
  /** Thread identities. */
  readonly threads: Set<string>;
  /** Message identities. */
  readonly messages: Set<string>;
}

/**
 * Validates untrusted exchange data in full before any of it is imported.
 * @param value - Parsed JSON from host storage.
 * @returns The typed document, or every issue found.
 */
export function validateCommentsExchange(value: unknown): CommentsValidation {
  const issues = new IssueCollector();
  if (!isRecord(value) || value.format !== "quirekit.comments") return { ok: false, issues: [{ code: "invalid-format", path: "/format" }] };
  // A newer version may change field meaning; refuse it instead of importing a guess.
  if (Number.isSafeInteger(value.version) && (value.version as number) > 2) return { ok: false, issues: [{ code: "unsupported-version", path: "/version" }] };
  if (value.version !== 1 && value.version !== 2) issues.add("invalid-value", "/version");
  if (!isRecord(value.source)) issues.add("invalid-value", "/source");
  else checkHash(value.source.hash, "/source/hash", issues);
  if (!Array.isArray(value.threads)) issues.add("invalid-value", "/threads");
  else {
    const seen: SeenIds = { threads: new Set(), messages: new Set() };
    // Version 1 has no document comments, so every thread there must carry an anchor.
    const anchored = value.version === 1;
    value.threads.forEach((thread, index) => checkThread(thread, `/threads/${index}`, seen, issues, anchored));
  }
  return issues.issues.length ? { ok: false, issues: issues.issues } : { ok: true, value: value as unknown as CommentsExchange };
}

/**
 * @param value - Untrusted thread. @param path - JSON path. @param seen - Document identities. @param issues - Collector.
 * @param anchored - Whether the anchor is required.
 */
function checkThread(value: unknown, path: string, seen: SeenIds, issues: IssueCollector, anchored: boolean): void {
  if (!isRecord(value)) { issues.add("invalid-value", path); return; }
  if (checkId(value.id, `${path}/id`, issues)) {
    if (seen.threads.has(value.id)) issues.add("duplicate-id", `${path}/id`);
    seen.threads.add(value.id);
  }
  if (anchored || value.anchor !== undefined) checkAnchor(value.anchor, `${path}/anchor`, issues);
  if (typeof value.resolved !== "boolean") issues.add("invalid-value", `${path}/resolved`);
  // Resolution metadata is optional (imported Word data has none) but never survives a reopen.
  if (value.resolved !== true && (value.resolvedBy !== undefined || value.resolvedAt !== undefined)) issues.add("invalid-resolution", path);
  if (value.resolvedBy !== undefined) checkPerson(value.resolvedBy, `${path}/resolvedBy`, issues);
  if (value.resolvedAt !== undefined) checkDate(value.resolvedAt, `${path}/resolvedAt`, issues);
  checkMessages(value.messages, `${path}/messages`, seen, issues);
}

/** @param value - Untrusted anchor. @param path - JSON path. @param issues - Collector. */
function checkAnchor(value: unknown, path: string, issues: IssueCollector): void {
  if (!isRecord(value)) { issues.add("invalid-value", path); return; }
  const quote = value.quote, hint = value.hint;
  let exact: string | null = null;
  if (!isRecord(quote)) issues.add("invalid-value", `${path}/quote`);
  else {
    if (checkText(quote.exact, `${path}/quote/exact`, issues)) exact = quote.exact;
    checkText(quote.prefix, `${path}/quote/prefix`, issues);
    checkText(quote.suffix, `${path}/quote/suffix`, issues);
  }
  if (!isRecord(hint)) issues.add("invalid-range", `${path}/hint`);
  else if (checkOffset(hint.from, `${path}/hint/from`, issues) && checkOffset(hint.to, `${path}/hint/to`, issues)) {
    // The hint always spans exactly the quoted text in the source it was taken from.
    if (hint.to < hint.from || exact !== null && hint.to - hint.from !== exact.length) issues.add("invalid-range", `${path}/hint`);
  }
  checkHash(value.hash, `${path}/hash`, issues);
  if (value.relative === undefined) return;
  const relative = value.relative;
  if (!isRecord(relative) || relative.start === undefined || relative.end === undefined) issues.add("invalid-value", `${path}/relative`);
  else checkId(relative.epoch, `${path}/relative/epoch`, issues);
}

/** @param value - Untrusted message list. @param path - JSON path. @param seen - Document identities. @param issues - Collector. */
function checkMessages(value: unknown, path: string, seen: SeenIds, issues: IssueCollector): void {
  if (!Array.isArray(value) || !value.length) { issues.add("invalid-root", path); return; }
  const earlier = new Set<string>();
  value.forEach((message, index) => {
    const at = `${path}/${index}`;
    if (!isRecord(message)) { issues.add("invalid-value", at); return; }
    if (checkId(message.id, `${at}/id`, issues)) {
      if (seen.messages.has(message.id)) issues.add("duplicate-id", `${at}/id`);
      seen.messages.add(message.id);
    }
    // Exactly one root, first; every reply points backwards inside the same thread.
    if (index === 0 ? message.parentId !== null : message.parentId === null) issues.add("invalid-root", `${at}/parentId`);
    else if (index > 0 && (typeof message.parentId !== "string" || !earlier.has(message.parentId))) issues.add("invalid-parent", `${at}/parentId`);
    if (typeof message.id === "string") earlier.add(message.id);
    checkPerson(message.author, `${at}/author`, issues);
    if (message.requestedBy !== undefined) checkPerson(message.requestedBy, `${at}/requestedBy`, issues);
    checkDate(message.createdAt, `${at}/createdAt`, issues);
    if (message.editedAt !== undefined) checkDate(message.editedAt, `${at}/editedAt`, issues);
    checkText(message.body, `${at}/body`, issues);
    if (message.mentions === undefined) return;
    if (!Array.isArray(message.mentions)) { issues.add("invalid-value", `${at}/mentions`); return; }
    message.mentions.forEach((mention, item) => {
      const where = `${at}/mentions/${item}`;
      if (!isRecord(mention)) { issues.add("invalid-value", where); return; }
      checkId(mention.id, `${where}/id`, issues);
      checkText(mention.label, `${where}/label`, issues);
      checkText(mention.url, `${where}/url`, issues);
    });
  });
}
