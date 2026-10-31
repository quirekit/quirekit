import { Type, type TSchema } from "typebox";
import { Check } from "typebox/value";
import type { QuireAiSourceCommandDescriptor } from "@quirekit/ai-contract";

const blockId = Type.String({ pattern: "^b[0-9]+$", description: "Block id from the document view." });
const position = {
  after: Type.Optional(blockId), before: Type.Optional(blockId),
  at: Type.Optional(Type.Union([Type.Literal("start"), Type.Literal("end")], { description: "Start or end of the document." }))
};

/** Operations one `document_edit` call may carry; larger edits are split into several calls. */
export const quireAiSourceEditOperationLimit = 200;

/**
 * Builds the core operation kinds of a source document.
 * @returns One object schema per core operation.
 */
function coreOperations() {
  return [
    Type.Object({
      op: Type.Literal("replace"), block: blockId,
      text: Type.String({ description: "Markdown replacing the block's source; may hold several blocks." })
    }, { additionalProperties: false }),
    Type.Object({
      op: Type.Literal("append"), block: blockId,
      text: Type.String({ minLength: 1, description: "Markdown added at the end of the block's source." })
    }, { additionalProperties: false }),
    Type.Object({
      op: Type.Literal("replace_text"), block: blockId,
      find: Type.String({ minLength: 1, description: "Exact source text inside the block, copied from the view." }),
      replace: Type.String({ description: "Replacement Markdown." }),
      occurrence: Type.Optional(Type.Integer({ minimum: 1, description: "Which occurrence of `find`; default 1." }))
    }, { additionalProperties: false }),
    Type.Object({
      op: Type.Literal("replace_all"),
      find: Type.String({ minLength: 1, description: "Exact source text to replace wherever it occurs; no block ids or reading needed." }),
      replace: Type.String({ description: "Replacement Markdown." }),
      blocks: Type.Optional(Type.Array(blockId, { minItems: 1, maxItems: 500, description: "Only in these blocks and the blocks inside them; default the whole document." }))
    }, { additionalProperties: false }),
    Type.Object({
      op: Type.Literal("insert"), ...position,
      blocks: Type.Array(Type.String({ minLength: 1, description: "Markdown of one or more blocks." }), { minItems: 1, maxItems: 200 })
    }, { additionalProperties: false }),
    Type.Object({
      op: Type.Literal("move"), ...position,
      blocks: Type.Array(blockId, { minItems: 1, maxItems: 200, description: "Adjacent blocks of one level, such as paragraphs or the items of one list, moved as they are." })
    }, { additionalProperties: false }),
    Type.Object({
      op: Type.Literal("delete"),
      blocks: Type.Array(blockId, { minItems: 1, maxItems: 500, description: "Whole blocks to remove, with the blocks inside them." })
    }, { additionalProperties: false })
  ] as const;
}

/**
 * Builds the target fields of one described command.
 * @param descriptor - Command description.
 * @returns Target fields of its operation.
 */
function commandTarget(descriptor: QuireAiSourceCommandDescriptor): Record<string, TSchema> {
  const kinds = descriptor.kinds === undefined ? "" : ` (${descriptor.kinds.join(", ")})`;
  switch (descriptor.target ?? "document") {
    case "text": return {
      block: Type.String({ pattern: "^b[0-9]+$", description: `Id of the block holding the text${kinds}.` }),
      text: Type.Optional(Type.String({ minLength: 1, description: "Exact source text inside the block; omit to address the whole block." })),
      occurrence: Type.Optional(Type.Integer({ minimum: 1, description: "Which occurrence of the text, counted from 1; default 1." }))
    };
    case "block": return { block: Type.String({ pattern: "^b[0-9]+$", description: `Id of the target block${kinds}.` }) };
    case "annotation": return { annotation: Type.String({ pattern: "^c[0-9]+$", description: "Id of the comment thread, such as c2." }) };
    default: return {};
  }
}

/**
 * Builds the strict union every operation is checked against.
 * @param commands - Described commands by name.
 * @returns Union with one branch per operation kind, told apart by `op`.
 */
export function createQuireAiSourceEditOperation(commands: ReadonlyMap<string, QuireAiSourceCommandDescriptor>) {
  return Type.Union([
    ...coreOperations(),
    ...[...commands].map(([name, descriptor]) => Type.Object({
      op: Type.Literal(name),
      ...commandTarget(descriptor),
      // Parameters that may all be left out may be omitted as a whole.
      params: descriptor.params === undefined || Check(descriptor.params as TSchema, {})
        ? Type.Optional((descriptor.params ?? Type.Object({})) as TSchema) : descriptor.params as TSchema
    }, { additionalProperties: false, description: descriptor.description }))
  ]);
}

/**
 * Builds the advertised parameters: core operations in full, commands as an open branch whose
 * names and signatures are in the description. Each operation is checked strictly when planned,
 * so one malformed operation fails alone.
 * @param commands - Described commands by name.
 * @returns Parameter schema.
 */
export function createQuireAiSourceEditParameters(commands: ReadonlyMap<string, QuireAiSourceCommandDescriptor>) {
  const names = [...commands.keys()];
  const operation = Type.Union([
    ...coreOperations(),
    ...(names.length === 0 ? [] : [Type.Object({
      op: Type.Union(names.map(name => Type.Literal(name)), { description: "Command as listed under Commands." }),
      block: Type.Optional(blockId),
      text: Type.Optional(Type.String({ minLength: 1 })),
      occurrence: Type.Optional(Type.Integer({ minimum: 1 })),
      annotation: Type.Optional(Type.String({ pattern: "^c[0-9]+$" })),
      params: Type.Optional(Type.Object({}, { additionalProperties: true, description: "Parameters as listed under Commands." }))
    }, { additionalProperties: false })]),
    Type.Object({ op: Type.String() }, { additionalProperties: true, description: "Fallback so a malformed operation is reported alone; write operations in the forms above." })
  ]);
  return Type.Object({ operations: Type.Array(operation, { minItems: 1 }) }, { additionalProperties: false });
}

/** Parameter schema type of the source editing tool. */
export type QuireAiSourceEditParameters = ReturnType<typeof createQuireAiSourceEditParameters>;
