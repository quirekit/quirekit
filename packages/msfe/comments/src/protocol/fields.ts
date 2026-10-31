import type { CommentsIssue, CommentsIssueCode } from "./types";

/** Collects every issue so hosts can report a whole document at once. */
export class IssueCollector {
  /** Issues in discovery order. */
  readonly issues: CommentsIssue[] = [];
  /** @param code - Failure kind. @param path - JSON path. @returns Always false, for use in guards. */
  add(code: CommentsIssueCode, path: string): false { this.issues.push({ code, path }); return false; }
}

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const HASH = /^fnv1a64:[\da-f]{16}$/u;

/** @param value - Untrusted value. @returns Whether it is a non-array object. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** @param value - Untrusted value. @param path - JSON path. @param issues - Collector. @returns Whether it is a nonempty string. */
export function checkId(value: unknown, path: string, issues: IssueCollector): value is string {
  return typeof value === "string" && value.length > 0 || issues.add("invalid-value", path);
}

/** @param value - Untrusted value. @param path - JSON path. @param issues - Collector. @returns Whether it is a string. */
export function checkText(value: unknown, path: string, issues: IssueCollector): value is string {
  return typeof value === "string" || issues.add("invalid-value", path);
}

/** @param value - Untrusted value. @param path - JSON path. @param issues - Collector. @returns Whether it is an ISO 8601 UTC time. */
export function checkDate(value: unknown, path: string, issues: IssueCollector): boolean {
  return typeof value === "string" && ISO_UTC.test(value) && !Number.isNaN(Date.parse(value)) || issues.add("invalid-date", path);
}

/** @param value - Untrusted value. @param path - JSON path. @param issues - Collector. @returns Whether it is a source hash. */
export function checkHash(value: unknown, path: string, issues: IssueCollector): boolean {
  return typeof value === "string" && HASH.test(value) || issues.add("invalid-value", path);
}

/** @param value - Untrusted value. @param path - JSON path. @param issues - Collector. @returns Whether it is a host identity. */
export function checkPerson(value: unknown, path: string, issues: IssueCollector): boolean {
  if (!isRecord(value)) return issues.add("invalid-value", path);
  const id = checkId(value.id, `${path}/id`, issues);
  const agent = value.agent === undefined || value.agent === true || issues.add("invalid-value", `${path}/agent`);
  return checkText(value.name, `${path}/name`, issues) && id && agent;
}

/** @param value - Untrusted value. @param path - JSON path. @param issues - Collector. @returns Whether it is a valid offset. */
export function checkOffset(value: unknown, path: string, issues: IssueCollector): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 || issues.add("invalid-range", path);
}
