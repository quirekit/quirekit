import { describe, expect, it } from "vitest";
import { briefQuireAiSchema } from "./brief";

const schema = {
  type: "object", required: ["kind"], properties: {
    kind: { enum: ["bullet", "number"], description: "List kind." },
    level: { type: "integer", minimum: 0, maximum: 8 },
    style: { anyOf: [{ const: "1." }, { const: "a." }, { const: "i." }] },
    cells: { type: "array", items: { type: "array", items: { type: "string" } } },
    border: { type: "object", properties: { color: { type: "string" } } }
  }
};

describe("brief schema notation", () => {
  it("renders one line with required and optional fields, ranges, enumerations and arrays", () => {
    expect(briefQuireAiSchema(schema, { depth: 3, comments: false }))
      .toBe('{kind: "bullet"|"number"; level?: integer 0..8; style?: "1."|"a."|"i."; cells?: string[][]; border?: {color?: string}}');
  });

  it("cuts deep objects and long enumerations", () => {
    expect(briefQuireAiSchema(schema, { depth: 1, comments: false, values: 2 }))
      .toBe('{kind: "bullet"|"number"; level?: integer 0..8; style?: "1."|"a."|…; cells?: string[][]; border?: {…}}');
  });

  it("merges alternatives tagged by kind and lists every tag", () => {
    const union = { anyOf: ["add-row", "delete-row", "merge-cells"].map(kind => ({ type: "object", properties: { kind: { const: kind }, row: { type: "integer" } } })) };
    expect(briefQuireAiSchema(union, { depth: 1, comments: false, values: 1, merge: true })).toBe('{kind: "add-row"|"delete-row"|"merge-cells"; …}');
  });

  it("puts descriptions on their own comment lines in full form", () => {
    expect(briefQuireAiSchema({ type: "object", properties: { kind: schema.properties.kind } }, { depth: 3, comments: true }))
      .toBe('{\n  // List kind.\n  kind?: "bullet"|"number";\n}');
  });
});
