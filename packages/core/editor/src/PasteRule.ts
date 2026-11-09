import {
  Fragment,
  Plugin,
  PluginKey,
  type EditorState as PMEditorState,
  type Node as PMNode
} from "@quirekit/pm";
import { QuireCommandManager } from "./CommandManager";
import type { QuireEditor } from "./Editor";
import { createChainableState } from "./helpers/createChainableState";
import { getHTMLFromFragment } from "./helpers/getHTMLFromFragment";
import type { ExtendedRegExpMatchArray } from "./InputRule";
import type {
  CanCommands,
  ChainedCommands,
  QuireRange,
  SingleCommands
} from "./types";
import { isRegExp } from "./utilities/isRegExp";

/** Match object returned by function-based paste rule finders. */
export interface PasteRuleMatch {
  /** Start index of the matched text inside the pasted text. */
  readonly index: number;
  /** Full text matched by the finder. */
  readonly text: string;
  /** Optional replacement text that should appear as the second capture. */
  readonly replaceWith?: string;
  /** Optional native regexp match associated with this match. */
  readonly match?: RegExpMatchArray;
  /** Optional extension-owned metadata carried to the handler. */
  readonly data?: Readonly<Record<string, unknown>>;
}

/** Paste rule finder compatible with Tiptap regexp and function finders. */
export type PasteRuleFinder =
  | RegExp
  | ((
      text: string,
      event?: ClipboardEvent | null
    ) => readonly PasteRuleMatch[] | null | undefined);

/** Props passed to a paste rule handler. */
export interface PasteRuleHandlerProps {
  /** ProseMirror editor state used for the rule execution. */
  readonly state: PMEditorState;
  /** Document range covered by the matched pasted content. */
  readonly range: QuireRange;
  /** Match produced by the paste rule finder. */
  readonly match: ExtendedRegExpMatchArray;
  /** Single command helpers available to the rule. */
  readonly commands: SingleCommands;
  /** Creates a chainable command runner. */
  readonly chain: () => ChainedCommands;
  /** Creates command availability helpers. */
  readonly can: () => CanCommands;
  /** Clipboard event that triggered the paste rule, when available. */
  readonly pasteEvent: ClipboardEvent | null;
  /** Drag event that triggered the paste rule, when available. */
  readonly dropEvent: DragEvent | null;
}

/** Configuration object accepted by {@link PasteRule}. */
export interface PasteRuleConfig {
  /** Finder used to detect pasted text that should trigger the rule. */
  readonly find: PasteRuleFinder;
  /**
   * Handler called when the paste rule matches.
   *
   * @param props - Rule execution context.
   * @returns `null` to cancel the rule, otherwise void.
   */
  readonly handler: (props: PasteRuleHandlerProps) => void | null;
}

/** Tiptap-compatible paste rule definition. */
export class PasteRule {
  /** Finder used to detect pasted text that should trigger the rule. */
  readonly find: PasteRuleFinder;

  /** Handler called when the paste rule matches. */
  readonly handler: PasteRuleConfig["handler"];

  /**
   * Creates a paste rule.
   *
   * @param config - Finder and handler for the rule.
   */
  constructor(config: PasteRuleConfig) {
    this.find = config.find;
    this.handler = config.handler;
  }
}

/**
 * Creates a ProseMirror plugin that runs QuireKit paste rules.
 *
 * @param options - Editor and paste rules to bind.
 * @returns ProseMirror plugins that append paste-rule transforms.
 */
export function pasteRulesPlugin(options: {
  /** Editor that owns the paste rule command surface. */
  readonly editor: QuireEditor;
  /** Paste rules collected from installed extensions. */
  readonly rules: readonly PasteRule[];
}): Plugin[] {
  const { editor, rules } = options;

  if (rules.length === 0) {
    return [];
  }

  return [
    new Plugin({
      key: new PluginKey("pasteRules"),
      appendTransaction(transactions, oldState, state) {
        const trigger = getPasteRuleTrigger(transactions, oldState, state);

        if (!trigger) {
          return undefined;
        }

        const transaction = state.tr;
        const chainableState = createChainableState({ state, transaction });
        let handled = false;

        for (const rule of rules) {
          handled = runPasteRule({
            editor,
            state: chainableState,
            from: trigger.from,
            to: trigger.to,
            text: trigger.text,
            rule,
            pasteEvent: trigger.pasteEvent,
            dropEvent: trigger.dropEvent
          }) || handled;
        }

        return handled && transaction.steps.length > 0 ? transaction : undefined;
      }
    })
  ];
}

/**
 * Runs one paste rule against a pasted text range.
 *
 * @param options - Paste rule execution options.
 * @returns Whether the rule accepted all of its matches.
 */
function runPasteRule(options: {
  /** Editor that owns commands exposed to rule handlers. */
  readonly editor: QuireEditor;
  /** Chainable editor state backed by the appended transaction. */
  readonly state: PMEditorState;
  /** Start position of the changed document range. */
  readonly from: number;
  /** End position of the changed document range. */
  readonly to: number;
  /** Plain text representation of the changed range. */
  readonly text: string;
  /** Paste rule to execute. */
  readonly rule: PasteRule;
  /** Clipboard event associated with the paste, when available. */
  readonly pasteEvent: ClipboardEvent | null;
  /** Drag event associated with the drop, when available. */
  readonly dropEvent: DragEvent | null;
}): boolean {
  const { editor, state, from, to, text, rule, pasteEvent, dropEvent } = options;
  const matches = pasteRuleMatcherHandler(text, rule.find, pasteEvent);

  if (matches.length === 0) {
    return false;
  }

  const commandManager = new QuireCommandManager({ editor, state });
  let accepted = true;
  let handled = false;

  for (const match of matches) {
    if (typeof match.index !== "number") {
      continue;
    }

    const mappedFrom = state.tr.mapping.map(from + match.index);
    const mappedTo = state.tr.mapping.map(from + match.index + match[0].length);
    const result = rule.handler({
      state,
      range: { from: mappedFrom, to: mappedTo },
      match,
      commands: commandManager.commands,
      chain: commandManager.chain,
      can: commandManager.can,
      pasteEvent,
      dropEvent
    });

    handled = true;
    accepted = accepted && result !== null;
  }

  return handled && accepted;
}

/**
 * Resolves whether a transaction set should run paste rules.
 *
 * @param transactions - Transactions applied by ProseMirror.
 * @param oldState - State before the transactions.
 * @param state - State after the transactions.
 * @returns Paste trigger data or undefined when rules should not run.
 */
function getPasteRuleTrigger(
  transactions: readonly { getMeta(key: string): unknown }[],
  oldState: PMEditorState,
  state: PMEditorState
):
  | {
      /** Start position of the changed range. */
      readonly from: number;
      /** End position of the changed range. */
      readonly to: number;
      /** Text inserted or changed by the paste. */
      readonly text: string;
      /** Clipboard event associated with the paste, when available. */
      readonly pasteEvent: ClipboardEvent | null;
      /** Drag event associated with the drop, when available. */
      readonly dropEvent: DragEvent | null;
    }
  | undefined {
  const firstTransaction = transactions[0];
  const simulatedPaste = firstTransaction?.getMeta("applyPasteRules") as
    | { readonly from: number; readonly text: string | PMNode | Fragment }
    | undefined;

  if (simulatedPaste) {
    const text = serializePasteRuleContent(simulatedPaste.text, state);

    return {
      from: simulatedPaste.from,
      to: simulatedPaste.from + text.length,
      text,
      pasteEvent: createSyntheticClipboardEvent(text),
      dropEvent: null
    };
  }

  const isPaste = transactions.some((transaction) => transaction.getMeta("uiEvent") === "paste");
  const isDrop = transactions.some((transaction) => transaction.getMeta("uiEvent") === "drop");

  if (!isPaste && !isDrop) {
    return undefined;
  }

  const from = oldState.doc.content.findDiffStart(state.doc.content);
  const to = oldState.doc.content.findDiffEnd(state.doc.content);

  if (typeof from !== "number" || !to || from === to.b) {
    return undefined;
  }

  return {
    from,
    to: to.b,
    text: state.doc.textBetween(from, to.b, undefined, "\ufffc"),
    pasteEvent: null,
    dropEvent: null
  };
}

/**
 * Matches pasted text using a Tiptap-compatible paste rule finder.
 *
 * @param text - Pasted text to scan.
 * @param find - RegExp or function finder.
 * @param event - Clipboard event associated with the paste.
 * @returns RegExp-like matches.
 */
function pasteRuleMatcherHandler(
  text: string,
  find: PasteRuleFinder,
  event: ClipboardEvent | null
): ExtendedRegExpMatchArray[] {
  if (isRegExp(find)) {
    return [...text.matchAll(find)] as ExtendedRegExpMatchArray[];
  }

  const matches = find(text, event) ?? [];

  return matches.map((pasteRuleMatch) => {
    const result = [pasteRuleMatch.text] as ExtendedRegExpMatchArray;
    result.index = pasteRuleMatch.index;
    result.input = text;

    if (pasteRuleMatch.data) {
      Object.defineProperty(result, "data", { value: pasteRuleMatch.data });
    }

    if (pasteRuleMatch.replaceWith) {
      if (!pasteRuleMatch.text.includes(pasteRuleMatch.replaceWith)) {
        console.warn(
          '[quirekit warn]: "pasteRuleMatch.replaceWith" must be part of "pasteRuleMatch.text".'
        );
      }

      result.push(pasteRuleMatch.replaceWith);
    }

    return result;
  });
}

/**
 * Serializes simulated paste content to text used by paste-rule matching.
 *
 * @param content - Simulated paste content.
 * @param state - State whose schema should serialize nodes.
 * @returns Text or HTML-like text for matching.
 */
function serializePasteRuleContent(
  content: string | PMNode | Fragment,
  state: PMEditorState
): string {
  return typeof content === "string"
    ? content
    : getHTMLFromFragment(Fragment.from(content), state.schema);
}

/**
 * Creates a best-effort clipboard event for simulated paste rules.
 *
 * @param text - Text represented by the event.
 * @returns Clipboard event when the runtime can create one.
 */
function createSyntheticClipboardEvent(text: string): ClipboardEvent | null {
  if (typeof ClipboardEvent === "undefined") {
    return null;
  }

  try {
    const event = new ClipboardEvent("paste");
    event.clipboardData?.setData("text/plain", text);

    return event;
  } catch {
    return null;
  }
}
