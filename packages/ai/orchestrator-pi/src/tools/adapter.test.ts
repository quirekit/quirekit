import { describe, expect, it } from "vitest";
import { createTestDocument } from "../testing/fixtures";
import { createDocumentPiTools } from "./adapter";

describe("document Pi tools", () => {
  it("rejects arguments with the SDK's explanation before Pi's own schema check", () => {
    const fixture = createTestDocument();
    const document = { ...fixture.document, checkInput: () => "Tool arguments do not match the declared schema: /operations/59 must have required properties text. Nothing was changed." };
    const [tool] = createDocumentPiTools(document, "session", "run", "request-1", new AbortController().signal);
    expect(() => tool!.prepareArguments!({ operations: [] })).toThrow("/operations/59 must have required properties text");
  });

  it("passes arguments the SDK accepts through unchanged", () => {
    const fixture = createTestDocument();
    const [tool] = createDocumentPiTools(fixture.document, "session", "run", "request-1", new AbortController().signal);
    const args = { value: "x" };
    expect(tool!.prepareArguments!(args)).toBe(args);
  });
});
