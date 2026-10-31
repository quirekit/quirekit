import { describe, expect, it } from "vitest";
import { validateCommentsExchange } from "./validate";

const HASH = "fnv1a64:0123456789abcdef";
const person = { id: "u1", name: "林" };

/** @returns A minimal valid exchange document with one resolved two-message thread. */
function sample(): Record<string, any> {
  return {
    format: "quirekit.comments", version: 1, source: { hash: HASH },
    threads: [{
      id: "t1", resolved: true, resolvedBy: person, resolvedAt: "2026-10-15T08:00:00Z",
      anchor: { quote: { exact: "正文", prefix: "# ", suffix: "\n" }, hint: { from: 2, to: 4 }, hash: HASH,
        relative: { start: { tname: "source" }, end: { tname: "source" }, epoch: "e1" } },
      messages: [
        { id: "m1", parentId: null, author: person, createdAt: "2026-10-15T07:00:00.123Z", body: "看下 **这里**",
          mentions: [{ id: "u2", label: "王", url: "https://example.test/u2" }] },
        { id: "m2", parentId: "m1", author: person, createdAt: "2026-10-15T07:30:00Z", editedAt: "2026-10-15T07:31:00Z", body: "已改" },
      ],
    }],
  };
}

describe("comments exchange validation", () => {
  it("accepts a complete document and returns it typed", () => {
    const result = validateCommentsExchange(sample());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.threads[0]!.messages[1]!.parentId).toBe("m1");
  });

  it("rejects other formats and newer versions without reading further", () => {
    expect(validateCommentsExchange({ format: "other" })).toEqual({ ok: false, issues: [{ code: "invalid-format", path: "/format" }] });
    expect(validateCommentsExchange({ ...sample(), version: 3, threads: "broken" }))
      .toEqual({ ok: false, issues: [{ code: "unsupported-version", path: "/version" }] });
  });

  it("accepts document comments without an anchor only from version 2", () => {
    const { anchor: _anchor, ...document } = sample().threads[0]!;
    expect(validateCommentsExchange({ ...sample(), version: 2, threads: [document] }).ok).toBe(true);
    expect(validateCommentsExchange({ ...sample(), version: 1, threads: [document] }))
      .toEqual({ ok: false, issues: [{ code: "invalid-value", path: "/threads/0/anchor" }] });
  });

  it("reports every issue with its path instead of importing part of the document", () => {
    const value = sample();
    const thread = value.threads[0];
    thread.anchor.hint = { from: 2, to: 5 };
    thread.messages[1].parentId = "missing";
    thread.messages[1].createdAt = "2026-10-15 07:30";
    value.threads.push({ ...thread, id: "t1", resolved: false, messages: [{ ...thread.messages[0], parentId: "m1" }] });
    const result = validateCommentsExchange(value);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toEqual([
      { code: "invalid-range", path: "/threads/0/anchor/hint" },
      { code: "invalid-parent", path: "/threads/0/messages/1/parentId" },
      { code: "invalid-date", path: "/threads/0/messages/1/createdAt" },
      { code: "duplicate-id", path: "/threads/1/id" },
      { code: "invalid-range", path: "/threads/1/anchor/hint" },
      { code: "invalid-resolution", path: "/threads/1" },
      { code: "duplicate-id", path: "/threads/1/messages/0/id" },
      { code: "invalid-root", path: "/threads/1/messages/0/parentId" },
    ]);
  });

  it("requires a root message, a source hash and well-formed collaboration endpoints", () => {
    const value = sample();
    value.source.hash = "sha1:abc";
    value.threads[0].messages = [];
    value.threads[0].anchor.relative = { start: {}, epoch: "" };
    const result = validateCommentsExchange(value);
    expect(result.ok ? [] : result.issues.map(issue => issue.path)).toEqual(["/source/hash", "/threads/0/anchor/relative", "/threads/0/messages"]);
  });
});
