import { componentView, withSourceOperation, type ComponentViewRenderer, type MsfeEditor, type ProjectionInput, type ProjectionLayer, type SourceQuery } from "@quirekit/msfe-core";
import { highlightContainerName, parseHighlightAttributes } from "../../highlight/attributes";
import { updateMdHighlight } from "../../highlight/commands";
import type { MdHighlightIconProps } from "../../highlight/types";

/** @param mount - Generic component boundary. @returns A static icon for hosts without a framework renderer. */
export const nativeHighlightIcon: ComponentViewRenderer<MdHighlightIconProps> = mount => {
  const icon = mount.dom.ownerDocument.createElement("span");
  icon.setAttribute("role", "img");
  /** @param props - Latest icon and accessible name. */
  function update(props: MdHighlightIconProps): void { icon.textContent = props.emoji; icon.setAttribute("aria-label", props.label); }
  mount.dom.append(icon); update(mount.props);
  return { update, destroy: () => icon.remove() };
};

/**
 * @param layer - The container controls layer, which already queries every visible container.
 * @param renderer - Host icon control.
 * @param label - Localized accessible name for the icon action.
 * @param editor - Late canonical owner used by the change callback.
 * @returns The same layer also replacing each visible highlight's opening line with its icon, sharing one container query.
 */
export function withHighlightIcons(layer: ProjectionLayer, renderer: ComponentViewRenderer<MdHighlightIconProps>, label: (emoji: string) => string, editor: () => MsfeEditor): ProjectionLayer {
  return { ...layer,
    /** @param input - Visible source and retained disclosure state. @returns Disclosure controls plus highlight icons. */
    build(input) {
      let containers: SourceQuery | undefined;
      const shared: ProjectionInput = Object.assign(Object.create(input) as ProjectionInput, {
        query: (name: string) => name === "customContainer" ? containers ??= input.query(name) : input.query(name) });
      const icons = shared.query("customContainer").matches.flatMap(match => {
        if (match.attrs.name !== highlightContainerName || match.from < input.from || match.from > input.to) return [];
        const { emoji } = parseHighlightAttributes(String(match.attrs.title ?? "")), from = match.from;
        // Like the other container fences, the opening source is revealed while the selection is anywhere in the container.
        return [{ type: "replace" as const, key: `highlight-${from}`, from, to: input.document.lineAt(from).to, block: false, revealRange: { from, to: match.to },
          view: componentView(renderer, { from, emoji, label: label(emoji), editable: !input.readOnly,
            change: (next: string) => editor().run(withSourceOperation(updateMdHighlight(from, { emoji: next }), { kind: "md.highlight.emoji", facts: { emoji: next } })).ok }) }];
      });
      return [...layer.build(shared), ...icons];
    },
  };
}
