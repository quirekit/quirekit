import type { QuireAiSourceCapability, QuireAiSourceCommandDescriptor } from "@quirekit/ai-contract";
import { applyQuireAiSourceChanges } from "./changes/map";
import type { QuireAiSourceBlock, QuireAiSourceChangeSet, QuireAiSourceDocument, QuireAiSourceStep, QuireAiSourceStepResult, QuireAiSourceTransaction } from "./types";

/** Command planner of the fake editor. */
export type FakeSourceCommand = (text: string, params: unknown, selection: { from: number; to: number } | undefined) => QuireAiSourceChangeSet | null;

/**
 * Segments a small Markdown subset: headings, paragraphs, fenced code and nested list items.
 * @param text - Markdown.
 * @returns Blocks, parents before children.
 */
export function segmentFakeMarkdown(text: string): QuireAiSourceBlock[] {
  const lines: { from: number; text: string }[] = [];
  let at = 0;
  for (const line of text.split("\n")) { lines.push({ from: at, text: line }); at += line.length + 1; }
  const blocks: QuireAiSourceBlock[] = [];
  const end = (index: number) => lines[index]!.from + lines[index]!.text.length;
  const marker = /^(\s*)([-*+]|\d+[.)])\s/u;
  let index = 0;
  // Start of the list each indentation belongs to, while items continue.
  const lists = new Map<number, number>();
  while (index < lines.length) {
    const line = lines[index]!;
    if (line.text.trim() === "") { index += 1; continue; }
    const list = marker.exec(line.text);
    if (list !== null) {
      const indent = list[1]!;
      for (const key of [...lists.keys()]) if (key > indent.length) lists.delete(key);
      if (!lists.has(indent.length)) lists.set(indent.length, line.from + indent.length);
      let own = index;
      while (own + 1 < lines.length && lines[own + 1]!.text.trim() !== "" && !marker.test(lines[own + 1]!.text)
        && lines[own + 1]!.text.startsWith(`${indent}  `)) own += 1;
      let last = own;
      for (let next = own + 1; next < lines.length; next += 1) {
        const value = lines[next]!.text;
        if (value.trim() === "") continue;
        if (value.length - value.trimStart().length > indent.length) last = next; else break;
      }
      blocks.push({ from: line.from + indent.length, to: end(own), end: end(last), kind: "list-item", name: "ListItem",
        depth: indent.length / 2, indent, attrs: {}, list: lists.get(indent.length)! });
      index = own + 1;
      continue;
    }
    lists.clear();
    if (line.text.startsWith("```")) {
      let close = index + 1;
      while (close < lines.length && !lines[close]!.text.startsWith("```")) close += 1;
      close = Math.min(close, lines.length - 1);
      const language = line.text.slice(3).trim();
      blocks.push({ from: line.from, to: end(close), end: end(close), kind: "code", name: line.text.includes("flow") ? "Flowchart" : "FencedCode", depth: 0, indent: "", attrs: language === "" ? {} : { language } });
      index = close + 1;
      continue;
    }
    if (line.text.startsWith("#")) {
      blocks.push({ from: line.from, to: end(index), end: end(index), kind: "heading", name: "ATXHeading", depth: 0, indent: "", attrs: {} });
      index += 1;
      continue;
    }
    let last = index;
    while (last + 1 < lines.length && lines[last + 1]!.text.trim() !== "" && !marker.test(lines[last + 1]!.text) && !lines[last + 1]!.text.startsWith("#")) last += 1;
    blocks.push({ from: line.from, to: end(last), end: end(last), kind: "paragraph", name: "Paragraph", depth: 0, indent: "", attrs: {} });
    index = last + 1;
  }
  return blocks;
}

/** Fake source document with its controls. */
export interface FakeSourceDocument extends QuireAiSourceDocument {
  /** Replaces text as a user would, outside the AI. @param changes - Replacements. */
  edit(changes: QuireAiSourceChangeSet): void;
  /** Sets the selection. @param from - Start. @param to - End. */
  select(from: number, to: number): void;
  /** Number of AI transactions applied, each one undo step. */
  readonly transactions: number;
  /** Marks the document read-only. @param value - Read-only. */
  setReadOnly(value: boolean): void;
}

/**
 * Creates an in-memory source document.
 * @param initial - Initial Markdown.
 * @param options - Commands and facts.
 * @returns Fake port with controls.
 */
export function createFakeSourceDocument(initial: string, options: {
  /** Command planners with their descriptions. */
  readonly commands?: Readonly<Record<string, {
    /** Agent description. */
    readonly descriptor: QuireAiSourceCommandDescriptor;
    /** Text planner. */
    readonly run: FakeSourceCommand;
    /** State effect of the command, with its inverse and review description. */
    readonly effect?: (params: unknown) => { readonly inverse: unknown; readonly described: QuireAiSourceTransaction["described"] };
  }>>;
  /** Facts. */
  readonly capabilities?: () => readonly QuireAiSourceCapability[];
  /** Applies a state inverse step. */
  readonly applyState?: (inverse: unknown) => void;
} = {}): FakeSourceDocument {
  let text = initial;
  let revision = 0;
  let readOnly = false;
  let selection = { from: 0, to: 0 };
  let transactions = 0;
  const listeners = new Set<(transaction: QuireAiSourceTransaction) => void>();
  /** @param changes - Replacements. @param agent - Attribution. */
  const commit = (changes: QuireAiSourceChangeSet, agent: QuireAiSourceTransaction["agent"]) => {
    const removed = changes.map(change => text.slice(change.from, change.to));
    text = applyQuireAiSourceChanges(text, changes);
    revision += 1;
    for (const listener of listeners) listener({ changes, removed, agent });
  };
  /** @param steps - Steps. @returns Result with each step's changes. */
  const run = (steps: readonly QuireAiSourceStep[]): QuireAiSourceStepResult => {
    let draft = text;
    const changes: QuireAiSourceChangeSet[] = [];
    for (const [index, step] of steps.entries()) {
      if (step.kind === "state") { changes.push([]); continue; }
      const set = step.kind === "changes" ? step.changes : options.commands?.[step.name]?.run(draft, step.params, step.selection) ?? null;
      if (set === null) return { ok: false, failedStep: index };
      draft = applyQuireAiSourceChanges(draft, set);
      changes.push(set);
    }
    return { ok: true, changes, text: draft };
  };
  return {
    language: "markdown",
    text: () => text,
    revision: () => String(revision),
    isOpen: () => true,
    isEditable: () => !readOnly,
    onDestroy: () => () => undefined,
    blocks: () => segmentFakeMarkdown(text),
    segment: segmentFakeMarkdown,
    selection: () => selection,
    plan: run,
    apply(steps, meta) {
      const result = run(steps);
      if (!result.ok) return result;
      // One transaction: sequential step changes are reported one after another, as one undo step.
      transactions += 1;
      result.changes.forEach(changes => { if (changes.length > 0) commit(changes, meta); });
      for (const step of steps) {
        if (step.kind === "state") options.applyState?.(step.inverse);
        const effect = step.kind === "command" ? options.commands?.[step.name]?.effect?.(step.params) : undefined;
        if (effect !== undefined) for (const listener of listeners) listener({ changes: [], removed: [], agent: meta, ...effect });
      }
      return result;
    },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    commands: () => new Map(Object.entries(options.commands ?? {}).map(([name, entry]) => [name, entry.descriptor])),
    capabilities: () => options.capabilities?.() ?? [],
    edit: changes => commit(changes, null),
    select(from, to) { selection = { from, to }; },
    get transactions() { return transactions; },
    setReadOnly(value) { readOnly = value; }
  };
}
