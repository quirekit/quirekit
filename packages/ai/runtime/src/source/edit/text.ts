/**
 * Normalizes Markdown written by the model: LF line ends, no blank lines around it.
 * @param text - Written text.
 * @returns Normalized text.
 */
export function normalizeQuireAiMarkdown(text: string): string {
  return text.replace(/\r\n?/gu, "\n").replace(/^(?:[ \t]*\n)+/u, "").replace(/(?:\n[ \t]*)+$/u, "").replace(/[ \t]+$/u, "");
}

/**
 * Adds a container's indentation to lines of new source.
 * @param text - Source without the container indentation, as the view lists it.
 * @param indent - Container indentation.
 * @param first - Whether the first line gets it too, as when the text starts a new line.
 * @returns Source as it stands in the container.
 */
export function indentQuireAiMarkdown(text: string, indent: string, first: boolean): string {
  if (indent === "") return text;
  return text.split("\n").map((line, index) => (index > 0 || first) && line !== "" ? indent + line : line).join("\n");
}

/**
 * @param text - Document text.
 * @param pos - Position.
 * @returns Start of the line holding the position.
 */
export function lineStartOf(text: string, pos: number): number {
  return text.lastIndexOf("\n", pos - 1) + 1;
}

/**
 * Finds text in a block's source as the view lists it, without the container indentation of
 * continuation lines, and returns where it stands in the document.
 * @param text - Document text.
 * @param from - Start of the block's own source.
 * @param to - End of the block's own source.
 * @param indent - Container indentation.
 * @param find - Text copied from the view.
 * @returns Document ranges of every non-overlapping occurrence, in order.
 */
export function findQuireAiSourceText(text: string, from: number, to: number, indent: string, find: string): { from: number; to: number }[] {
  // Listed characters and the document offset of each, plus one past the end.
  const offsets: number[] = [];
  let listed = "";
  for (let pos = from; pos < to; pos += 1) {
    if (indent !== "" && pos > from && text[pos - 1] === "\n" && text.startsWith(indent, pos) && pos + indent.length <= to) {
      pos += indent.length - 1;
      continue;
    }
    offsets.push(pos);
    listed += text[pos];
  }
  offsets.push(to);
  const found: { from: number; to: number }[] = [];
  for (let at = listed.indexOf(find); at >= 0; at = listed.indexOf(find, at + find.length)) {
    found.push({ from: offsets[at]!, to: offsets[at + find.length - 1]! + 1 });
  }
  return found;
}
