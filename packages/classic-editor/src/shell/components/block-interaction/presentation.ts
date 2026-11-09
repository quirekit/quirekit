import { computed, type ComputedRef, type Ref } from "vue";
import type { Node as PMNode } from "@quirekit/pm";
import { quireBlockHandleWidth } from "@quirekit/ui/vue";
import type { ClassicEditorBlockPresentation } from "@classic/types";
import type { ClassicEditorShellModel } from "../../types";
import { useClassicEditorShellContributions } from "../../composables/use/shell-contributions";

/** Gap between the handle and the block's text edge. */
export const railInset = 8;
/** Height of the rail row, matching its stylesheet. */
export const railHeight = 26;
/** Space the handle occupies left of the block, including its inset. */
export const railWidth = quireBlockHandleWidth + railInset;
/** Extra space taken by the insert button on an empty paragraph. */
export const railInsertWidth = 26;

/** Marks of blocks whose node type alone identifies them. */
const nodePresentations: Readonly<Record<string, ClassicEditorBlockPresentation>> = {
  bulletList: { icon: "listBullet", tone: "indigo" }, orderedList: { icon: "listNumbered", tone: "indigo" },
  blockquote: { icon: "textQuote", tone: "blue" }, codeBlock: { icon: "codeXml", tone: "green" },
  horizontalRule: { icon: "horizontalRule", tone: "orange" }
};

/** @param node - Hovered block. @returns Mark readable from the node type alone. */
function resolveNodePresentation(node: PMNode): ClassicEditorBlockPresentation {
  if (node.type.name === "heading") return { badge: `H${String(node.attrs.level)}`, tone: "blue" };
  if (node.type.spec.tableRole === "table") return { icon: "table", tone: "teal" };
  return nodePresentations[node.type.name] ?? (node.isTextblock ? { icon: "type", tone: "blue" } : { icon: "layers", tone: "neutral" });
}

/**
 * Keyed on the block node, so pointer samples within one block do not re-read registries.
 * @param model - Live shell context.
 * @param node - Hovered block.
 * @returns Handle mark and the empty-paragraph insert affordance.
 */
export function useBlockPresentation(
  model: Ref<ClassicEditorShellModel>,
  node: Readonly<Ref<PMNode | undefined>>
): ComputedRef<(ClassicEditorBlockPresentation & { readonly empty: boolean }) | null> {
  const { select } = useClassicEditorShellContributions(model);
  return computed(() => {
    const context = model.value.context, current = node.value;
    if (!context || !current) return null;
    let mark: ClassicEditorBlockPresentation | null = null;
    for (const owner of select("block-presentation")) if ((mark = owner.resolve(current, context))) break;
    return { ...(mark ?? resolveNodePresentation(current)), empty: current.type.name === "paragraph" && current.content.size === 0 };
  });
}
