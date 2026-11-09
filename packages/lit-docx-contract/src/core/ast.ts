/**
 * LitAST 核心节点定义
 * 定义抽象语法树的节点类型、标记类型及常用工厂函数，
 * 作为 OOXML 与 ProseMirror JSON 双向转换的中间表示层。
 */

import type { HeaderFooterType } from './ooxml-enums.js'
import type { LitAstMark, LitAstNode } from './contracts.js'
import type { XmlElement } from '../ooxml/element.js'

/** 文本标记（加粗、斜体、链接等行内样式），挂在 text 节点的 marks 上 */
export interface LitMark extends LitAstMark {
  /** 标记类型，取值见 MARK_TYPES（如 'bold' / 'link' / 'insertion'） */
  type: string
  /** 标记属性（如 link 的 href、textStyle 的 fontSize/color），具体见各 mark 文档 */
  attrs?: Record<string, any>
}

/** AST 通用节点，可嵌套子节点 */
export interface LitNode extends LitAstNode {
  /** 节点类型，取值见 NODE_TYPES（如 'paragraph' / 'table' / 'text'） */
  type: string
  /** 子节点列表（块级容器/段落内联内容等） */
  children?: LitNode[]
  /** 节点属性（如段落对齐、表格宽度等），各类型的 attrs 见 ast-types.md */
  attrs?: Record<string, any>
  /** 行内标记（仅 text 等行内节点有意义） */
  marks?: LitMark[]
  /** 保留原始 XML 片段，用于无损往返转换（未建模/复杂对象的兜底） */
  rawXml?: string
  /** 存放解析阶段附加的元数据（如批注/脚注正文、rawXmlFiles、节属性等） */
  meta?: Record<string, any>
}

/** 文本叶节点，type 固定为 'text'，持有实际字符串内容 */
export interface LitTextNode extends LitNode {
  /** 固定为 'text' */
  type: 'text'
  /** 文本内容（制表符为 \t、换行为 \n） */
  text: string
  /** 该文本片段上的行内标记 */
  marks?: LitMark[]
}

/** Zero-width advisory page boundary recorded by the producer's last layout. */
export interface LitLastRenderedPageBreakNode extends LitNode {
  /** Fixed semantic discriminator. */
  type: 'lastRenderedPageBreak'
  /** The OOXML element is empty and never owns children. */
  children?: undefined
}

/** 页面尺寸与方向属性，对应 `w:pgSz`。 */
export interface LitSectionPageSizeAttrs {
  /** 页面宽度，单位 dxa/twips。 */
  pageWidth?: number
  /** 页面高度，单位 dxa/twips。 */
  pageHeight?: number
  /** 页面方向。 */
  orientation?: 'portrait' | 'landscape'
  /** 由宽高识别出的纸张预设提示。 */
  paperSize?: string
}

/** 页边距属性，对应 `w:pgMar`。 */
export interface LitSectionMargins {
  /** 上边距，单位 dxa，可为负值。 */
  top?: number
  /** 右边距，单位 dxa。 */
  right?: number
  /** 下边距，单位 dxa，可为负值。 */
  bottom?: number
  /** 左边距，单位 dxa。 */
  left?: number
  /** 页眉距页面顶部的距离，单位 dxa。 */
  header?: number
  /** 页脚距页面底部的距离，单位 dxa。 */
  footer?: number
  /** 装订线宽度，单位 dxa。 */
  gutter?: number
}

/** 页码属性，对应 `w:pgNumType`。 */
export interface LitSectionPageNumberAttrs {
  /** 起始页码。 */
  start?: number
  /** OOXML 页码格式。 */
  format?: string
  /** 章节标题样式级别。 */
  chapStyle?: number
  /** 章节分隔符。 */
  chapSep?: string
}

/** OOXML document-grid kinds from `ST_DocGrid`. */
export type LitSectionDocumentGridType =
  | 'default'
  | 'lines'
  | 'linesAndChars'
  | 'snapToChars'

/** Section document-grid attributes from `w:docGrid`. */
export interface LitSectionDocumentGridAttrs {
  /** Exact document-grid kind. */
  type?: LitSectionDocumentGridType
  /** Line pitch in twentieths of a point. */
  linePitch?: number
  /** Signed source character-spacing value. */
  charSpace?: number
}

/** 不等宽分栏的单栏定义，对应 `w:col`。 */
export interface LitSectionColumnDefinition {
  /** 栏宽，单位 dxa；源文件省略时缺省。 */
  width?: number
  /** 本栏之后的栏间距，单位 dxa；源文件省略时缺省。 */
  space?: number
}

/** LitAST 分节属性，对应已建模的 `w:sectPr` 子集。 */
export interface LitSectionAttrs extends LitSectionPageSizeAttrs {
  /** Empty paragraph-like source carrier for this paragraph-owned boundary; preserved outside normal body flow. */
  boundaryParagraph?: LitNode
  /** JSON-safe self-contained w:pgBorders envelope; preserved through editing, without native rendering or image/corner relationships. */
  _pgBordersRaw?: XmlElement
  /** 可选的稳定分节标识，由消费方维护。 */
  id?: string
  /** 页面边距与页眉页脚距离。 */
  margins?: LitSectionMargins
  /** 等宽分栏的栏数。 */
  columnCount?: number
  /** 栏间距，单位 dxa。 */
  columnSpace?: number
  /** 是否使用等宽分栏。 */
  columnEqualWidth?: boolean
  /** 是否绘制栏间分隔线。 */
  columnSeparator?: boolean
  /** 不等宽分栏的逐栏定义，对应 `w:col`，按源顺序保存。 */
  columnDefinitions?: LitSectionColumnDefinition[]
  /** 页码设置。 */
  pageNumber?: LitSectionPageNumberAttrs
  /** 节级文档网格。 */
  docGrid?: LitSectionDocumentGridAttrs
  /** Uninterpreted section footnote properties retained through host codecs. */
  footnotePr?: Record<string, unknown>
  /** Uninterpreted section endnote properties retained through host codecs. */
  endnotePr?: Record<string, unknown>
  /** Explicit suppression of endnotes at this section boundary, retained for host preservation. */
  noEndnote?: boolean
  /** 分节符类型，对应 `ST_SectionMark`。 */
  sectionBreakType?: 'nextPage' | 'nextColumn' | 'continuous' | 'evenPage' | 'oddPage'
  /** 是否启用首页不同的页眉页脚。 */
  titlePage?: boolean
  /** 旧 consumer 的镜像页边距兼容输入；权威值位于文档 `meta.settings`。 */
  mirrorMargins?: boolean
  /** 是否把装订线放在 RTL 一侧。 */
  rtlGutter?: boolean
  /** 是否启用节级从右到左方向。 */
  bidi?: boolean
  /** 其他已建模但尚未强类型化的节属性。 */
  [key: string]: unknown
}

/** LitAST 分节节点。 */
export interface LitSectionNode extends LitNode {
  /** 固定为 `section`。 */
  type: 'section'
  /** 已建模的分节属性。 */
  attrs?: LitSectionAttrs
}

/** 页眉页脚节点共享的 bridge preservation 属性。 */
export interface LitHeaderFooterBridgeAttrs {
  /** 消费方维护的稳定 story id；OOXML generator 不解释该字段。 */
  storyId?: string
}

/** LitAST 页眉属性。 */
export interface LitHeaderAttrs extends LitHeaderFooterBridgeAttrs {
  /** 页眉引用类型。 */
  headerType: HeaderFooterType
}

/** LitAST 页脚属性。 */
export interface LitFooterAttrs extends LitHeaderFooterBridgeAttrs {
  /** 页脚引用类型。 */
  footerType: HeaderFooterType
}

/** LitAST 页眉节点。 */
export interface LitHeaderNode extends LitNode {
  /** 固定为 `header`。 */
  type: 'header'
  /** 页眉 variant 与 bridge preservation 属性。 */
  attrs: LitHeaderAttrs
  /** 页眉富文本块内容。 */
  children: LitNode[]
}

/** LitAST 页脚节点。 */
export interface LitFooterNode extends LitNode {
  /** 固定为 `footer`。 */
  type: 'footer'
  /** 页脚 variant 与 bridge preservation 属性。 */
  attrs: LitFooterAttrs
  /** 页脚富文本块内容。 */
  children: LitNode[]
}

/** 所有块级与内联节点的类型字符串枚举 */
export const NODE_TYPES = {
  DOCUMENT: 'document',
  SECTION: 'section',
  HEADER: 'header',
  FOOTER: 'footer',
  PARAGRAPH: 'paragraph',
  HEADING: 'heading',
  BLOCKQUOTE: 'blockquote',
  CODE_BLOCK: 'codeBlock',
  HORIZONTAL_RULE: 'horizontalRule',
  PAGE_BREAK: 'pageBreak',
  COLUMN_BREAK: 'columnBreak',
  LAST_RENDERED_PAGE_BREAK: 'lastRenderedPageBreak',
  LIST: 'list',
  LIST_ITEM: 'listItem',
  TABLE: 'table',
  TABLE_ROW: 'tableRow',
  TABLE_CELL: 'tableCell',
  IMAGE: 'image',
  WATERMARK: 'watermark',
  BACKGROUND_IMAGE: 'backgroundImage',
  COMMENT_START: 'commentStart',
  COMMENT_END: 'commentEnd',
  COMMENT_RANGE: 'commentRange',
  FOOTNOTE_REF: 'footnoteRef',
  ENDNOTE_REF: 'endnoteRef',
  REVISION: 'revision',
  FIELD: 'field',
  SDT: 'sdt',  // Structured Document Tag（内容控件）
  TEXT_BOX: 'textBox',  // 文本框（DrawingML 或 VML）
  RUBY: 'ruby',  // 注音（拼音/假名标注）
  BOOKMARK_START: 'bookmarkStart',  // 书签起点
  BOOKMARK_END: 'bookmarkEnd',  // 书签终点
  PERM_START: 'permStart',  // 可编辑区域起点
  PERM_END: 'permEnd',  // 可编辑区域终点
  MATH: 'math',  // Office Math 公式（m:oMath 行内或 m:oMathPara 独立），原始子树随节点往返
  TEXT: 'text',
  UNKNOWN_BLOCK: 'unknownBlock',
  UNKNOWN_INLINE: 'unknownInline',
} as const

/** 所有行内标记的类型字符串枚举 */
export const MARK_TYPES = {
  BOLD: 'bold',
  ITALIC: 'italic',
  UNDERLINE: 'underline',
  STRIKE: 'strike',
  DOUBLE_STRIKE: 'doubleStrike',
  SUPERSCRIPT: 'superscript',
  SUBSCRIPT: 'subscript',
  CODE: 'code',
  LINK: 'link',
  HIGHLIGHT: 'highlight',
  TEXT_STYLE: 'textStyle',
  /** 修订：插入的文本（对应 w:ins，包裹 run） */
  INSERTION: 'insertion',
  /** 修订：删除的文本（对应 w:del，文本用 w:delText） */
  DELETION: 'deletion',
} as const

// 用于 isBlockNode 快速查找的块级节点类型集合
const BLOCK_TYPES = new Set([
  NODE_TYPES.PARAGRAPH, NODE_TYPES.HEADING, NODE_TYPES.BLOCKQUOTE,
  NODE_TYPES.CODE_BLOCK, NODE_TYPES.HORIZONTAL_RULE, NODE_TYPES.PAGE_BREAK,
  NODE_TYPES.LIST, NODE_TYPES.LIST_ITEM, NODE_TYPES.TABLE,
  NODE_TYPES.TABLE_ROW, NODE_TYPES.TABLE_CELL, NODE_TYPES.UNKNOWN_BLOCK,
])

/** 类型守卫：判断节点是否为文本叶节点 */
export function isTextNode(node: LitNode): node is LitTextNode {
  return node.type === NODE_TYPES.TEXT
}

/** 类型守卫：判断节点是否为块级节点 */
export function isBlockNode(node: LitNode): boolean {
  return (BLOCK_TYPES as Set<string>).has(node.type)
}

/** 创建文档根节点，版本号固定为 1 */
export function createDocument(children: LitNode[], meta?: Record<string, any>): LitNode {
  return { type: NODE_TYPES.DOCUMENT, children, attrs: { version: 1 }, meta }
}

/**
 * 创建分节节点。
 *
 * @param attrs - 已建模的分节属性。
 * @param children - 页眉、页脚等节级子节点。
 * @returns LitAST 分节节点。
 */
export function createSection(attrs: LitSectionAttrs, children: LitNode[] = []): LitSectionNode {
  return { type: NODE_TYPES.SECTION, attrs, children }
}

/**
 * 创建类型化页眉节点。
 *
 * @param headerType - default/first/even 页眉类型。
 * @param children - 页眉富文本块内容。
 * @param storyId - 可选的消费方稳定 story id。
 * @returns LitAST 页眉节点。
 */
export function createHeader(
  headerType: HeaderFooterType,
  children: LitNode[],
  storyId?: string,
): LitHeaderNode {
  return {
    type: NODE_TYPES.HEADER,
    attrs: { headerType, ...(storyId ? { storyId } : {}) },
    children,
  }
}

/**
 * 创建类型化页脚节点。
 *
 * @param footerType - default/first/even 页脚类型。
 * @param children - 页脚富文本块内容。
 * @param storyId - 可选的消费方稳定 story id。
 * @returns LitAST 页脚节点。
 */
export function createFooter(
  footerType: HeaderFooterType,
  children: LitNode[],
  storyId?: string,
): LitFooterNode {
  return {
    type: NODE_TYPES.FOOTER,
    attrs: { footerType, ...(storyId ? { storyId } : {}) },
    children,
  }
}

/** 创建文本叶节点，可选携带行内标记 */
export function createText(text: string, marks?: LitMark[]): LitTextNode {
  const node: LitTextNode = { type: NODE_TYPES.TEXT, text }
  if (marks && marks.length > 0) node.marks = marks
  return node
}

/**
 * Creates one zero-width producer-layout page-boundary hint.
 *
 * @returns Typed last-rendered page-break LitAST leaf.
 */
export function createLastRenderedPageBreak(): LitLastRenderedPageBreakNode {
  return { type: NODE_TYPES.LAST_RENDERED_PAGE_BREAK }
}

/** 创建段落节点 */
export function createParagraph(children: LitNode[], attrs?: Record<string, any>): LitNode {
  return { type: NODE_TYPES.PARAGRAPH, children, ...(attrs && { attrs }) }
}

/**
 * 创建标题节点。
 *
 * @param level - 标题层级（1–6）。
 * @param children - 标题的行内内容。
 * @param attrs - 除层级以外的段落属性。
 * @returns LitAST 标题节点。
 */
export function createHeading(
  level: number,
  children: LitNode[],
  attrs?: Record<string, any>,
): LitNode {
  return { type: NODE_TYPES.HEADING, children, attrs: { ...attrs, level } }
}

/** 创建列表节点，ordered 区分有序/无序 */
export function createList(ordered: boolean, children: LitNode[], attrs?: Record<string, any>): LitNode {
  return { type: NODE_TYPES.LIST, children, attrs: { ordered, ...attrs } }
}

/** 创建列表项节点，level 表示缩进层级 */
export function createListItem(level: number, children: LitNode[]): LitNode {
  return { type: NODE_TYPES.LIST_ITEM, children, attrs: { level } }
}

/** 创建表格节点 */
export function createTable(children: LitNode[], attrs?: Record<string, any>): LitNode {
  return { type: NODE_TYPES.TABLE, children, ...(attrs && { attrs }) }
}

/** 创建表格行节点 */
export function createTableRow(children: LitNode[], attrs?: Record<string, any>): LitNode {
  return { type: NODE_TYPES.TABLE_ROW, children, ...(attrs && { attrs }) }
}

/** 创建表格单元格节点 */
export function createTableCell(children: LitNode[], attrs?: Record<string, any>): LitNode {
  return { type: NODE_TYPES.TABLE_CELL, children, ...(attrs && { attrs }) }
}

/** 创建图片节点，attrs 中包含 src、width、height 等属性 */
export function createImage(attrs: Record<string, any>): LitNode {
  return { type: NODE_TYPES.IMAGE, attrs }
}

/** 创建脚注引用节点 */
export function createFootnoteRef(footnoteId: string): LitNode {
  return { type: NODE_TYPES.FOOTNOTE_REF, attrs: { footnoteId } }
}

/** 创建尾注引用节点 */
export function createEndnoteRef(endnoteId: string): LitNode {
  return { type: NODE_TYPES.ENDNOTE_REF, attrs: { endnoteId } }
}

/** 创建域代码节点，fieldType 为域类型（如 PAGE、DATE），instruction 为完整指令文本 */
export function createField(fieldType: string, instruction: string, attrs?: Record<string, any>): LitNode {
  return { type: NODE_TYPES.FIELD, attrs: { fieldType, instruction, ...attrs } }
}

/** 创建内容控件节点（SDT），sdtType 为控件类型（text/date/dropDownList 等） */
export function createSdt(sdtType: string, children: LitNode[], attrs?: Record<string, any>): LitNode {
  return { type: NODE_TYPES.SDT, children, attrs: { sdtType, ...attrs } }
}

/** 创建文本框节点，包含段落等子节点 */
export function createTextBox(children: LitNode[], attrs?: Record<string, any>): LitNode {
  return { type: NODE_TYPES.TEXT_BOX, children, ...(attrs && { attrs }) }
}

/** 创建注音节点，baseText 为基础文本，rubyText 为注音文本 */
export function createRuby(baseText: LitNode[], rubyText: LitNode[], attrs?: Record<string, any>): LitNode {
  return {
    type: NODE_TYPES.RUBY,
    children: baseText,
    attrs: { rubyText, ...attrs },
  }
}

/** 创建引用块节点 */
export function createBlockquote(children: LitNode[]): LitNode {
  return { type: NODE_TYPES.BLOCKQUOTE, children }
}

/** 创建代码块节点 */
export function createCodeBlock(children: LitNode[], attrs?: Record<string, any>): LitNode {
  return { type: NODE_TYPES.CODE_BLOCK, children, ...(attrs && { attrs }) }
}

/**
 * 创建水平分割线节点。
 *
 * @param attrs - 来源段落的可保留属性。
 * @returns LitAST 水平分割线节点。
 */
export function createHorizontalRule(attrs?: Record<string, any>): LitNode {
  return { type: NODE_TYPES.HORIZONTAL_RULE, ...(attrs && { attrs }) }
}

/**
 * 创建公式节点；公式内容由原始 OMML 子树承载，未编辑时原样写回。
 * @param display 是否为 m:oMathPara 独立公式
 * @param rawXml preserveOrder 形式的 m:oMath / m:oMathPara 元素 JSON
 */
export function createMath(display: boolean, rawXml: string): LitNode {
  return { type: NODE_TYPES.MATH, attrs: { display }, rawXml }
}

/** 创建无法识别的块级节点，保留原始 XML 以便往返 */
export function createUnknownBlock(originalTag: string, rawXml: string): LitNode {
  return { type: NODE_TYPES.UNKNOWN_BLOCK, attrs: { originalTag }, rawXml }
}

/** 创建无法识别的行内节点，保留原始 XML 以便往返 */
export function createUnknownInline(originalTag: string, rawXml: string): LitNode {
  return { type: NODE_TYPES.UNKNOWN_INLINE, attrs: { originalTag }, rawXml }
}
