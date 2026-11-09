import type { MdEditorLocale } from "../types";
import type { SourceBlock } from "@quirekit/msfe-core";

/** @param locale - Product locale. @returns Block chrome labels, independent of document content. */
export function blockLabels(locale: MdEditorLocale) {
  return locale === "en" ? {
    handle: "Drag or open block menu", hint: "Drag to move · Click for actions", menu: "Block actions", format: "Turn into",
    before: "Insert above", after: "Insert below", up: "Move up", down: "Move down", copy: "Copy Markdown", cut: "Cut", duplicate: "Duplicate", remove: "Delete",
    failed: "Could not copy. Select the block and use your system copy shortcut.", stale: "This block changed. Reopen its menu.",
    colors: "Color settings", surface: "Highlight color", ink: "Text color", defaultInk: "Default",
    surfaces: { orange: "Light orange", red: "Light red", green: "Light green", blue: "Light blue", purple: "Light purple", gray: "Light gray" },
    inks: { orange: "Orange", red: "Red", green: "Green", blue: "Blue", purple: "Purple", gray: "Gray" },
  } : {
    handle: "拖动或打开块菜单", hint: "拖动移动位置 · 点击打开菜单", menu: "块操作", format: "转换为",
    before: "上方插入", after: "下方插入", up: "上移", down: "下移", copy: "复制 Markdown", cut: "剪切", duplicate: "创建副本", remove: "删除",
    failed: "复制失败，请选中该块后使用系统复制快捷键。", stale: "该块已发生变化，请重新打开菜单。",
    colors: "颜色设置", surface: "高亮块颜色", ink: "字体颜色", defaultInk: "默认",
    surfaces: { orange: "浅橙", red: "浅红", green: "浅绿", blue: "浅蓝", purple: "浅紫", gray: "浅灰" },
    inks: { orange: "橙色", red: "红色", green: "绿色", blue: "蓝色", purple: "紫色", gray: "灰色" },
  };
}

/** @param block - Accepted source block. @param prefix - Bounded source prefix for task identification. @returns Compact type label or a shared semantic icon. */
export function blockBadge(block: SourceBlock, prefix = ""): { text?: string; icon?: string } {
  if (/^(ATXHeading[1-6]|SetextHeading[12])$/u.test(block.name)) return { text: `H${block.name.slice(-1)}` };
  if (block.name === "BulletList" && /^\s*[-+*]\s+\[[ xX]\]/u.test(prefix)) return { icon: "listTodo" };
  const icons: Record<string, string> = { Paragraph: "type", BulletList: "listBullet", OrderedList: "listNumbered", Blockquote: "textQuote",
    FencedCode: "codeXml", CodeBlock: "codeXml", Table: "table", HorizontalRule: "horizontalRule", CustomContainer: "layers", DisplayMath: "sigma",
    DefinitionList: "bookOpen", Frontmatter: "fileCode" };
  return { icon: icons[block.name] ?? "paragraph" };
}
