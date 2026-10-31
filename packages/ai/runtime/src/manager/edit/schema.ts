import { Type, type TSchema } from "typebox";
import { Check } from "typebox/value";
import type { QuireAiActionCapability, QuireAiBlockCreation, QuireAiFormatCapability } from "@quirekit/ai-contract";
import type { QuireAiRegistry } from "../types";

const blockId = Type.String({ pattern: "^b[0-9]+$", description: "Block id from the document view." });

/**
 * Lists the formats the editing tool can apply.
 * @param registry - Compiled facts.
 * @returns Formats with both a value schema and an applier.
 */
export function listQuireAiEditableFormats(registry: QuireAiRegistry): readonly QuireAiFormatCapability[] {
  return [...registry.paragraphFormats, ...registry.characterFormats]
    .filter(format => format.apply !== undefined && format.schema !== undefined);
}

/**
 * Lists the block kinds the editing tool can create.
 * @param registry - Compiled facts.
 * @returns Block creations keyed by their insert key.
 */
export function listQuireAiBlockCreations(registry: QuireAiRegistry): readonly QuireAiBlockCreation[] {
  return [...registry.blocks.values()].flatMap(block => block.create === undefined ? [] : [block.create]);
}

/** Operations one `document_edit` call may carry; larger edits are split into several calls. */
export const quireAiEditOperationLimit = 200;

/**
 * Builds the editing tool's advertised parameters from the installed facts.
 *
 * The model sees the core operations in full but formats, new block kinds and actions
 * only as open objects: their names and brief signatures are in the tool description and
 * their full definitions come from `document_help`, which keeps every request short. Each
 * operation is still checked against the strict union by the planner, so a malformed
 * operation fails alone with the fields that do not fit; the operation limit is likewise
 * enforced by the planner rather than the schema.
 *
 * @param registry - Compiled facts.
 * @returns Parameter schema.
 */
export function createQuireAiEditParameters(registry: QuireAiRegistry) {
  const formats = (description: string) => Type.Object({}, { additionalProperties: true, description: `${description} Names and values as listed under Formats; null clears.` });
  const newBlock = Type.Union([
    Type.String({ description: "A paragraph; inline markup allowed." }),
    Type.Object({
      text: Type.String(),
      like: Type.Optional(Type.String({ pattern: "^b[0-9]+$", description: "Copy all formatting of this paragraph, including the bold, size and colour of its text, such as the source of a translation; add `format` or inline markup only where the new paragraph differs." })),
      format: Type.Optional(formats("Formats of the new paragraph."))
    }, { additionalProperties: false }),
    Type.Object({}, { additionalProperties: true, minProperties: 1, maxProperties: 1, description: "Another block kind as listed under Blocks, such as {table: [[\"A\",\"B\"]]}." })
  ]);
  const actions = [...registry.actions.keys()];
  const operation = Type.Union([
    ...coreOperations(newBlock, formats("Formats to set.")),
    ...(actions.length === 0 ? [] : [Type.Object({
      op: Type.Union(actions.map(name => Type.Literal(name)), { description: "Action as listed under Actions." }),
      block: Type.Optional(blockId),
      text: Type.Optional(Type.String({ minLength: 1, description: "For text targets: exact text inside the block." })),
      occurrence: Type.Optional(Type.Integer({ minimum: 1 })),
      params: Type.Optional(Type.Object({}, { additionalProperties: true, description: "Parameters as listed under Actions." }))
    }, { additionalProperties: false })]),
    Type.Object({ op: Type.String() }, { additionalProperties: true, description: "Fallback so a malformed operation is reported alone; write operations in the forms above." })
  ]);
  return Type.Object({ operations: Type.Array(operation, { minItems: 1 }) }, { additionalProperties: false });
}

/**
 * Builds the strict union of operation kinds, against which each operation is checked.
 * @param registry - Compiled facts.
 * @returns Union with one branch per operation kind, told apart by `op`.
 */
export function createQuireAiEditOperation(registry: QuireAiRegistry) {
  const formats = listQuireAiEditableFormats(registry);
  const formatSet = (description: string) => Type.Object(Object.fromEntries(formats.map(format => [
    format.name,
    Type.Optional(Type.Union([format.schema as TSchema, Type.Null()], { description: `${format.level === "paragraph" ? "Paragraph" : "Character"}: ${format.description} null clears.` }))
  ])), { additionalProperties: false, description });
  const newBlock = Type.Union([
    Type.String({ description: "A paragraph; inline markup allowed." }),
    Type.Object({
      text: Type.String(),
      like: Type.Optional(Type.String({ pattern: "^b[0-9]+$", description: "Copy all formatting of this paragraph, including the bold, size and colour of its text, such as the source of a translation; add `format` or inline markup only where the new paragraph differs." })),
      format: Type.Optional(formatSet("Formats of the new paragraph."))
    }, { additionalProperties: false }),
    ...listQuireAiBlockCreations(registry).map(creation =>
      Type.Object({ [creation.key]: creation.schema as TSchema }, { additionalProperties: false, description: creation.description }))
  ]);
  const operation = Type.Union([
    ...coreOperations(newBlock, formatSet("Formats to set.")),
    ...[...registry.actions.values()].map(action => Type.Object({
      op: Type.Literal(action.name),
      ...actionTarget(action),
      // Parameters that may all be left out may be omitted as a whole.
      params: Check(action.schema as TSchema, {}) ? Type.Optional(action.schema as TSchema) : action.schema as TSchema
    }, { additionalProperties: false, description: action.description }))
  ]);
  return operation;
}

/** Parameter schema type of the editing tool. */
export type QuireAiEditParameters = ReturnType<typeof createQuireAiEditParameters>;

/** Strict operation union type. */
export type QuireAiEditOperationSchema = ReturnType<typeof createQuireAiEditOperation>;

/**
 * Builds the target fields of one action operation.
 * @param action - Action fact.
 * @returns `block` and, for text targets, `text` and `occurrence`; nothing for untargeted actions.
 */
function actionTarget(action: QuireAiActionCapability): Record<string, TSchema> {
  if (action.target === "none") return {};
  const kinds = action.nodes === undefined ? "" : ` (${action.nodes.join(", ")})`;
  if (action.target === "text") {
    return {
      block: Type.String({ pattern: "^b[0-9]+$", description: `Id of the block holding the text${kinds}.` }),
      text: Type.Optional(Type.String({ minLength: 1, description: "Exact text inside the block, copied from the document view; omit to address the whole block." })),
      occurrence: Type.Optional(Type.Integer({ minimum: 1, description: "Which occurrence of the text, counted from 1; default 1." }))
    };
  }
  return {
    block: action.nodes === undefined
      ? Type.Optional(Type.String({ pattern: "^b[0-9]+$", description: "Any block of the target section; default the first body section." }))
      : Type.String({ pattern: "^b[0-9]+$", description: `Id of the target block${kinds}.` })
  };
}

/**
 * Builds the core operation kinds, shared by the strict union and the advertised parameters.
 * @param newBlock - Schema of one new block.
 * @param formatSet - Schema of a format set.
 * @returns One object schema per core operation.
 */
function coreOperations<Block extends TSchema, Formats extends TSchema>(newBlock: Block, formatSet: Formats) {
  return [
    Type.Object({
      op: Type.Literal("replace"), block: blockId,
      text: Type.String({ description: "New content of the block; inline markup allowed; paragraph formats are kept." })
    }, { additionalProperties: false }),
    Type.Object({
      op: Type.Literal("append"), block: blockId,
      text: Type.String({ minLength: 1, description: "Text added at the end of the block; inline markup allowed; a line break starts a new paragraph after it, while <br/> breaks the line inside the block." })
    }, { additionalProperties: false }),
    Type.Object({
      op: Type.Literal("replace_text"), block: blockId,
      find: Type.String({ minLength: 1, description: "Exact text inside the block." }),
      replace: Type.String({ description: "Plain replacement text, with <br/> for a line break inside the paragraph; keeps the formatting of the replaced text." }),
      occurrence: Type.Optional(Type.Integer({ minimum: 1, description: "Which occurrence of `find`; default 1." }))
    }, { additionalProperties: false }),
    Type.Object({
      op: Type.Literal("replace_all"),
      find: Type.String({ minLength: 1, description: "Exact text to replace wherever it occurs: body, tables, headers, footers, notes and other stories; no block ids or reading needed." }),
      replace: Type.String({ description: "Plain replacement text, with <br/> for a line break inside the paragraph; keeps the formatting of each replaced text." }),
      blocks: Type.Optional(Type.Array(blockId, { minItems: 1, maxItems: 500, description: "Only in these blocks and the blocks inside them, such as a table's cells; default the whole document." }))
    }, { additionalProperties: false }),
    Type.Object({
      op: Type.Literal("insert"),
      after: Type.Optional(blockId), before: Type.Optional(blockId),
      at: Type.Optional(Type.Union([Type.Literal("start"), Type.Literal("end")], { description: "Start or end of the body." })),
      blocks: Type.Array(newBlock, { minItems: 1, maxItems: 200 })
    }, { additionalProperties: false }),
    Type.Object({
      op: Type.Literal("move"),
      blocks: Type.Array(blockId, { minItems: 1, maxItems: 200, description: "Adjacent blocks of one container, such as paragraphs, a table or a picture, moved as they are with all content and formatting." }),
      after: Type.Optional(blockId), before: Type.Optional(blockId),
      at: Type.Optional(Type.Union([Type.Literal("start"), Type.Literal("end")], { description: "Start or end of the body." }))
    }, { additionalProperties: false }),
    Type.Object({
      op: Type.Literal("delete"),
      blocks: Type.Array(blockId, { minItems: 1, maxItems: 500, description: "Whole blocks to remove." })
    }, { additionalProperties: false }),
    Type.Object({
      op: Type.Literal("format"),
      blocks: Type.Array(blockId, { minItems: 1, maxItems: 500 }),
      text: Type.Optional(Type.String({ minLength: 1, description: "Limit character formats to every occurrence of this exact text in the blocks." })),
      set: formatSet
    }, { additionalProperties: false })
  ] as const;
}
