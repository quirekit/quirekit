import type {
  QuireAiSourceCapability, QuireAiSourceChangeSet, QuireAiSourceCommandDescriptor, QuireAiSourceDocument, QuireAiSourceStep,
  QuireAiSourceStepResult, QuireAiSourceTransaction, QuireAiSourceWriteMeta
} from "@quirekit/ai-runtime/source";
import { invertedEffects } from "@quirekit/cm-commands";
import { language } from "@quirekit/cm-language";
import { Annotation, ChangeSet, EditorSelection, EditorState, type Transaction } from "@quirekit/cm-state";
import { markChangeOrigin, planNamedCommand, readAiCapabilities, readCommandDescriptors, type MsfeCommand, type MsfeEditor } from "@quirekit/msfe-core";
import { segmentMsfeSource } from "./blocks";
import { describeMsfeAiAnnotationChanges, readMsfeAiAnnotations } from "./described";
import { followMsfeTransactions, isMsfeAiInstalled } from "./extension";
import type { MsfeAiStateInverse } from "./types";

/** Attribution carried by AI transactions. */
const agentWrite = Annotation.define<QuireAiSourceWriteMeta>();

/** Inverses kept for review; older ones are dropped. */
const keptInverses = 500;

/**
 * @param changes - CodeMirror change set.
 * @returns The same replacements in the AI core's form.
 */
function toChangeSet(changes: ChangeSet): QuireAiSourceChangeSet {
  const result: { from: number; to: number; insert: string }[] = [];
  changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => { result.push({ from: fromA, to: toA, insert: inserted.toString() }); });
  return result;
}

/**
 * Provides an MSFE editor to the AI core as a source document port.
 *
 * Writes run as one command chain, so every AI write is one transaction and one undo step,
 * labelled `agent` in change events. Non-text effects of AI writes, such as comments, are kept
 * with their inverse so a rejected request can take them back.
 *
 * @param editor - Mounted editor with the MsfeAi extension installed.
 * @returns Source document port.
 */
export function createMsfeAiDocument(editor: MsfeEditor): QuireAiSourceDocument {
  if (!isMsfeAiInstalled(editor)) throw new TypeError("Install the MsfeAi extension in the editor before connecting it to the AI core.");
  const listeners = new Set<(transaction: QuireAiSourceTransaction) => void>();
  const inverses: MsfeAiStateInverse[] = [];
  let writing: { readonly stash: Transaction[] } | null = null;
  /** @param transaction - Accepted transaction. @param described - Non-text changes it made, for an AI write. */
  const report = (transaction: Transaction, described?: QuireAiSourceTransaction["described"]) => {
    const agent = transaction.annotation(agentWrite) ?? null;
    const changes = toChangeSet(transaction.changes);
    let inverse: MsfeAiStateInverse | undefined;
    if (agent !== null) {
      const effects = transaction.startState.facet(invertedEffects).flatMap(invert => invert(transaction));
      if (effects.length > 0) {
        inverses.push(inverse = { effects });
        if (inverses.length > keptInverses) inverses.shift();
      }
    }
    const event: QuireAiSourceTransaction = {
      changes, removed: changes.map(change => transaction.startState.sliceDoc(change.from, change.to)), agent,
      ...(inverse === undefined ? {} : { inverse }), ...(described === undefined || described.length === 0 ? {} : { described })
    };
    for (const listener of listeners) listener(event);
  };
  followMsfeTransactions(editor, transaction => {
    // Kept inverses follow every change, as undo history maps its effects.
    if (transaction.docChanged) {
      for (const inverse of inverses) inverse.effects = inverse.effects.flatMap(effect => effect.map(transaction.changes) ?? []);
    }
    if (writing !== null && transaction.annotation(agentWrite) !== undefined) writing.stash.push(transaction);
    else report(transaction);
  });
  /** @param step - Step. @returns Planners of the step, or null when its command is not installed. */
  const plannersOf = (step: QuireAiSourceStep): MsfeCommand[] | null => {
    if (step.kind === "changes") return [() => ({ changes: step.changes.map(change => ({ ...change })) })];
    if (step.kind === "state") return [() => ({ effects: (step.inverse as MsfeAiStateInverse).effects })];
    const command = planNamedCommand(editor, step.name, [step.params]);
    if (command === undefined) return null;
    const selection = step.selection;
    return selection === undefined ? [command] : [() => ({ selection: EditorSelection.single(selection.from, selection.to) }), command];
  };
  /** @param steps - Steps. @returns Dry run on the current state, with the composed change set. */
  const dryRun = (steps: readonly QuireAiSourceStep[]): { result: QuireAiSourceStepResult; total: ChangeSet } => {
    let draft = editor.state;
    let total = ChangeSet.empty(draft.doc.length);
    const changes: QuireAiSourceChangeSet[] = [];
    for (const [index, step] of steps.entries()) {
      const planners = plannersOf(step);
      if (planners === null) return { result: { ok: false, failedStep: index, reason: "the command is not installed" }, total };
      let own = ChangeSet.empty(draft.doc.length);
      for (const planner of planners) {
        const spec = planner(draft);
        if (spec === null) return { result: { ok: false, failedStep: index }, total };
        const transaction = draft.update(spec);
        own = own.compose(transaction.changes);
        draft = transaction.state;
      }
      total = total.compose(own);
      changes.push(toChangeSet(own));
    }
    return { result: { ok: true, changes, text: draft.doc.toString() }, total };
  };
  return {
    language: "markdown",
    text: () => editor.state.doc.toString(),
    revision: () => `${editor.documentId}:${editor.revision}`,
    isOpen: () => !editor.scope.disposed,
    isEditable: () => !editor.state.readOnly,
    onDestroy(listener) {
      const signal = editor.scope.signal;
      signal.addEventListener("abort", listener, { once: true });
      return () => signal.removeEventListener("abort", listener);
    },
    blocks: () => segmentMsfeSource(editor.state),
    segment(text) {
      const parser = editor.state.facet(language);
      return segmentMsfeSource(EditorState.create({ doc: text, extensions: parser === null ? [] : [parser.extension] }));
    },
    selection() {
      const { from, to } = editor.state.selection.main;
      return { from, to };
    },
    plan: steps => dryRun(steps).result,
    apply(steps, meta) {
      const { result, total } = dryRun(steps);
      if (!result.ok) return result;
      const selection = editor.state.selection;
      const capabilities = (): readonly QuireAiSourceCapability[] => readAiCapabilities(editor) as readonly QuireAiSourceCapability[];
      const before = readMsfeAiAnnotations(capabilities());
      const planners: MsfeCommand[] = [markChangeOrigin("agent"), () => ({ annotations: agentWrite.of(meta) }),
        ...steps.flatMap(step => plannersOf(step)!),
        // AI writes leave the person's selection where it was, mapped through the changes.
        () => ({ selection: selection.map(total) })];
      writing = { stash: [] };
      let stash: Transaction[];
      let outcome;
      try {
        outcome = editor.chain(planners);
      } finally {
        stash = writing.stash;
        writing = null;
      }
      if (!outcome.ok) return { ok: false, failedStep: 0, reason: outcome.reason };
      const described = describeMsfeAiAnnotationChanges(before, readMsfeAiAnnotations(capabilities()));
      stash.forEach((transaction, index) => report(transaction, index === 0 ? described : undefined));
      return result;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    commands: () => readCommandDescriptors(editor) as ReadonlyMap<string, QuireAiSourceCommandDescriptor>,
    capabilities: () => readAiCapabilities(editor) as readonly QuireAiSourceCapability[]
  };
}
