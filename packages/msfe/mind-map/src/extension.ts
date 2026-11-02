import { Node, componentView, defineSource } from "@quirekit/msfe-core";
import { msfeMindMapAiCapabilities } from "./ai/facts";
import { createMsfeMindMapAgentCommands } from "./ai/commands";
import { readMindMapSource, patchMindMapSource } from "./source";
import { mindMapPreview } from "./renderer";
import type { MsfeMindMapOptions, MsfeMindMapPreviewProps } from "./types";
import { commitMindMap } from "./commands";
/** Self-contained mindMap fences; source remains the sole document authority. */
export const MsfeMindMap = Node.create<MsfeMindMapOptions>({ name: "mindMap",
  /** @returns Optional product authoring hook. */
  addOptions() { return { open: null }; },
  /** @returns Summary the AI core lists instead of the source data. */
  addAiCapabilities() { return msfeMindMapAiCapabilities; },
  /** @returns Named source mutation authority. */
  addCommands() { return { commitMindMap, ...createMsfeMindMapAgentCommands(() => this.editor) }; },
  /** @returns A single complete portable envelope. */
  addAttributes() { return { mind: {} }; },
  /** @returns Exact native-fence codec, retaining invalid source unchanged. */
  addSource() { return defineSource({ nodes: ["FencedCode"], read: readMindMapSource, patch: patchMindMapSource }); },
  /** @returns Incremental static projections with mapped source ownership. */
  addProjectionLayers() {
    const owner = this;
    const renderer: ReturnType<typeof mindMapPreview> = mount => mindMapPreview(owner.editor, owner.options.open, owner.options.resolve)(mount);
    return [{ key: "mindMap-preview", placement: "block", incremental: true,
      /** @param input - Accepted source query. @returns Static previews for valid semantic matches. */
      build(input) {
      return input.query("mindMap").matches.map(match => ({ type: "replace" as const, from: match.from, to: match.to, key: String(match.from),
        view: componentView(renderer, { mind: match.attrs.mind, range: { from: match.from, to: match.to }, readOnly: input.readOnly || input.mode === "locked" } as MsfeMindMapPreviewProps,
          (props, offset) => ({ ...props, range: { from: props.range.from + offset, to: props.range.to + offset } })) }));
    } }];
  }
});
