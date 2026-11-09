import type { QuireAiCapability } from "@quirekit/ai-contract";
import { applyWordListAiStart, applyWordListAiStyle } from "./apply";
import { wordListAiStyles } from "./styles";
import { readWordListAiValue } from "./read";
import { isWordListAiRangeSatisfied } from "./satisfaction";
import type { ListValue } from "./types";

/**
 * Writes list membership for people.
 * @param value - List value as read.
 * @returns Text such as "编号“一、”，第 1 级，从 3 开始".
 */
function presentList(value: unknown): string {
  const list = value as ListValue;
  if (list.kind === "task") return `任务${list.checked === true ? "（已完成）" : "（未完成）"}，第 ${(list.level ?? 0) + 1} 级`;
  const style = list.style === undefined ? "" : `“${list.style}”`;
  const start = list.start === undefined ? "" : `，从 ${list.start} 开始`;
  return `${list.kind === "bullet" ? "项目符号" : "编号"}${style}，第 ${(list.level ?? 0) + 1} 级${start}`;
}

/** Paragraph list membership exposed by Word numbering. */
export const wordNumberingAiCapabilities: readonly QuireAiCapability[] = [{
  kind: "format",
  name: "list",
  level: "paragraph",
  numbered: true,
  present: { label: "列表", value: presentList },
  description: "List membership: {kind:\"bullet\"|\"number\"|\"task\", level:0-8, style, start, checked}; consecutive blocks form one list. "
    + "`style` is the marker pattern of the item's level, named by its first marker, and changes that level of the whole list. "
    + "`start` is the number the item shows, given at the start of each list and wherever numbering does not simply go on; "
    + "set it to restart numbering there, or to the next number of an earlier list to continue that list. "
    + "A task item is a checklist line with a check box; `checked` marks it done.",
  schema: {
    type: "object",
    properties: {
      kind: { enum: ["bullet", "number", "task"] },
      level: { type: "integer", minimum: 0, maximum: 8 },
      style: { enum: Object.keys(wordListAiStyles) },
      start: { type: "integer", minimum: 0, maximum: 32767 },
      checked: { type: "boolean" }
    },
    required: ["kind"],
    additionalProperties: false,
    examples: [{ kind: "number", style: "一、" }, { kind: "number", start: 3 }, { kind: "task", checked: true }]
  },
  satisfied: isWordListAiRangeSatisfied,
  read: target => target.level === "paragraph" ? readWordListAiValue(target.node, target.doc, target.pos) : undefined,
  apply: ({ tr, commands, from, to }, value) => {
    const current = readWordListAiValue(tr.doc.resolve(from).parent, tr.doc);
    if (value === null) return current === undefined || commands.clearWordList();
    const target = value as ListValue;
    if (target.style !== undefined && wordListAiStyles[target.style]?.kind !== target.kind) return false;
    if (target.checked !== undefined && target.kind !== "task") return false;
    // Toggling the selection as a whole keeps the paragraphs in one list instance.
    if (current?.kind !== target.kind) {
      const toggled = target.kind === "bullet" ? commands.toggleWordBulletList()
        : target.kind === "task" ? commands.toggleWordTaskList() : commands.toggleWordOrderedList();
      if (!toggled) return false;
    }
    let level = readWordListAiValue(tr.doc.resolve(from).parent, tr.doc)?.level ?? 0;
    for (; level < (target.level ?? level); level += 1) if (!commands.increaseWordListLevel()) return false;
    for (; level > (target.level ?? level); level -= 1) if (!commands.decreaseWordListLevel()) return false;
    if (target.style !== undefined && !applyWordListAiStyle(tr, commands, from, to, target.style)) return false;
    if (target.kind === "task") {
      // The command changes every task item in the range and reports false when all of them already match.
      return target.checked === undefined || commands.setWordTaskChecked({ checked: target.checked })
        || readWordListAiValue(tr.doc.resolve(from).parent, tr.doc)?.checked === target.checked;
    }
    return target.start === undefined || target.kind === "bullet" || applyWordListAiStart(tr, commands, from, to, target.start);
  }
}];
