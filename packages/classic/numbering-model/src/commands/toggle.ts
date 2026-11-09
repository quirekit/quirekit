import type { CommandProps, CommandSpec } from "@quirekit/core";
import type {
  Command,
  EditorState,
  Transaction
} from "@quirekit/pm";
import { collectSelectedWordParagraphs } from "@quirekit/classic-paragraph-model";
import type {
  ToggleWordOrderedListOptions,
  ToggleWordTaskListOptions,
  WordListKind,
  WordNumberingAtPositionOptions,
  WordParagraphNumbering
} from "../types";
import {
  createWordNumberingInstance,
  getDefaultWordAbstractNumId,
  resolveWordNumberingRegistry,
  resolveWordParagraphNumbering
} from "../model";
import {
  collectWordNumberingCommandTargets,
  findAdjacentWordNumberingInstance,
  resolveWordParagraphListKind
} from "./targets";
import { defaultWordNumberingParagraphTypes } from "../selection";

/** Mutable transaction authority shared by editor and auxiliary Story commands. */
interface WordListMutationContext {
  /** Chain-aware PM state whose document and selection follow the transaction. */
  readonly state: EditorState;
  /** Transaction receiving registry and paragraph writes. */
  readonly tr: Transaction;
  /** Dispatcher applying the complete atomic mutation. */
  readonly dispatch: ((transaction: Transaction) => void) | undefined;
}

/**
 * Creates a multi-paragraph list-family toggle command.
 *
 * @param kind - Ordered, bullet, or task family.
 * @param paragraphTypes - Registered paragraph-like node names.
 * @returns Command that applies or clears flat Word numbering.
 */
export function createToggleWordListCommand(
  kind: WordListKind,
  paragraphTypes: readonly string[]
): CommandSpec {
  return (value) => (context) => {
    const options = readToggleOptions(kind, value);
    if (options === undefined) return false;
    return toggleWordList(toMutationContext(context), kind, paragraphTypes, options);
  };
}

/**
 * Creates a PM command for numbered paragraphs inside an auxiliary Word Story.
 *
 * The transient top document owns a working numbering registry while editing.
 * Its product host must merge that registry into the canonical document when
 * the Story is committed.
 *
 * @param kind - Ordered, bullet, or task family.
 * @param paragraphTypes - Paragraph-like node names accepted by the Story.
 * @returns ProseMirror command that reuses the canonical Word algorithm.
 */
export function createToggleWordStoryListCommand(
  kind: WordListKind,
  paragraphTypes: readonly string[] = defaultWordNumberingParagraphTypes
): Command {
  return (state, dispatch) => {
    const options = { start: null, checked: false } as const;
    const tr = state.tr;
    return toggleWordList({
      state,
      tr,
      dispatch: dispatch ?? (() => undefined)
    }, kind, paragraphTypes, options);
  };
}

/**
 * Creates a PM command that clears numbering from an auxiliary Word Story.
 *
 * @param paragraphTypes - Paragraph-like node names accepted by the Story.
 * @returns ProseMirror command that clears flat Word numbering references.
 */
export function createClearWordStoryListCommand(
  paragraphTypes: readonly string[] = defaultWordNumberingParagraphTypes
): Command {
  return (state, dispatch) => {
    const targets = collectSelectedWordParagraphs(
      { pm: state, doc: state.doc },
      paragraphTypes
    );
    const tr = state.tr;
    let changed = false;
    for (const target of targets) {
      if (resolveWordParagraphNumbering(target.node.attrs.wordNumbering) === null) {
        continue;
      }
      tr.setNodeMarkup(target.position, undefined, {
        ...target.node.attrs,
        wordNumbering: null
      });
      changed = true;
    }
    if (!changed) return false;
    dispatch?.(tr.scrollIntoView());
    return true;
  };
}

/**
 * Creates a command that clears Word numbering from selected paragraphs.
 *
 * @param paragraphTypes - Registered paragraph-like node names.
 * @returns Selection-aware clear command.
 */
export function createClearWordListCommand(
  paragraphTypes: readonly string[]
): CommandSpec {
  return () => (context) => {
    const targets = collectWordNumberingCommandTargets(context, paragraphTypes);
    let changed = false;
    for (const target of targets) {
      if (resolveWordParagraphNumbering(target.node.attrs.wordNumbering) === null) continue;
      context.tr.setNodeMarkup(target.position, undefined, {
        ...target.node.attrs,
        wordNumbering: null
      });
      changed = true;
    }
    if (!changed) return false;
    context.dispatch?.(context.tr);
    return true;
  };
}

/**
 * Creates a marker-owned command that clears one paragraph's numbering.
 *
 * @param paragraphTypes - Registered paragraph-like node names.
 * @returns Command that clears one exact paragraph without moving selection.
 */
export function createClearWordListAtPositionCommand(
  paragraphTypes: readonly string[]
): CommandSpec {
  const allowedTypes = new Set(paragraphTypes);
  return (value) => (context) => {
    const position = readPosition(value);
    if (position === undefined) return false;
    const node = context.state.doc.nodeAt(position);
    if (
      node === null
      || !node.isTextblock
      || !allowedTypes.has(node.type.name)
      || resolveWordParagraphNumbering(node.attrs.wordNumbering) === null
    ) {
      return false;
    }
    context.tr.setNodeMarkup(position, undefined, {
      ...node.attrs,
      wordNumbering: null
    });
    context.dispatch?.(context.tr);
    return true;
  };
}

/**
 * Applies one list family or clears an already uniform selection.
 *
 * @param context - Active command context.
 * @param kind - Desired list family.
 * @param paragraphTypes - Registered paragraph-like node names.
 * @param options - Optional automatic-prefix state.
 * @returns Whether one transaction was dispatched.
 */
function toggleWordList(
  context: WordListMutationContext,
  kind: WordListKind,
  paragraphTypes: readonly string[],
  options: { readonly start: number | null; readonly checked: boolean }
): boolean {
  const targets = collectSelectedWordParagraphs(
    { pm: context.state, doc: context.state.doc },
    paragraphTypes
  );
  if (targets.length === 0) return false;
  let registry = resolveWordNumberingRegistry(
    context.state.doc.attrs.wordNumberingRegistry
  );
  const existing = targets.map(({ node }) =>
    resolveWordParagraphNumbering(node.attrs.wordNumbering)
  );
  const allActive = existing.every((numbering) =>
    resolveWordParagraphListKind(registry, numbering) === kind
  );
  if (allActive) {
    for (const target of targets) {
      context.tr.setNodeMarkup(target.position, undefined, {
        ...target.node.attrs,
        wordNumbering: null
      });
    }
    context.dispatch?.(context.tr);
    return true;
  }

  // Concrete list identity is selected before paragraph writes so registry and
  // references enter history as one atomic transform.
  let numId = existing.find((numbering) =>
    numbering !== null
    && resolveWordParagraphListKind(registry, numbering) === kind
  )?.numId;
  numId ??= findAdjacentWordNumberingInstance(
    context.state.doc,
    targets,
    paragraphTypes,
    registry,
    kind
  );
  if (numId === undefined) {
    const created = createWordNumberingInstance(
      registry,
      getDefaultWordAbstractNumId(kind)
    );
    registry = created.registry;
    numId = created.numId;
  }
  context.tr.setDocAttribute("wordNumberingRegistry", registry);
  for (const [index, target] of targets.entries()) {
    const previous = existing[index];
    const level = previous?.level ?? 0;
    const numbering: WordParagraphNumbering = {
      numId,
      level,
      startOverride: index === 0 ? options.start : null,
      task: kind === "task" ? { checked: options.checked } : null
    };
    context.tr.setNodeMarkup(target.position, undefined, {
      ...target.node.attrs,
      wordNumbering: numbering
    });
  }
  context.dispatch?.(context.tr);
  return true;
}

/**
 * Adapts one Quire command transaction to the shared Word-list mutator.
 *
 * @param context - Active editor command context.
 * @returns Chain-aware mutation authority.
 */
function toMutationContext(
  context: CommandProps
): WordListMutationContext {
  return {
    state: context.state,
    tr: context.tr,
    dispatch: context.dispatch
  };
}

/**
 * Validates the optional arguments accepted by list toggle commands.
 *
 * @param kind - Target list family.
 * @param value - Candidate command payload.
 * @returns Normalized start/checked options, or undefined when invalid.
 */
function readToggleOptions(
  kind: WordListKind,
  value: unknown
): { readonly start: number | null; readonly checked: boolean } | undefined {
  if (value === undefined) return { start: null, checked: false };
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  if (kind === "ordered") {
    const start = (value as ToggleWordOrderedListOptions).start;
    return start === undefined
      ? { start: null, checked: false }
      : Number.isInteger(start) && start >= 0
        ? { start, checked: false }
        : undefined;
  }
  if (kind === "task") {
    const checked = (value as ToggleWordTaskListOptions).checked;
    return checked === undefined || typeof checked === "boolean"
      ? { start: null, checked: checked ?? false }
      : undefined;
  }
  return Object.keys(value).length === 0
    ? { start: null, checked: false }
    : undefined;
}

/**
 * Reads one exact paragraph position from a marker command payload.
 *
 * @param value - Candidate marker payload.
 * @returns Non-negative position or undefined.
 */
function readPosition(value: unknown): number | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const position = (value as WordNumberingAtPositionOptions).position;
  return Number.isInteger(position) && position >= 0 ? position : undefined;
}
