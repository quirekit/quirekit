import type { Node } from "@quirekit/pm";
import type { QuireAiBlockChild } from "@quirekit/ai-contract";
import type { QuireAiRegistry } from "../types";
import type { QuireAiViewBlock, QuireAiViewSection } from "./types";

/**
 * Splits the document into the body and story sections declared by structure facts.
 *
 * A document without structure facts is one body section rooted at the document.
 *
 * @param doc - Current document.
 * @param registry - Compiled facts.
 * @returns Sections in document order, body sections first.
 */
export function collectQuireAiSections(doc: Node, registry: QuireAiRegistry): readonly QuireAiViewSection[] {
  const body: QuireAiViewSection[] = [];
  const stories: QuireAiViewSection[] = [];
  /**
   * Adds the sections found among one container's children.
   * @param parent - Document or store node.
   * @param start - Content start of the parent.
   */
  const visit = (parent: Node, start: number): void => {
    parent.forEach((node, offset) => {
      const structure = registry.structures.get(node.type.name);
      const pos = start + offset;
      if (structure?.role === "body") body.push({ title: "正文", story: false, container: node, contentStart: pos + 1 });
      else if (structure?.role === "story") {
        const title = structure.label === undefined ? node.type.name : structure.label(node, doc);
        if (title !== null) stories.push({ title, story: true, container: node, contentStart: pos + 1 });
      } else if (structure?.role === "store") visit(node, pos + 1);
    });
  };
  visit(doc, 0);
  if (body.length === 0 && stories.length === 0) return [{ title: "正文", story: false, container: doc, contentStart: 0 }];
  // Several body sections are numbered, matching the per-section page setting lines.
  const numbered = body.length > 1 ? body.map((section, index) => ({ ...section, title: `正文（第 ${index + 1} 节）` })) : body;
  return [...numbered, ...stories];
}

/**
 * Lists the blocks of one section in document order.
 *
 * Text blocks and leaf blocks are listed; containers with a block fact are listed
 * with their children beneath them; other containers are flattened.
 *
 * @param section - Section to list.
 * @param registry - Compiled facts.
 * @returns Blocks with positions and nesting.
 */
export function collectQuireAiBlocks(section: QuireAiViewSection, registry: QuireAiRegistry): readonly QuireAiViewBlock[] {
  const blocks: QuireAiViewBlock[] = [];
  /**
   * Lists the blocks among one container's children.
   * @param parent - Container node.
   * @param start - Content start of the container.
   * @param depth - Nesting depth below the section.
   * @param caption - Caption for the first block listed, if any.
   */
  const visit = (parent: Node, start: number, depth: number, caption?: string): void => {
    let pending = caption;
    parent.forEach((node, offset) => {
      if (!node.isBlock) return;
      const pos = start + offset;
      const fact = registry.blocks.get(node.type.name);
      if (node.isTextblock || node.isLeaf || fact !== undefined) {
        blocks.push({ section, node, pos, depth, ...(pending === undefined ? {} : { caption: pending }) });
        pending = undefined;
        for (const child of fact?.children?.(node) ?? []) {
          visit(child.node, pos + 1 + child.offset + 1, depth + 1, captionOf(child, node, registry));
        }
        if (fact?.contains === true) visit(node, pos + 1, depth + 1);
      } else {
        visit(node, pos + 1, depth, pending);
        pending = undefined;
      }
    });
  };
  visit(section.container, section.contentStart, 0);
  return blocks;
}

/**
 * Joins a child's caption with the notes of the nodes that mark it: an owner's note only on its
 * first child, so a row's note stands once beside its first cell.
 * @param child - Listed child.
 * @param container - Block whose children are listed.
 * @param registry - Compiled facts.
 * @returns Caption with notes.
 */
function captionOf(child: QuireAiBlockChild, container: Node, registry: QuireAiRegistry): string {
  const notes: string[] = [];
  const read = (node: Node) => {
    for (const fact of registry.notes.get(node.type.name) ?? []) {
      const note = fact.note(node, container);
      if (note !== undefined && note !== "") notes.push(note);
    }
  };
  for (const owner of child.owners ?? []) if (owner.firstChild === child.node) read(owner);
  read(child.node);
  return notes.length === 0 ? child.caption : `${child.caption} ${notes.join(" ")}`;
}
