/** Elements whose content never belongs in the document. */
const dropped = new Set(["SCRIPT", "STYLE", "META", "TITLE", "HEAD", "NOSCRIPT", "TEMPLATE", "IFRAME", "OBJECT"]);

/** Elements that make pasted HTML worth converting rather than taking its plain text. */
const structural = /<(?:h[1-6]|p|ul|ol|li|blockquote|pre|table|b|strong|i|em|s|del|strike|a\s|img|hr|code)\b/iu;

/** @param html - Clipboard HTML. @returns Whether it carries structure or formatting beyond plain text. */
export function hasStructure(html: string): boolean { return structural.test(html); }

/** @param text - Text node content. @returns The text with Markdown syntax characters escaped. */
function escape(text: string): string {
  return text.replace(/[\\`*_[\]<]/gu, "\\$&").replace(/\s+/gu, " ");
}

/** @param text - One converted block. @returns The block with characters that would start other syntax at a line start escaped. */
function escapeLineStart(text: string): string {
  return text.replace(/^(\s*)([#>+-]|\d+[.)])(?=\s)/gmu, "$1\\$2");
}

/** @param node - Parent. @param context - Conversion context. @returns Inline Markdown of the children. */
function inline(node: Node, context: { readonly code: boolean }): string {
  let out = "";
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3) { out += context.code ? child.textContent ?? "" : escape(child.textContent ?? ""); continue; }
    if (child.nodeType !== 1) continue;
    const element = child as Element, tag = element.tagName;
    if (dropped.has(tag)) continue;
    const content = () => inline(element, context).trim();
    // Inline phase: emphasis wraps trimmed content, keeping spaces outside the markers.
    if (tag === "BR") out += "  \n";
    else if (tag === "B" || tag === "STRONG") out += wrap(content(), "**", element);
    else if (tag === "I" || tag === "EM") out += wrap(content(), "*", element);
    else if (tag === "S" || tag === "DEL" || tag === "STRIKE") out += wrap(content(), "~~", element);
    else if (tag === "CODE" && !context.code) { const code = element.textContent ?? ""; out += code ? `\`${code.replace(/`/gu, "")}\`` : ""; }
    else if (tag === "A") {
      const href = element.getAttribute("href") ?? "", text = content();
      out += /^(?:https?:|mailto:|#|\/)/iu.test(href) && text ? `[${text}](${href.replace(/[()\s]/gu, encodeURIComponent)})` : text;
    } else if (tag === "IMG") {
      const src = element.getAttribute("src") ?? "";
      if (/^https?:/iu.test(src)) out += `![${escape(element.getAttribute("alt") ?? "")}](${src.replace(/[()\s]/gu, encodeURIComponent)})`;
    } else out += inline(element, context);
  }
  return out;
}

/** @param text - Inline content. @param marker - Emphasis marker. @param element - Source element. @returns Wrapped content, keeping surrounding spaces outside. */
function wrap(text: string, marker: string, element: Element): string {
  if (!text) return "";
  const raw = element.textContent ?? "";
  return `${/^\s/u.test(raw) ? " " : ""}${marker}${text}${marker}${/\s$/u.test(raw) ? " " : ""}`;
}

/** @param element - List. @param depth - Nesting depth. @returns Markdown list lines. */
function list(element: Element, depth: number): string[] {
  const ordered = element.tagName === "OL", lines: string[] = [], indent = "  ".repeat(depth);
  let number = Number(element.getAttribute("start") ?? 1) || 1;
  for (const item of Array.from(element.children)) {
    if (item.tagName !== "LI") continue;
    const marker = ordered ? `${number++}.` : "-", nested: string[] = [], text = document.createElement("div");
    for (const child of Array.from(item.childNodes)) {
      if (child.nodeType === 1 && /^(?:UL|OL)$/u.test((child as Element).tagName)) nested.push(...list(child as Element, depth + 1));
      else text.append(child.cloneNode(true));
    }
    lines.push(`${indent}${marker} ${escapeLineStart(inline(text, { code: false }).trim())}`, ...nested);
  }
  return lines;
}

/** @param element - Table. @returns A Markdown table, or null when it has no rows. */
function table(element: Element): string | null {
  const rows = Array.from(element.querySelectorAll("tr")).map(row => Array.from(row.children).filter(cell => /^T[DH]$/u.test(cell.tagName))
    .map(cell => inline(cell, { code: false }).trim().replace(/\|/gu, "\\|").replace(/ {2}\n/gu, " ")));
  const width = Math.max(0, ...rows.map(row => row.length));
  if (!rows.length || !width) return null;
  const line = (cells: string[]) => `| ${Array.from({ length: width }, (_, index) => cells[index] ?? "").join(" | ")} |`;
  return [line(rows[0]!), `|${" --- |".repeat(width)}`, ...rows.slice(1).map(line)].join("\n");
}

/** @param node - Container. @returns Markdown blocks of its children. */
function blocks(node: Node): string[] {
  const out: string[] = [];
  let run = document.createElement("div");
  // Block phase: consecutive inline content forms one paragraph; each block element ends it.
  const flush = () => { const text = inline(run, { code: false }).trim(); if (text) out.push(escapeLineStart(text)); run = document.createElement("div"); };
  for (const child of Array.from(node.childNodes)) {
    const element = child.nodeType === 1 ? child as Element : null, tag = element?.tagName ?? "";
    if (element && dropped.has(tag)) continue;
    if (!element || !/^(?:H[1-6]|P|DIV|SECTION|ARTICLE|MAIN|HEADER|FOOTER|UL|OL|BLOCKQUOTE|PRE|TABLE|HR|FIGURE)$/u.test(tag)) { run.append(child.cloneNode(true)); continue; }
    flush();
    if (/^H[1-6]$/u.test(tag)) { const text = inline(element, { code: false }).trim(); if (text) out.push(`${"#".repeat(Number(tag[1]))} ${text}`); }
    else if (tag === "UL" || tag === "OL") out.push(list(element, 0).join("\n"));
    else if (tag === "BLOCKQUOTE") out.push(blocks(element).join("\n\n").split("\n").map(line => line ? `> ${line}` : ">").join("\n"));
    else if (tag === "PRE") { const code = (element.textContent ?? "").replace(/\n$/u, ""); out.push(`\`\`\`\n${code.replace(/^```/gmu, "\\`\\`\\`")}\n\`\`\``); }
    else if (tag === "TABLE") { const markdown = table(element); if (markdown) out.push(markdown); }
    else if (tag === "HR") out.push("---");
    else out.push(...blocks(element));
  }
  flush();
  return out;
}

/**
 * Converts pasted HTML into Markdown for the common structure of web pages and
 * documents: headings, paragraphs, emphasis, links, images, lists, quotes, code
 * and tables. Unknown elements contribute their text; scripts and styles nothing.
 * @param html - Clipboard HTML.
 * @returns Markdown source, possibly empty.
 */
export function htmlToMarkdown(html: string): string {
  const body = new DOMParser().parseFromString(html, "text/html").body;
  return blocks(body).join("\n\n").trim();
}
