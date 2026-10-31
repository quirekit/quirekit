import { collectQuireExtensionContributions, type QuireAnyExtension } from "@quirekit/core";
import type { Node } from "@quirekit/pm";
import type {
  QuireAiRemovalCapability,
  QuireAiActionCapability, QuireAiBlockCapability, QuireAiBlockLabelCapability, QuireAiCapability, QuireAiDocumentSettingCapability, QuireAiFormatCapability, QuireAiFormatTarget,
  QuireAiNoteCapability, QuireAiStoryLabelCapability, QuireAiStructureCapability
} from "@quirekit/ai-contract";
import type { QuireAiRegistry } from "./types";

/** Operation names of the core editing tool that actions cannot take. */
const RESERVED_OPERATIONS = new Set(["replace", "append", "replace_text", "replace_all", "insert", "move", "delete", "format"]);

/**
 * Compiles the facts contributed by installed extensions.
 *
 * @param extensions - Resolved extension set.
 * @param commandActions - Edit operations of the editor commands declared with a description.
 * @returns Registry keyed for view rendering.
 * Several extensions may read the same format from different storage, such as a
 * semantic mark and a style attribute; the first reader returning a value wins.
 *
 * @throws TypeError when two extensions claim the same node role or block, or
 * declare one format name at different levels.
 */
export function compileQuireAiRegistry(
  extensions: readonly QuireAnyExtension[], commandActions: readonly QuireAiActionCapability[] = []
): QuireAiRegistry {
  const structures = new Map<string, QuireAiStructureCapability>();
  const blocks = new Map<string, QuireAiBlockCapability>();
  const formats = new Map<string, QuireAiFormatCapability[]>();
  const actions = new Map<string, QuireAiActionCapability>();
  const storyLabels = new Map<string, QuireAiStoryLabelCapability[]>();
  const blockLabels = new Map<string, QuireAiBlockLabelCapability[]>();
  const settings: QuireAiDocumentSettingCapability[] = [];
  const removals: QuireAiRemovalCapability[] = [];
  const notes = new Map<string, QuireAiNoteCapability[]>();
  const owners = new Map<string, string>();
  const claim = (key: string, owner: string) => {
    const previous = owners.get(key);
    if (previous !== undefined) throw new TypeError(`AI capability "${key}" is declared by both "${previous}" and "${owner}".`);
    owners.set(key, owner);
  };
  for (const { extensionName, contribution } of collectQuireExtensionContributions<QuireAiCapability>(extensions, "addAiCapabilities")) {
    if (contribution.kind === "structure") {
      claim(`structure:${contribution.node}`, extensionName);
      structures.set(contribution.node, contribution);
    } else if (contribution.kind === "block") {
      claim(`block:${contribution.node}`, extensionName);
      blocks.set(contribution.node, contribution);
    } else if (contribution.kind === "document-setting") {
      claim(`setting:${contribution.name}`, extensionName);
      settings.push(contribution);
    } else if (contribution.kind === "story-label") {
      storyLabels.set(contribution.node, [...storyLabels.get(contribution.node) ?? [], contribution]);
    } else if (contribution.kind === "removal") {
      removals.push(contribution);
    } else if (contribution.kind === "note") {
      notes.set(contribution.node, [...notes.get(contribution.node) ?? [], contribution]);
    } else if (contribution.kind === "block-label") {
      blockLabels.set(contribution.node, [...blockLabels.get(contribution.node) ?? [], contribution]);
    } else {
      formats.set(contribution.name, [...formats.get(contribution.name) ?? [], contribution]);
    }
  }
  // Described editor commands are the edit operations beyond the core ones; core operation names stay reserved.
  for (const action of commandActions) {
    if (!RESERVED_OPERATIONS.has(action.name)) actions.set(action.name, action);
  }
  const all = [...formats.values()].map(combineFormatDeclarations);
  return Object.freeze({
    structures: labelStories(structures, storyLabels),
    blocks: labelBlocks(blocks, blockLabels),
    notes,
    characterFormats: Object.freeze(all.filter(format => format.level === "character")),
    paragraphFormats: Object.freeze(all.filter(format => format.level === "paragraph")),
    actions,
    settings: Object.freeze([...settings].sort((left, right) => (left.order ?? 100) - (right.order ?? 100))),
    removals: Object.freeze(removals)
  });
}

/**
 * Combines every declaration of one format name.
 *
 * Reading tries each declaration in order; applying belongs to the declaration
 * with the highest `applyPriority`, which also supplies the value schema.
 *
 * @param declarations - Declarations of one name in extension order.
 * @returns Single format capability.
 * @throws TypeError when levels differ or two appliers share the top priority.
 */
function combineFormatDeclarations(declarations: readonly QuireAiFormatCapability[]): QuireAiFormatCapability {
  const first = declarations[0]!;
  const mismatch = declarations.find(declaration => declaration.level !== first.level);
  if (mismatch !== undefined) {
    throw new TypeError(`AI format "${first.name}" is declared at both ${first.level} and ${mismatch.level} level.`);
  }
  const appliers = declarations.filter(declaration => declaration.apply !== undefined)
    .sort((left, right) => (right.applyPriority ?? 0) - (left.applyPriority ?? 0));
  if (appliers.length > 1 && (appliers[0]!.applyPriority ?? 0) === (appliers[1]!.applyPriority ?? 0)) {
    throw new TypeError(`AI format "${first.name}" has several appliers with the same priority.`);
  }
  const owner = appliers[0] ?? first;
  const present = owner.present ?? declarations.find(declaration => declaration.present !== undefined)?.present;
  return Object.freeze({
    ...owner,
    ...(present === undefined ? {} : { present }),
    read: (target: QuireAiFormatTarget) => {
      for (const declaration of declarations) {
        const value = declaration.read(target);
        if (value !== undefined) return value;
      }
      return undefined;
    }
  });
}

/**
 * Puts feature labels, items and presentations in front of each block fact's own.
 * @param blocks - Block facts keyed by node name.
 * @param blockLabels - Block-label facts keyed by node name.
 * @returns Block facts whose labels, items and presentations consult the block-label facts first.
 */
function labelBlocks(
  blocks: Map<string, QuireAiBlockCapability>,
  blockLabels: ReadonlyMap<string, readonly QuireAiBlockLabelCapability[]>
): Map<string, QuireAiBlockCapability> {
  for (const [node, labels] of blockLabels) {
    const block = blocks.get(node);
    if (block === undefined) continue;
    const owners = labels.filter(label => label.items !== undefined);
    // Nodes no feature owns keep the block fact's items, or none.
    const items = owners.length === 0 ? block.items : (target: Node) => {
      for (const owner of owners) {
        const owned = owner.items!(target);
        if (owned !== undefined) return owned;
      }
      return block.items?.(target) ?? [];
    };
    const presenters = labels.filter(label => label.present !== undefined);
    const present = presenters.length === 0 ? block.present : (target: Node) => {
      for (const presenter of presenters) {
        const presented = presenter.present!(target);
        if (presented !== undefined) return presented;
      }
      return block.present?.(target);
    };
    blocks.set(node, Object.freeze({
      ...block,
      label: (target: Node, doc?: Node) => {
        for (const label of labels) {
          const title = label.label(target, doc);
          if (title !== undefined) return title;
        }
        return block.label?.(target, doc) ?? target.type.name;
      },
      ...(items === undefined ? {} : { items }),
      ...(present === undefined ? {} : { present })
    }));
  }
  return blocks;
}

/**
 * Puts feature story titles in front of each story structure's own title; a feature that hides
 * a story hides it whatever the others title it.
 * @param structures - Structure facts keyed by node name.
 * @param storyLabels - Story-label facts keyed by node name.
 * @returns Structures whose story titles consult the story-label facts first.
 */
function labelStories(
  structures: Map<string, QuireAiStructureCapability>,
  storyLabels: ReadonlyMap<string, readonly QuireAiStoryLabelCapability[]>
): Map<string, QuireAiStructureCapability> {
  for (const [node, labels] of storyLabels) {
    const structure = structures.get(node);
    if (structure === undefined || structure.role !== "story") continue;
    structures.set(node, Object.freeze({
      ...structure,
      label: (story: Node, doc: Node) => {
        // Hiding wins over any title: the story belongs to an object another feature shows elsewhere.
        const titles = labels.map(label => label.label(story, doc));
        if (titles.includes(null)) return null;
        const title = titles.find(entry => entry !== undefined);
        if (title !== undefined) return title;
        return structure.label === undefined ? story.type.name : structure.label(story, doc);
      }
    }));
  }
  return structures;
}
