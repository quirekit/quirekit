import type { QualityBlock, QualityCell, QualityInput } from "./types";

/** Block families and their caret positions; `¦` marks the caret. */
export const qualityBlocks: readonly QualityBlock[] = [
  { name: "段落", weight: 3, source: "甲乙丙", positions: { 开头: "¦甲乙丙", 中间: "甲¦乙丙", 末尾: "甲乙丙¦" } },
  { name: "空段落", weight: 2, source: "", positions: { 空块: "¦" } },
  { name: "标题", weight: 2, source: "## 标题", positions: { 开头: "## ¦标题", 中间: "## 标¦题", 末尾: "## 标题¦" } },
  { name: "无序列表", weight: 3, source: "- 一\n- 二\n- 三",
    positions: { 开头: "- 一\n- ¦二\n- 三", 中间: "- 一\n- 二¦二\n- 三", 末尾: "- 一\n- 二¦\n- 三", 空项: "- 一\n- ¦\n- 三", 末项空项: "- 一\n- ¦" } },
  { name: "有序列表", weight: 2, source: "1. 一\n2. 二\n3. 三",
    positions: { 开头: "1. 一\n2. ¦二\n3. 三", 末尾: "1. 一\n2. 二¦\n3. 三", 空项: "1. 一\n2. ¦\n3. 三", 末项空项: "1. 一\n2. ¦" } },
  { name: "任务列表", weight: 2, source: "- [ ] 一\n- [x] 二\n- [ ] 三",
    positions: { 开头: "- [ ] 一\n- [x] ¦二\n- [ ] 三", 末尾: "- [ ] 一\n- [x] 二¦\n- [ ] 三", 空项: "- [ ] 一\n- [ ] ¦\n- [ ] 三" } },
  { name: "嵌套列表", weight: 2, source: "- 一\n  - 二\n- 三",
    positions: { 开头: "- 一\n  - ¦二\n- 三", 末尾: "- 一\n  - 二¦\n- 三", 空项: "- 一\n  - ¦\n- 三", 带子项空项: "- 一\n  - ¦\n    - 子\n- 三",
      带子项开头: "- 一\n  - ¦二\n    - 子\n- 三" } },
  { name: "引用", weight: 1.5, source: "> 甲乙\n> 丙丁",
    positions: { 开头: "> ¦甲乙", 中间: "> 甲¦乙", 末尾: "> 甲乙¦", 第二行开头: "> 甲\n> ¦乙", 空行: "> 甲\n>\n> ¦" } },
  { name: "代码块", weight: 1, source: "```js\nfoo\n```",
    positions: { 开头: "```js\n¦foo\n```", 末尾: "```js\nfoo¦\n```", 空块: "```js\n¦\n```" } },
  { name: "表格", weight: 1, source: "| a | b |\n| --- | --- |\n| 1 | 2 |",
    positions: { 单元格开头: "| a | b |\n| --- | --- |\n| ¦1 | 2 |", 单元格末尾: "| a | b |\n| --- | --- |\n| 1¦ | 2 |", 表头末尾: "| a¦ | b |\n| --- | --- |\n| 1 | 2 |" } },
  { name: "公式", weight: 0.5, source: "$$\nx\n$$", positions: {} },
  { name: "图表", weight: 0.5, source: "```mermaid\ngraph TD\nA-->B\n```", positions: {} },
  { name: "容器", weight: 0.5, source: "::: note\n甲乙\n:::",
    positions: { 开头: "::: note\n¦甲乙\n:::", 末尾: "::: note\n甲乙¦\n:::", 空块: "::: note\n¦\n:::" } },
  { name: "分隔线", weight: 0.5, source: "---", positions: {} },
  { name: "frontmatter", weight: 0.5, source: "---\ntitle: a\n---", leading: true, positions: { 末尾: "---\ntitle: a¦\n---" } },
  { name: "粗体", weight: 2, source: "前**粗体**后",
    positions: { 内开头: "前**¦粗体**后", 内末尾: "前**粗体¦**后", 外前: "前¦**粗体**后", 外后: "前**粗体**¦后", 行尾外: "前**粗体**¦" } },
  { name: "链接", weight: 1.5, source: "前[链接](https://a.b)后",
    positions: { 内末尾: "前[链接¦](https://a.b)后", 外后: "前[链接](https://a.b)¦后", 行尾外: "前[链接](https://a.b)¦" } },
  { name: "行内代码", weight: 1, source: "前`代码`后", positions: { 内末尾: "前`代码¦`后", 外后: "前`代码`¦后" } },
];

/** Input weights by usage frequency. */
export const qualityInputs: Readonly<Record<QualityInput, number>> = {
  type: 3, Enter: 3, Backspace: 3, Delete: 1.5, "Shift-Enter": 1, Tab: 1, "Shift-Tab": 1,
};

/**
 * Places each block among paragraphs, alone in the document, and as the target of the
 * paragraphs' edges, so every position and boundary appears in both contexts.
 * @returns Every cell of the state-level matrix.
 */
export function qualityCells(): readonly QualityCell[] {
  const cells: QualityCell[] = [];
  for (const block of qualityBlocks) {
    const documents: [string, string][] = [];
    for (const [position, source] of Object.entries(block.positions)) {
      documents.push([position, block.leading ? `${source}\n\n后文` : `前文\n\n${source}\n\n后文`]);
      if (!block.leading) documents.push([`${position}·独占`, source]);
    }
    if (!block.leading) documents.push(["块前段落末尾", `前文¦\n\n${block.source}\n\n后文`]);
    documents.push(["块后段落开头", block.leading ? `${block.source}\n\n¦后文` : `前文\n\n${block.source}\n\n¦后文`]);
    for (const [position, source] of documents) for (const [input, weight] of Object.entries(qualityInputs) as [QualityInput, number][]) {
      cells.push({ id: `${block.name}/${position}/${input}`, block: block.name, position, input, source, weight: block.weight * weight });
    }
  }
  return cells;
}
