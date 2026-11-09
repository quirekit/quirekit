import { StateField, type ChangeDesc, type EditorState } from "@quirekit/cm-state";
import { EditorView, ViewPlugin } from "@quirekit/cm-view";
import type { CompiledExtensions } from "../../extensions/types";
import type { MsfeEditor } from "../../editor/types";
import type { MsfeComponentHost } from "../../views/types";
import { buildLayer, layerChanged, layerEnabled } from "./cache";
import { layerDecorations } from "./decorations";
import type { LayerCache, LayerOutput } from "./types";
import { sourceRevealSelection } from "../gesture";
import { sourceRevealSetting } from "../visibility";
import { updateLayer } from "./incremental";
import { mapLayerCache, retainLayerIdentities } from "./mapping";
import { getSyntaxChangeWork, inheritSyntaxChangeWork } from "../../source/parsing/changes";
import { compositionField } from "../../state/fields";
import { sourceRevealResolver } from "../activation";
import { editingObjectBoundaries } from "../../input/boundaries/objects";

/** @param compiled - Installed capabilities. @param editor - Lazy canonical API. @param host - Framework context owner.
 * @returns Separate direct block and viewport inline paths with deterministic work diagnostics. */
export function projectionLayers(compiled: CompiledExtensions, editor: () => MsfeEditor, host: MsfeComponentHost | undefined) {
  const blocks = compiled.layers.filter(layer => layer.placement === "block");
  const inline = compiled.layers.filter(layer => layer.placement === "inline");
  // Diagnostics count actual evaluations, including discarded command drafts, without publishing feature state.
  let blockBuilds = 0, layerVisitedNodes = 0;
  /** Records work only; this counter is not a semantic reducer side effect or subscription notification. */
  const visit = (): void => { layerVisitedNodes++; };
  const direct = StateField.define<{ caches: readonly LayerCache[]; output: LayerOutput }>({
    create(state) {
      const caches = blocks.map(layer => updateLayer(layer, undefined, state, undefined, { from: 0, to: state.doc.length }, compiled, undefined, visit, () => { blockBuilds++; }));
      return { caches, output: layerDecorations(blocks.map((layer, i) => ({ layer, cache: caches[i]! })), state, editor, host) };
    },
    update(value, transaction) {
      const state = transaction.state;
      inheritSyntaxChangeWork(transaction.startState, state);
      const caches = blocks.map((layer, i) => {
        if (!layerChanged(layer, transaction.startState, state)) return value.caches[i]!;
        return updateLayer(layer, transaction.startState, state, transaction.changes, { from: 0, to: state.doc.length }, compiled, value.caches[i], visit, () => { blockBuilds++; });
      });
      if (caches.every((cache, i) => cache === value.caches[i])
        && transaction.startState.field(compositionField) === state.field(compositionField)
        && sourceRevealSetting.read(transaction.startState) === sourceRevealSetting.read(state)
        && transaction.startState.facet(sourceRevealResolver) === state.facet(sourceRevealResolver)
        && (sourceRevealSetting.read(state) === "hidden" || sourceRevealSelection(transaction.startState).eq(sourceRevealSelection(state)))) return value;
      return { caches, output: layerDecorations(blocks.map((layer, i) => ({ layer, cache: caches[i]! })), state, editor, host) };
    },
    provide: field => EditorView.decorations.from(field, value => value.output.decorations),
  });
  let inlineBuilds = 0, inlineConflicts = 0;
  const visible = ViewPlugin.define(view => {
    let caches: readonly LayerCache[] = [];
    /** @param before - Prior state when updating. @param viewport - Whether visible source bounds changed. @param changes - Exact source mapping.
     * @returns Current declarations materialized against accepted selection and block ownership. */
    function project(before?: EditorState, viewport = true, changes?: ChangeDesc): LayerOutput {
      caches = inline.map((layer, index) => {
        if (!layerEnabled(layer, view.state)) return caches[index]?.descriptions.length === 0
          ? caches[index]! : { descriptions: [], builds: caches[index]?.builds ?? 0 };
        if (before && !viewport && !layerChanged(layer, before, view.state)) return caches[index]!;
        const descriptions = view.visibleRanges.flatMap(range => buildLayer(layer, view.state, range, compiled, undefined, visit).descriptions);
        inlineBuilds++;
        const previous = caches[index], mapped = previous && changes ? mapLayerCache(previous, changes) : previous;
        const builds = (previous?.builds ?? 0) + 1;
        return layer.incremental ? retainLayerIdentities(descriptions, mapped, builds) : { descriptions, builds };
      });
      const output = layerDecorations(inline.map((layer, i) => ({ layer, cache: caches[i]! })), view.state, editor, host, view.state.field(direct).output.replacements);
      inlineConflicts = output.conflicts; return output;
    }
    // While IME composes, inline output is only mapped: a rebuilt component (such as a heading control
    // labelled with the text being typed) would redraw the composing line, and WebKit then drops the preedit.
    let frozen = false;
    return { output: project(), update(update) {
      if (update.state.field(compositionField) && update.startState.field(compositionField) && !update.viewportMoved) {
        frozen = true;
        if (!update.docChanged) return;
        caches = caches.map(cache => mapLayerCache(cache, update.changes));
        const { decorations, atomic, objects, replacements, conflicts } = this.output;
        this.output = { decorations: decorations.map(update.changes), atomic: atomic.map(update.changes), objects: objects.map(update.changes), conflicts,
          replacements: replacements.map(range => ({ from: update.changes.mapPos(range.from, 1), to: update.changes.mapPos(range.to, -1) })) };
        return;
      }
      this.output = project(frozen ? undefined : update.startState, update.viewportChanged, update.changes); frozen = false;
    } };
  }, { decorations: plugin => plugin.output.decorations,
    provide: plugin => EditorView.atomicRanges.of(view => view.plugin(plugin)?.output.atomic ?? view.state.field(direct).output.atomic),
  });
  return { extensions: [direct, editingObjectBoundaries(state => state.field(direct).output.objects),
    EditorView.atomicRanges.of(view => view.state.field(direct).output.atomic), ...(inline.length ? [visible] : [])],
    /** @param state - Accepted canonical state. @returns Actual evaluation counts, including speculative work, and current conflicts. */
    work(state: EditorState) { const value = state.field(direct), syntax = getSyntaxChangeWork(state); return {
      blockBuilds, layerVisitedNodes, inlineLayerBuilds: inlineBuilds,
      syntaxDiffBuilds: syntax.builds, syntaxDiffChunks: syntax.visitedChunks, syntaxDiffComparisons: syntax.comparedChunks,
      syntaxDiffReuseChecks: syntax.reuseChecks, syntaxDiffReuseMappings: syntax.reuseMappings,
      projectionConflicts: value.output.conflicts + inlineConflicts,
    }; },
  };
}
