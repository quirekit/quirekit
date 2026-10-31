import type { QuireAiLayoutPage } from "@quirekit/ai-contract";
import type { Node } from "@quirekit/pm";
import type { QuireAiBlockIdentity, QuireAiRegistry } from "../types";
import { searchQuireAiText } from "../edit/search";
import { collectQuireAiBlocks, collectQuireAiSections } from "./collect";
import { formatQuireAiProperties, readQuireAiFormats, renderQuireAiInline } from "./inline";
import { readQuireAiBlockItems } from "./items/read";
import { mentionsQuireAiObjectText } from "./object-search";
import { quireAiSettingsTitle, renderQuireAiSettings } from "./settings";
import type { QuireAiDocumentView, QuireAiListedBlock, QuireAiViewBlock, QuireAiViewOptions } from "./types";

/** Upper bound of view text returned in one read. */
const maximumViewLength = 24_000;

/**
 * Renders the structured document view.
 *
 * Identities are assigned over the whole document on every read so they stay
 * stable regardless of paging; only the requested window is rendered.
 *
 * @param doc - Current document.
 * @param registry - Compiled facts.
 * @param identity - Block identity table.
 * @param options - Paging and scope.
 * @returns View text and paging facts.
 */
export function renderQuireAiDocumentView(
  doc: Node,
  registry: QuireAiRegistry,
  identity: QuireAiBlockIdentity,
  options: QuireAiViewOptions
): QuireAiDocumentView {
  const all = collectQuireAiSections(doc, registry).flatMap(section => collectQuireAiBlocks(section, registry));
  const ids = identity.assign(all.map(block => ({ pos: block.pos, type: block.node.type.name, size: block.node.nodeSize })));
  // A search keeps the text blocks holding the text, counted as replace_all would count them, and the
  // blocks whose objects mention it, such as a diagram stored as a picture, which count no occurrence.
  const found = options.find === undefined ? undefined : new Map(searchQuireAiText(doc, registry, options.find).map(match => [match.block.pos, match.ranges.length]));
  const mentioned = found === undefined ? undefined
    : new Set(all.filter(block => !found.has(block.pos) && mentionsQuireAiObjectText(block, doc, registry, options.find!)).map(block => block.pos));
  const scoped = all.map((block, index) => ({ block, id: ids[index]! }))
    .filter(({ block }) => (options.stories || !block.section.story) && (found === undefined || found.has(block.pos) || mentioned!.has(block.pos)));
  const occurrences = found === undefined ? undefined : scoped.reduce((sum, { block }) => sum + (found.get(block.pos) ?? 0), 0);
  const inObjects = mentioned === undefined ? undefined : scoped.filter(({ block }) => mentioned.has(block.pos)).length;
  const start = options.from !== undefined ? scoped.findIndex(({ id }) => id === options.from)
    : options.around === undefined ? 0 : aroundIndex(scoped.map(({ block }) => block), options.around);
  if (start < 0) throw new RangeError(`Block ${options.from} does not exist; read the document again for current block ids.`);

  // Document settings open a full read from the start; they carry no block ids and do not count as blocks.
  const lines: string[] = start === 0 && options.from === undefined && found === undefined
    ? withPageCount(renderQuireAiSettings(doc, registry), options.pages) : [];
  const pages = options.pages ?? [];
  // The page a listing starts on needs no line of its own; each later page opens before its first block.
  let page = pages.length === 0 || scoped[start] === undefined ? 0 : pageIndexOf(pages, scoped[start]!.block.pos);
  let length = lines.join("\n").length;
  let listed = 0;
  let section: unknown;
  const listedBlocks: QuireAiListedBlock[] = [];
  for (const { block, id } of scoped.slice(start)) {
    const heading = block.section === section ? [] : [`## ${block.section.title}`];
    const opened = pages.length === 0 || block.section.story ? page : pageIndexOf(pages, block.pos);
    const breaks = opened > page ? [renderPageBreak(pages, opened)] : [];
    const line = renderBlockLine(doc, block, id, registry);
    const size = [...heading, ...breaks, line].join("\n").length + 1;
    if (listed >= options.limit || (listed > 0 && length + size > maximumViewLength)) {
      return { text: lines.join("\n"), listed, total: scoped.length, next: id, occurrences, inObjects, blocks: listedBlocks };
    }
    section = block.section;
    page = opened;
    lines.push(...heading, ...breaks, line);
    listedBlocks.push({ id, pos: block.pos, size: block.node.nodeSize });
    length += size;
    listed += 1;
  }
  return { text: lines.join("\n"), listed, total: scoped.length, occurrences, inObjects, blocks: listedBlocks };
}

/** Page body share below which a page break notes how little of the page before was used. */
const underusedPage = 0.85;

/**
 * @param pages - Laid-out pages.
 * @param pos - Position before a block.
 * @returns Index of the page the block starts on.
 */
function pageIndexOf(pages: readonly QuireAiLayoutPage[], pos: number): number {
  let index = 0;
  pages.forEach((page, candidate) => { if (page.from <= pos) index = candidate; });
  return index;
}

/**
 * @param pages - Laid-out pages.
 * @param index - Page opening here.
 * @returns Page break line, noting an underused page before it.
 */
function renderPageBreak(pages: readonly QuireAiLayoutPage[], index: number): string {
  const before = pages[index - 1]?.used;
  const note = before === null || before === undefined || before >= underusedPage ? "" : `（上页正文只用了 ${Math.round(before * 100)}%）`;
  return note === "" ? `—— 第 ${index + 1} 页 ——` : `—— 第 ${index + 1} 页${note}——`;
}

/**
 * @param settings - Document setting lines.
 * @param pages - Laid-out pages.
 * @returns The settings with the page count first, when pages are known.
 */
function withPageCount(settings: readonly string[], pages: readonly QuireAiLayoutPage[] | undefined): string[] {
  if (pages === undefined || pages.length === 0) return [...settings];
  const [title, ...rest] = settings;
  return title === undefined ? [`## ${quireAiSettingsTitle}`, `页数：${pages.length}`] : [title, `页数：${pages.length}`, ...rest];
}

/** Blocks listed before the one holding the position a listing is opened around. */
const blocksBeforeAround = 3;

/**
 * @param blocks - Listed blocks in document order.
 * @param pos - Document position.
 * @returns Index a few blocks before the first block ending after `pos`.
 */
function aroundIndex(blocks: readonly QuireAiViewBlock[], pos: number): number {
  const index = blocks.findIndex(block => block.pos + block.node.nodeSize > pos);
  return Math.max(0, (index < 0 ? blocks.length - 1 : index) - blocksBeforeAround);
}

/**
 * Renders one block line.
 * @param doc - Current document.
 * @param block - Listed block.
 * @param id - Model-visible identity.
 * @param registry - Compiled facts.
 * @returns `[id] (caption) {formats} text` line, indented by nesting depth.
 */
export function renderBlockLine(doc: Node, block: QuireAiViewBlock, id: string | null, registry: QuireAiRegistry): string {
  const fact = registry.blocks.get(block.node.type.name);
  const parts = id === null ? ["  ".repeat(block.depth)] : [`${"  ".repeat(block.depth)}[${id}]`];
  if (block.caption !== undefined) parts.push(block.caption);
  // A block already deleted as a tracked change stays until reviewed; a short line says so and saves reading it whole.
  if (registry.removals.some(removal => removal.removed(block.node))) {
    const text = block.node.textContent;
    parts.push(`{deleted:"pending review"}`, text.length > 24 ? `${text.slice(0, 24)}…` : text);
    return id === null ? `${parts[0]}${parts.slice(1).join(" ")}` : parts.join(" ");
  }
  if (block.node.isTextblock) {
    const formats = formatQuireAiProperties(readQuireAiFormats(registry.paragraphFormats,
      format => format.read({ level: "paragraph", node: block.node, doc, pos: block.pos })));
    if (formats.length > 0) parts.push(formats);
    if (block.node.content.size > 0) parts.push(renderQuireAiInline(block.node, registry.characterFormats, registry.blocks, doc));
    if (id !== null && readQuireAiBlockItems(block.node, registry) !== null) parts.push(`(internal items: document_read.items with block="${id}")`);
  } else {
    parts.push(fact?.label?.(block.node, doc) ?? block.node.type.name);
    if (id !== null && fact?.items) parts.push(`(internal items: document_read.items with block="${id}")`);
  }
  return id === null ? `${parts[0]}${parts.slice(1).join(" ")}` : parts.join(" ");
}

/**
 * Describes a whole document in the view's notation without block ids, for showing
 * people what an edit changes: two descriptions differ only where content, formats
 * or objects changed, not where ids would shift.
 *
 * @param doc - Document to describe.
 * @param registry - Compiled facts.
 * @returns Document settings, then one line per block under its section titles.
 */
export function describeQuireAiDocument(doc: Node, registry: QuireAiRegistry): string {
  const lines: string[] = renderQuireAiSettings(doc, registry);
  let section: unknown;
  for (const block of collectQuireAiSections(doc, registry).flatMap(entry => collectQuireAiBlocks(entry, registry))) {
    if (block.section !== section) lines.push(`## ${block.section.title}`);
    section = block.section;
    lines.push(renderBlockLine(doc, block, null, registry));
  }
  return lines.join("\n");
}

