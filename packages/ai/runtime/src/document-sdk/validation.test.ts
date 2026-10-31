import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import { describeQuireSchemaMismatch } from "./validation";

describe("describeQuireSchemaMismatch", () => {
  it("names the properties a closed object does not take", () => {
    const schema = Type.Object({ from: Type.Optional(Type.String()), items: Type.Optional(Type.Object({ block: Type.String() })) }, { additionalProperties: false });
    expect(describeQuireSchemaMismatch(schema, { block: "b1", items: { block: "b1" } }))
      .toBe("/ must not have additional properties \"block\"");
  });
});
