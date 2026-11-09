import { describe, expect, it } from "vitest";
import { mdDocumentLinkSource } from "./portable";

describe("document links", () => {
  it("writes a standard Markdown link with the title as text", () => {
    expect(mdDocumentLinkSource({ id: "a", label: "支付 [设计]", url: "/d/abc" })).toBe("[支付 \\[设计\\]](/d/abc)");
  });

  it("rejects unsafe or incomplete documents", () => {
    expect(mdDocumentLinkSource({ id: "a", label: "x", url: "javascript:alert(1)" })).toBeNull();
    expect(mdDocumentLinkSource({ id: "", label: "x", url: "/d/abc" })).toBeNull();
    expect(mdDocumentLinkSource({ id: "a", label: "两\n行", url: "/d/abc" })).toBeNull();
  });
});
