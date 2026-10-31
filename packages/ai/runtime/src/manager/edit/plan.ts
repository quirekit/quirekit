import type { QuireAiPreparedLookup } from "./prepare";
import type { Node } from "@quirekit/pm";
import type { Static, TSchema } from "typebox";
import { readQuireAiLikeFormats } from "./like";
import { Check } from "typebox/value";
import { QuireDocumentSdkError } from "../../document-sdk/error";
import type { QuireAiBlockIdentity, QuireAiRegistry } from "../types";
import { collectQuireAiSections } from "../view/collect";
import { parseQuireAiInline } from "./markup";
import { describeOperationMismatch, dropUnusedActionTarget, operationName } from "./operation-check";
import { listQuireAiBlockCreations, listQuireAiEditableFormats, quireAiEditOperationLimit, type QuireAiEditOperationSchema } from "./schema";
import { createParagraph, groupContiguous, liftQuireAiNestedMarkup, planDeletion, settleRefilledContainers, type PlanBlock } from "./blocks";
import { planQuireAiMove, resolveQuireAiBoundary } from "./move";
import { normalizeQuireAiSearchText, searchQuireAiText } from "./search";
import { findQuireAiText, splitQuireAiLines } from "./text";
import type { QuireAiEditFailure, QuireAiEditPlan, QuireAiEditRange, QuireAiFormatValue, QuireAiPlannedBlock, QuireAiPlannedOperation } from "./types";

type EditOperation = Static<QuireAiEditOperationSchema>;


/** Facts and state an edit is planned against. */
interface PlanContext {
  /** Strict union each operation is checked against. */
  readonly operation: QuireAiEditOperationSchema;
  /** Document the edit starts from. */
  readonly doc: Node;
  /** Compiled facts. */
  readonly registry: QuireAiRegistry;
  /** Block identities of the latest read. */
  readonly identity: QuireAiBlockIdentity;
  /** Preparations of actions with `prepare`; without it such actions fail as not prepared. */
  readonly prepared?: QuireAiPreparedLookup | undefined;
  /** Whether the edit will be written as tracked changes. */
  readonly tracked?: boolean | undefined;
}

/**
 * Validates an edit and resolves every block id and text target, operation by operation.
 *
 * Nothing is changed here. Each operation is checked against its own kind and
 * planned on its own: one that cannot be planned is reported with a message
 * naming it and how to fix it, and the others still plan. Operations past the
 * per-call limit are counted as unprocessed.
 *
 * @param operations - Operations from the model, possibly malformed.
 * @param context - Start document, facts, identities and the strict operation union.
 * @returns Planned operations in start-document positions, failures and the unprocessed count.
 */
export function planQuireAiEdit(operations: readonly unknown[], context: PlanContext): QuireAiEditPlan {
  const formats = new Map(listQuireAiEditableFormats(context.registry).map(format => [format.name, format]));
  const creations = new Map(listQuireAiBlockCreations(context.registry).map(creation => [creation.key, creation]));
  const planned: QuireAiPlannedOperation[] = [];
  const failures: QuireAiEditFailure[] = [];
  operations.slice(0, quireAiEditOperationLimit).forEach((original, index) => {
    const candidate = dropUnusedActionTarget(original, context.registry);
    const name = operationName(candidate);
    const fail = (message: string, code = "invalid-input"): never => {
      throw new QuireDocumentSdkError(code, `Operation ${index + 1} (${name}): ${message}`);
    };
    const local: QuireAiPlannedOperation[] = [];
    try {
      if (!Check(context.operation, candidate)) fail(describeOperationMismatch(context.operation, candidate, name));
      const operation = candidate as EditOperation;
      const block = (id: string): PlanBlock => {
        const pos = context.identity.resolve(id);
        const node = pos === null ? null : context.doc.nodeAt(pos);
        if (pos === null || node === null) return fail(`block ${id} no longer exists; call document_read for current ids.`, "stale-target");
        const $pos = context.doc.resolve(pos);
        return { id, pos, node, parentStart: $pos.start(), parentChildCount: $pos.parent.childCount };
      };
      const formatValue = (name: string, value: unknown, level?: "character"): QuireAiFormatValue => {
        const format = formats.get(name);
        if (format === undefined) return fail(`unknown format "${name}". Known formats: ${[...formats.keys()].join(", ")}.`);
        if (level !== undefined && format.level !== level) fail(`"${name}" is a paragraph format and cannot be used inline.`);
        if (value !== null && !Check(format.schema as TSchema, value)) fail(`invalid value ${JSON.stringify(value)} for "${name}": ${format.description}`);
        return { format, value };
      };
      const lines = (source: string) => {
        let parsed;
        try { parsed = parseQuireAiInline(source); } catch (error) { return fail(error instanceof Error ? error.message : String(error)); }
        const spans = parsed.spans.map(span => ({ ...span, ...formatValue(span.name, span.value, "character") }));
        return splitQuireAiLines(parsed.text, spans);
      };
      const contentRange = (pos: number, node: Node): QuireAiEditRange => ({ from: pos + 1, to: pos + node.nodeSize - 1 });

      if (operation.op === "replace") {
        const { pos, node } = block(operation.block);
        if (!node.isTextblock) fail(`block ${operation.block} is a ${node.type.name}; edit the blocks inside it instead.`);
        let embedded = false;
        node.descendants(child => { if (!child.isText && child.type.name !== "hardBreak") embedded = true; return !embedded; });
        // Rewriting the whole block would drop content controls, fields, bookmarks and comment anchors.
        if (embedded) fail(`block ${operation.block} contains embedded fields or anchors; change its text with replace_text so they are kept.`);
        const [first, ...rest] = lines(operation.text);
        local.push({ source: index, kind: "replace-content", range: contentRange(pos, node), text: first!.text, spans: first!.spans });
        if (rest.length > 0) {
          local.push({ source: index, kind: "insert", at: pos + node.nodeSize, blocks: rest.map(line => createParagraph(context.doc, line.text, [], line.spans, node)) });
        }
      } else if (operation.op === "append") {
        const { pos, node } = block(operation.block);
        if (!node.isTextblock) fail(`block ${operation.block} is a ${node.type.name}; add text to a block inside it instead.`);
        const [first, ...rest] = lines(operation.text);
        // An empty range at the end of the content: the existing text stays and the new text follows it.
        const end = pos + node.nodeSize - 1;
        if (first!.text.length > 0) local.push({ source: index, kind: "replace-content", range: { from: end, to: end }, text: first!.text, spans: first!.spans });
        if (rest.length > 0) {
          local.push({ source: index, kind: "insert", at: pos + node.nodeSize, blocks: rest.map(line => createParagraph(context.doc, line.text, [], line.spans, node)) });
        }
      } else if (operation.op === "replace_text") {
        const { pos, node } = block(operation.block);
        const matches = findQuireAiText(node, pos, normalizeQuireAiSearchText(operation.find));
        const match = matches[(operation.occurrence ?? 1) - 1];
        if (match === undefined) {
          fail(matches.length === 0
            ? `text ${JSON.stringify(operation.find)} is not in block ${operation.block}; copy it exactly from the document view.`
            : `block ${operation.block} has only ${matches.length} occurrence(s) of ${JSON.stringify(operation.find)}.`);
        }
        local.push({ source: index, kind: "replace-text", range: match!, text: normalizeQuireAiSearchText(operation.replace) });
      } else if (operation.op === "replace_all") {
        // Listed blocks become ranges, so a table's id covers its cells.
        const within = operation.blocks?.map(id => { const { pos, node } = block(id); return { from: pos, to: pos + node.nodeSize }; });
        const found = searchQuireAiText(context.doc, context.registry, normalizeQuireAiSearchText(operation.find), within);
        if (found.length === 0) fail(`text ${JSON.stringify(operation.find)} does not occur in ${within === undefined ? "the document" : "these blocks"}; copy it exactly from the document view.`);
        const text = normalizeQuireAiSearchText(operation.replace);
        for (const { ranges } of found) for (const range of ranges) local.push({ source: index, kind: "replace-text", range, text });
      } else if (operation.op === "move") {
        const { at } = resolveQuireAiBoundary(operation, block, context.doc, context.registry, fail);
        local.push(planQuireAiMove(index, operation.blocks.map(block), at, fail, context.tracked === true));
      } else if (operation.op === "insert") {
        const { at, template } = resolveQuireAiBoundary(operation, block, context.doc, context.registry, fail);
        const blocks = operation.blocks.flatMap((entry): QuireAiPlannedBlock[] => {
          if (typeof entry === "string") {
            return lines(entry).map(line => createParagraph(context.doc, line.text, [], line.spans, template));
          }
          if ("text" in entry && typeof entry.text === "string") {
            const like = typeof entry.like === "string" ? readQuireAiLikeFormats(block(entry.like).node, context.doc, [...formats.values()]) : {};
            const values = Object.entries({ ...like, ...entry.format }).map(([name, value]) => formatValue(name, value));
            const paragraph = values.filter(value => value.format.level === "paragraph");
            const character = values.filter(value => value.format.level === "character");
            return lines(entry.text).map(line => createParagraph(
              context.doc, line.text, paragraph,
              // Whole-line formats first, so inline markup overrides them where it applies.
              [...character.map(value => ({ ...value, name: value.format.name, start: 0, end: line.text.length })), ...line.spans],
              template
            ));
          }
          const [key, value] = Object.entries(entry)[0] ?? [];
          const creation = key === undefined ? undefined : creations.get(key);
          if (creation === undefined) return fail(`unknown block kind "${String(key)}".`);
          if (!Check(creation.schema as TSchema, value)) fail(`invalid ${key}: ${creation.description}`);
          try {
            // Cell texts and other text inside a created block may carry inline markup, as paragraphs do.
            const lifted = liftQuireAiNestedMarkup(creation.build(value, context.doc.type.schema), text => {
              const parsed = parseQuireAiInline(text);
              return { text: parsed.text, spans: parsed.spans.map(span => ({ ...span, ...formatValue(span.name, span.value, "character") })) };
            });
            return [{ node: lifted.node, paragraph: [], spans: [], nested: lifted.nested }];
          } catch (error) {
            return fail(`cannot build ${key}: ${error instanceof Error ? error.message : String(error)}`);
          }
        });
        local.push({ source: index, kind: "insert", at, blocks });
      } else if (operation.op === "delete") {
        // A block already removed pending review needs nothing more; deleting it again is done.
        const live = operation.blocks.map(block).filter(entry => !isRemoved(entry.node, context.registry));
        local.push({ source: index, kind: "delete", ranges: live.length === 0 ? [] : planDeletion(live, fail, context.doc, context.registry) });
      } else if ((operation as { op: string }).op !== "format") {
        // Action operations are generated from facts, so their shape is not part of the static type.
        const dynamic = operation as unknown as { op: string; block?: string; text?: string; occurrence?: number; params?: unknown };
        const action = context.registry.actions.get(dynamic.op);
        if (action === undefined) return fail("unknown operation.");
        const params = dynamic.params === undefined && Check(action.schema as TSchema, {}) ? {} : dynamic.params;
        if (!Check(action.schema as TSchema, params)) fail(`invalid params: ${action.description}`);
        const target = dynamic.block;
        const resolved = target === undefined ? null : block(target);
        if (action.nodes !== undefined && (resolved === null || !action.nodes.includes(resolved.node.type.name))) {
          fail(`target must be a block of type ${action.nodes.join(" or ")}.`);
        }
        let range: QuireAiEditRange | null = null;
        if (action.target === "text" && resolved !== null && dynamic.text === undefined) {
          range = contentRange(resolved.pos, resolved.node);
        } else if (action.target === "text" && resolved !== null && dynamic.text !== undefined) {
          const matches = findQuireAiText(resolved.node, resolved.pos, dynamic.text);
          range = matches[(dynamic.occurrence ?? 1) - 1] ?? null;
          if (range === null) {
            fail(matches.length === 0
              ? `text ${JSON.stringify(dynamic.text)} is not in block ${target}; copy it exactly from the document view.`
              : `block ${target} has only ${matches.length} occurrence(s) of ${JSON.stringify(dynamic.text)}.`);
          }
        }
        const preparation = action.prepare === undefined ? undefined : context.prepared?.(action.name, params);
        if (action.prepare !== undefined && preparation === undefined) fail("could not be prepared in this preview; it is written with the edit.");
        if (preparation !== undefined && "error" in preparation) fail(preparation.error);
        const body = collectQuireAiSections(context.doc, context.registry).find(section => !section.story);
        local.push({
          source: index, kind: "action", action, pos: action.target === "none" ? null : resolved?.pos ?? null,
          defaultAnchor: body === undefined ? null : body.contentStart, range, params, text: dynamic.text ?? null,
          ...(preparation !== undefined && "value" in preparation ? { prepared: preparation.value } : {})
        });
      } else {
        const values = Object.entries(operation.set).map(([name, value]) => formatValue(name, value));
        if (values.length === 0) fail("`set` names no format.");
        const blocks = operation.blocks.map(block).sort((left, right) => left.pos - right.pos);
        const targets: (QuireAiEditRange & QuireAiFormatValue)[] = [];
        for (const value of values) {
          if (value.format.level === "paragraph") {
            for (const run of groupContiguous(blocks)) targets.push({ from: run.from, to: run.to, ...value });
          } else if (operation.text === undefined) {
            for (const { pos, node } of blocks) targets.push({ ...contentRange(pos, node), ...value });
          } else {
            const matches = blocks.flatMap(({ pos, node }) => findQuireAiText(node, pos, operation.text!));
            if (matches.length === 0) fail(`text ${JSON.stringify(operation.text)} is not in the given blocks; copy it exactly from the document view.`);
            for (const match of matches) targets.push({ ...match, ...value });
          }
        }
        local.push({ source: index, kind: "format", targets });
      }
      planned.push(...local);
    } catch (error) {
      if (!(error instanceof QuireDocumentSdkError)) throw error;
      failures.push({ source: index, code: error.code, message: error.message });
    }
  });
  // A standalone action owns its transaction, so mixed with other changes it fails alone.
  const isStandalone = (operation: QuireAiPlannedOperation) => operation.kind === "action" && operation.action.standalone === true;
  let kept = planned;
  if (planned.some(isStandalone) && planned.some(operation => !isStandalone(operation))) {
    const sources = new Set(planned.filter(isStandalone).map(operation => operation.source));
    for (const source of sources) {
      failures.push({ source, code: "invalid-input", message: `Operation ${source + 1} (${operationName(operations[source])}) must be in its own document_edit call, separate from other changes.` });
    }
    kept = planned.filter(operation => !sources.has(operation.source));
  }
  return {
    planned: settleRefilledContainers(kept),
    failures: failures.sort((left, right) => left.source - right.source),
    unprocessed: Math.max(0, operations.length - quireAiEditOperationLimit)
  };
}

/**
 * Tells whether a block is already removed pending review, such as a tracked deletion.
 * @param node - Block node.
 * @param registry - Compiled facts with the features' removal tests.
 * @returns Whether some feature reports the whole block removed.
 */
function isRemoved(node: Node, registry: QuireAiRegistry): boolean {
  return registry.removals.some(removal => removal.removed(node));
}
