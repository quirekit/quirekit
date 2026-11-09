import { getChangedRanges, readQuireTransactionOrigin } from "@quirekit/core";
import { Plugin, PluginKey, Mapping } from "@quirekit/pm";
import { v4 as uuid } from "uuid";
import { readNotes } from "./query";

/** Key of the plugin below; collaboration declares it a client-side plugin. */
const blockNoteIdentityKey = new PluginKey("blockNoteIdentity");

/** @returns Remaps duplicated definitions and their copied references in the same insertion, preserving original associations. */
export function noteIdentityPlugin(): Plugin {
  return new Plugin({
    key: blockNoteIdentityKey,
    /** @param transactions - Accepted changes since the last plugin pass. @param oldState - Original identities. @param state - Current source. @returns Identity repair joined to the originating history event, or null. */
    appendTransaction(transactions, oldState, state) {
      if (!transactions.some(tr => tr.docChanged) || transactions.some(tr => readQuireTransactionOrigin(tr) === "collaboration")) return null;
      const mapping = new Mapping(); transactions.forEach(tr => mapping.appendMapping(tr.mapping));
      // Existing definitions retain their identity even when a copy is inserted before them.
      const retained = new Set(readNotes(oldState.doc).flatMap(note => note.definitions.map(def => mapping.mapResult(def.from, 1)).filter(result => !result.deleted).map(result => result.pos)));
      const inserted = transactions.flatMap((tr, index) => {
        const tail = new Mapping(); transactions.slice(index + 1).forEach(next => tail.appendMapping(next.mapping));
        return getChangedRanges(tr).map(({ newRange }) => ({ from: tail.map(newRange.from, -1), to: tail.map(newRange.to, 1) }));
      });
      const tr = state.tr;
      for (const note of readNotes(state.doc)) {
        if (note.definitions.length < 2 || readNotes(oldState.doc).find(old => old.id === note.id)?.definitions.length !== 1) continue;
        const original = note.definitions.find(def => retained.has(def.from)) ?? note.definitions[0]!;
        for (const definition of note.definitions) {
          if (definition === original) continue;
          const region = inserted.find(range => range.from <= definition.from && range.to >= definition.to);
          if (!region) continue; // Imported conflicts remain visible instead of guessing ownership.
          const id = uuid(); tr.setNodeMarkup(definition.from, undefined, { ...definition.node.attrs, noteId: id });
          for (const reference of note.references) if (reference.from >= region.from && reference.to <= region.to)
            tr.setNodeMarkup(reference.from, undefined, { ...reference.node.attrs, noteId: id });
        }
      }
      return tr.docChanged ? tr : null;
    }
  });
}
