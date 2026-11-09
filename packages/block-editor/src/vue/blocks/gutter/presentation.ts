import type { Editor } from "@quirekit/core";
import type { Node } from "@quirekit/pm";
import type { QuireBlockTone } from "@quirekit/ui/vue";
import { blockInsertItems } from "../../../ui/insert/catalog";
import { readBlockListFeature } from "../../../lists/feature";

/** Block ids by color family, matching the Markdown editor's block families. */
const families: readonly [QuireBlockTone, RegExp][] = [
  ["blue", /^(?:paragraph|heading:[1-6]|blockquote|definitionList|footnoteReference|displayMath|webCard|embed)$/u],
  ["indigo", /^(?:bulletList|orderedList|taskList)$/u],
  ["green", /^codeBlock$/u],
  ["orange", /^(?:container:.+|horizontalRule|image|imageGallery|attachment|audio|video)$/u],
  ["teal", /^(?:table|dataView)$/u],
  ["purple", /^(?:textDiagram|flowchart|mindMap|whiteboard)$/u]
];

/** @param id - Block catalog id. @returns Its family's tone; unknown blocks stay neutral. */
function blockTone(id: string): QuireBlockTone {
  return families.find(([, pattern]) => pattern.test(id))?.[0] ?? "neutral";
}

/** @param editor - Installed content capabilities. @returns A presenter sharing the insertion directory's names and icons, built once per rail. */
export function createBlockRailPresenter(editor: Editor) {
  const items = blockInsertItems(editor), byId = new Map(items.map(item => [item.id, item]));
  /** @param node - Current canonical block. @returns Type identity, accessible description and empty-line affordance. */
  return function present(node: Node) {
    const list = readBlockListFeature(editor)?.kind(node, editor.state.doc);
    const type = node.type.name;
    const id = list ? `${list}List` : type === "heading" ? `heading:${node.attrs.level}`
      : type === "blockContainer" ? `container:${node.attrs.kind === "highlight" || node.attrs.kind === "details" ? node.attrs.kind : "note"}`
      : type === "footnoteDefinition" ? "footnoteReference" : type;
    const item = byId.get(id) ?? items.find(item => item.node === type);
    const resolved = item?.id ?? id;
    return { id: resolved, icon: item?.icon ?? "paragraph", label: item?.label ?? "内容块", tone: blockTone(resolved),
      badge: resolved.startsWith("heading:") ? `H${resolved.slice(8)}` : undefined,
      empty: type === "paragraph" && !list && node.content.size === 0 };
  };
}
