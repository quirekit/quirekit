import { Node, componentView, defineSource } from "@quirekit/msfe-core";
import { msfeFlowchartAiCapabilities } from "./ai/facts";
import { createMsfeFlowchartAgentCommands } from "./ai/commands";
import { readFlowchartSource, patchFlowchartSource } from "./source";
import { flowchartPreview } from "./renderer";
import type { MsfeFlowchartOptions, MsfeFlowchartPreviewProps } from "./types";
import { commitFlowchart } from "./commands";
/** Self-contained flowchart fences; source remains the sole document authority. */
export const MsfeFlowchart = Node.create<MsfeFlowchartOptions>({ name: "flowchart",
  /** @returns Optional product authoring hook. */
  addOptions() { return { open: null }; },
  /** @returns Summary the AI core lists instead of the source data. */
  addAiCapabilities() { return msfeFlowchartAiCapabilities; },
  /** @returns Named source mutation authority. */
  addCommands() { return { commitFlowchart, ...createMsfeFlowchartAgentCommands(() => this.editor) }; },
  /** @returns A single complete portable envelope. */
  addAttributes() { return { flow: {} }; },
  /** @returns Exact native-fence codec, retaining invalid source unchanged. */
  addSource() { return defineSource({ nodes: ["FencedCode"], read: readFlowchartSource, patch: patchFlowchartSource }); },
  /** @returns Incremental static projections with mapped source ownership. */
  addProjectionLayers() {
    const owner = this;
    const renderer: ReturnType<typeof flowchartPreview> = mount => flowchartPreview(owner.editor, owner.options.open, owner.options.resolve)(mount);
    return [{ key: "flowchart-preview", placement: "block", incremental: true,
      /** @param input - Accepted source query. @returns Static previews for valid semantic matches. */
      build(input) {
      return input.query("flowchart").matches.map(match => ({ type: "replace" as const, from: match.from, to: match.to, key: String(match.from),
        view: componentView(renderer, { flow: match.attrs.flow, range: { from: match.from, to: match.to }, readOnly: input.readOnly || input.mode === "locked" } as MsfeFlowchartPreviewProps,
          (props, offset) => ({ ...props, range: { from: props.range.from + offset, to: props.range.to + offset } })) }));
    } }];
  }
});
