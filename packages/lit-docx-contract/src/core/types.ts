import type { XmlElement } from '../ooxml/element.js'
import type { ChartSourceRegistry, ChartSourceLimits } from '../chart-source/types.js'
/**
 * 公共类型定义
 * 汇集解析器、生成器及插件系统所使用的所有接口与类型，
 * 供 src/core 各模块及上层适配器共享。
 */

import type { LitNode, LitMark } from './ast.js'

/** 通用 XML 元素，由 fast-xml-parser 解析后的原始对象 */
export type { XmlElement }

// ── 编号定义（列表层级映射）──────────────────────────────────────────

/** OOXML 编号定义，将 numId 映射到抽象编号 */
export interface NumberingDefinitions {
  /** numId → 编号实例（w:num） */
  nums: Map<string, NumInstance>
  /** abstractNumId → 抽象编号定义（w:abstractNum） */
  abstractNums: Map<string, AbstractNum>
}

/** 段落缩进属性，来自 w:ind。物理字段单位为 twips，Chars 字段为字符百分数。 */
export interface ParagraphIndent {
  /** 左/正文前缩进，twips */
  left?: number
  /** 左/正文前缩进，字符百分数 */
  leftChars?: number
  /** 右/正文后缩进，twips */
  right?: number
  /** 右/正文后缩进，字符百分数 */
  rightChars?: number
  /** 首行缩进，twips */
  firstLine?: number
  /** 首行缩进，字符百分数 */
  firstLineChars?: number
  /** 悬挂缩进，twips */
  hanging?: number
  /** 悬挂缩进，字符百分数 */
  hangingChars?: number
}

/** 编号层级段落属性，来自 w:lvl/w:pPr。 */
export interface NumberingLevelParagraphProperties {
  /** 显式层级制表位，位置使用 twips。 */
  tabs?: Array<{
    /** OOXML 制表位对齐或清除方式。 */
    val: string
    /** 从段落逻辑起点计量的 twips 位置。 */
    pos: number
    /** 可选前导符。 */
    leader?: string
  }>

  /** 编号层级缩进，来自 w:lvl/w:pPr/w:ind。 */
  indent?: ParagraphIndent
}

/** 编号标记的显式字体槽。 */
export interface NumberingLevelMarkerFonts {
  /** Latin ASCII 字体。 */
  ascii?: string
  /** High ANSI 字体。 */
  hAnsi?: string
  /** 东亚字体。 */
  eastAsia?: string
  /** 复杂文字字体。 */
  cs?: string
  /** ASCII 主题字体引用。 */
  asciiTheme?: string
  /** High ANSI 主题字体引用。 */
  hAnsiTheme?: string
  /** 东亚主题字体引用。 */
  eastAsiaTheme?: string
  /** 复杂文字主题字体引用。 */
  cstheme?: string
  /** OOXML 字符槽提示。 */
  hint?: string
}

/** 编号标记的显式语言槽。 */
export interface NumberingLevelMarkerLanguage {
  /** 默认文字语言。 */
  val?: string
  /** 东亚文字语言。 */
  eastAsia?: string
  /** 双向文字语言。 */
  bidi?: string
}

/** 编号标记的结构化 run properties。 */
export interface NumberingLevelRunProperties {
  /** 显式字体槽。 */
  fonts?: NumberingLevelMarkerFonts
  /** 普通文字字号，例如 `12pt`。 */
  fontSize?: string
  /** 复杂文字字号，例如 `12pt`。 */
  fontSizeComplexScript?: string
  /** 普通文字粗体。 */
  bold?: boolean
  /** 复杂文字粗体。 */
  boldComplexScript?: boolean
  /** 普通文字斜体。 */
  italic?: boolean
  /** 复杂文字斜体。 */
  italicComplexScript?: boolean
  /** 删除线。 */
  strike?: boolean
  /** 六位 RGB 或 `auto` 颜色。 */
  color?: string
  /** 单下划线开关。 */
  underline?: boolean
  /** 显式编号标记语言槽。 */
  language?: NumberingLevelMarkerLanguage
}

/** Numbering reconstruction mode: nested lists (default) or Word-style flat numbered paragraphs. */
export type NumberingParseMode = 'nested-lists' | 'flat-numbered-paragraphs'

/** 抽象编号：每个层级的格式、文本模板和起始值 */
export interface AbstractNum {
  /** ilvl（层级，0 起）→ 该层级的编号配置 */
  levels: Map<number, NumberingLevelDefinition>
  /** 编号模板类型，如 singleLevel / multilevel / hybridMultilevel */
  multiLevelType?: string
  /** 与该抽象编号关联的段落样式 ID */
  styleLink?: string
  /** 与该抽象编号关联的编号样式 ID */
  numStyleLink?: string
  /** Word 使用的编号签名 ID */
  nsid?: string
  /** Word 使用的模板 ID */
  tmpl?: string
  /** 未建模的原始抽象编号数据 */
  raw?: Record<string, any>
}

/** 单个编号层级定义 */
export interface NumberingLevelDefinition {
  /** 编号格式 ST_NumberFormat，如 'decimal' / 'bullet' / 'chineseCounting' */
  numFmt: string
  /** Office 2010 自定义编号表达式，来自 w:numFmt/@w:format */
  numFmtFormat?: string
  /** 列表项文字模板，如 "%1." */
  lvlText: string
  /** 该层级的起始序号 */
  start: number
  /** 重启编号行为：0 表示永不重启，正数表示在指定层级变化时重启 */
  lvlRestart?: number
  /** 是否使用法律编号，引用上级编号时强制按 decimal 显示 */
  isLegal?: boolean
  /** 编号后缀行为：制表、空格或无后缀 */
  suffix?: 'tab' | 'space' | 'nothing'
  /** 编号标记对齐方式 */
  justification?: string
  /** 该层级绑定的段落样式 ID */
  paragraphStyleId?: string
  /** 结构化编号层级段落属性，来自 w:lvl/w:pPr */
  paragraphProperties?: NumberingLevelParagraphProperties
  /** 结构化编号标记属性，用于精确生成 w:lvl/w:rPr。 */
  runProperties?: NumberingLevelRunProperties
  /** 原始 w:pPr 子树，用于后续无损导出 */
  paragraphPropertiesRaw?: any
  /** 原始 w:rPr 子树，用于后续无损导出 */
  runPropertiesRaw?: any
  /** 未建模的原始层级数据 */
  raw?: Record<string, any>
}

/** 编号层级覆盖定义，来自 w:lvlOverride */
export interface NumberingLevelOverride extends Partial<NumberingLevelDefinition> {
  /** 覆盖后的起始序号 */
  start?: number
}

/** 编号实例：numId 映射到抽象编号，并可携带层级覆盖 */
export interface NumInstance {
  /** 引用的抽象编号 ID（w:abstractNumId） */
  abstractNumId: string
  /** 层级覆盖映射（ilvl → 覆盖定义），来自 w:lvlOverride */
  lvlOverrides?: Map<number, NumberingLevelOverride>
  /** 未建模的原始编号实例数据 */
  raw?: Record<string, any>
}

// ── 样式定义 ────────────────────────────────────────────────────────

/** 文档级样式表，通过 styleId 快速查找 */
export interface StyleDefinitions {
  /** styleId → 样式定义 */
  styles: Map<string, StyleDef>
  /** `w:docDefaults/w:rPrDefault/w:rPr` 的直接 run 属性。 */
  defaultRunProperties?: Record<string, any>
  /** `w:docDefaults/w:pPrDefault/w:pPr` 的直接段落属性，与 Normal 样式独立。 */
  defaultParagraphProperties?: Record<string, any>
}

/** Style-owned property family carrying one OOXML change envelope. */
export type StyleDefinitionPropertyRevisionKind =
  | 'paragraph-properties'
  | 'run-properties'

/** One typed style-property revision member from `/word/styles.xml`. */
export interface StyleDefinitionPropertyRevision {
  /** Fixed package part owning the annotation id namespace. */
  partName: '/word/styles.xml'
  /** Paragraph or run property family changed by this member. */
  kind: StyleDefinitionPropertyRevisionKind
  /** Producer `w:id`, or null when malformed source omitted it. */
  sourceId: string | null
  /** Producer `w:author`, or an empty string when omitted. */
  reviewerName: string
  /** Producer `w:date`, or null when omitted. */
  createdAt: string | null
  /** Current owner properties with the change envelope excluded. */
  currentProperties: Readonly<Record<string, unknown>>
  /** Previous properties stored inside the change envelope. */
  previousProperties: Readonly<Record<string, unknown>>
  /** Original preserve-order change element for lossless source retention. */
  rawChange: XmlElement
}

/** 表格样式或条件区域中与表格实例同形的类型化属性。 */
export interface TableStyleTypedProperties {
  /** 表格属性（与表格节点 attrs 同形，如 borders、defaultCellMargins、styleBandSize） */
  table?: Record<string, unknown>
  /** 行属性（与表格行节点 attrs 同形） */
  row?: Record<string, unknown>
  /** 单元格属性（与单元格节点 attrs 同形，如 borders、shading、vAlign、cellMargins） */
  cell?: Record<string, unknown>
}

/** 表格样式中一个条件区域（w:tblStylePr）。 */
export interface TableStyleCondition extends TableStyleTypedProperties {
  /** 条件区域类型（ST_TblStyleOverrideType），如 firstRow、band1Horz。 */
  type: string
  /** 区域段落属性（w:pPr 的原始解析对象） */
  pPr?: Record<string, any>
  /** 区域字符属性（w:rPr 的原始解析对象） */
  rPr?: Record<string, any>
}

/** 单条样式定义，包含段落、字符和表格属性。 */
export interface StyleDef {
  /** 样式 ID（w:styleId），文档内唯一标识 */
  styleId: string
  /** OOXML 样式类型，例如 paragraph / character / table。 */
  styleType?: string
  /** 样式显示名称（w:name） */
  name: string
  /** 是否是该样式类型的默认样式。 */
  default?: boolean
  /** 是否由用户或生产者定义为自定义样式。 */
  customStyle?: boolean
  /** 继承自哪个基础样式 */
  basedOn?: string
  /** 新段落延续使用的样式 ID。 */
  next?: string
  /** 关联字符样式 ID。 */
  link?: string
  /** 快速样式图库顺序。 */
  uiPriority?: number
  /** 是否进入快速样式图库。 */
  quickFormat?: boolean
  /** 是否隐藏样式。 */
  hidden?: boolean
  /** 是否在使用前保持半隐藏。 */
  semiHidden?: boolean
  /** 使用后是否取消隐藏。 */
  unhideWhenUsed?: boolean
  /** 是否锁定样式编辑。 */
  locked?: boolean
  /** 段落属性（w:pPr 的原始解析对象） */
  pPr?: Record<string, any>
  /** 字符属性（w:rPr 的原始解析对象） */
  rPr?: Record<string, any>
  /** 表格属性（w:tblPr 的原始解析对象） */
  tblPr?: Record<string, any>
  /** 表格样式基线的类型化表格、行、单元格属性 */
  tableStyleProperties?: TableStyleTypedProperties
  /** 表格样式条件格式（w:tblStylePr），保持来源顺序 */
  tableStyleConditions?: TableStyleCondition[]
  /** Typed property-change members owned by this style definition. */
  propertyRevisions?: readonly StyleDefinitionPropertyRevision[]
}

// ── 关系与媒体 ───────────────────────────────────────────────────────

/** OOXML .rels 文件中的关系映射，rId → 类型与目标路径 */
export interface Relationships {
  /** rId → 关系信息：type 为关系类型 URI，target 为目标路径，targetMode 区分内部/外部（External） */
  rels: Map<string, { type: string; target: string; targetMode?: string }>
}

/** 媒体文件条目，包含二进制数据、MIME 类型和文件名 */
export interface MediaEntry {
  /** 媒体文件的二进制数据 */
  data: Uint8Array
  /** MIME 类型，如 'image/png' */
  contentType: string
  /** 文件名（含扩展名），如 'image1.png' */
  fileName: string
}

// ── 脚注/尾注数据 ───────────────────────────────────────────────────

/** 脚注/尾注的结构化数据 */
export interface FootnoteData {
  /** 脚注/尾注 ID */
  id: string
  /** 脚注/尾注正文的 AST 节点列表 */
  content: LitNode[]
}

// ── 批注数据 ─────────────────────────────────────────────────────────

/** 文档批注的结构化数据 */
export interface CommentData {
  /** 批注 ID（w:comment 的 w:id） */
  id: string
  /** 批注作者 */
  author: string
  /** 批注作者缩写。 */
  initials?: string | undefined
  /** 批注创建时间（ISO 8601 字符串） */
  date: string
  /** 批注正文的 AST 节点列表 */
  content: LitNode[]
  /** 批注正文最后一个段落的稳定 paraId。 */
  paraId?: string | undefined
  /** 回复所引用的父批注 ID。 */
  parentId?: string | undefined
  /** 线程是否已解决。 */
  resolved?: boolean | undefined
  /** Office 2016+ durable comment identity。 */
  durableId?: string | undefined
  /** Office 2021+ UTC 时间。 */
  dateUtc?: string | undefined
  /** 人员目录中的稳定用户 ID。 */
  userId?: string | undefined
  /** 人员目录中的身份提供方 ID。 */
  providerId?: string | undefined
  /** Parser-approved modern-part payload retained outside modeled fields. */
  preservation?: CommentModernExtensionPreservation | undefined
}

/** One source entry retained from a modern Word comment metadata part. */
export interface CommentExtensionEntryPreservation {
  /** Attributes from the package-part root, including producer namespaces. */
  readonly rootAttributes?: Readonly<Record<string, string>> | undefined
  /** Unsupported direct root children that are not modeled comment entries. */
  readonly rootChildren?: readonly XmlElement[] | undefined
  /** Unsupported attributes from the message-owned entry. */
  readonly entryAttributes?: Readonly<Record<string, string>> | undefined
  /** Unsupported children from the message-owned entry. */
  readonly entryChildren?: readonly XmlElement[] | undefined
}

/** Selective preservation envelope for one modeled comment message. */
export interface CommentModernExtensionPreservation {
  /** Preservation owned by the matching commentsExtended.xml entry. */
  readonly commentsExtended?: CommentExtensionEntryPreservation | undefined
  /** Preservation owned by the matching commentsIds.xml entry. */
  readonly commentsIds?: CommentExtensionEntryPreservation | undefined
  /** Preservation owned by the matching commentsExtensible.xml entry. */
  readonly commentsExtensible?: CommentExtensionEntryPreservation | undefined
  /** Preservation owned by the matching people.xml person entry. */
  readonly people?: CommentExtensionEntryPreservation | undefined
}

/** 可选的现代 Word 批注扩展部件。 */
export interface CommentExtensionXmlParts {
  /** word/commentsExtended.xml。 */
  commentsExtendedXml?: string | null | undefined
  /** word/commentsIds.xml。 */
  commentsIdsXml?: string | null | undefined
  /** word/commentsExtensible.xml。 */
  commentsExtensibleXml?: string | null | undefined
  /** word/people.xml。 */
  peopleXml?: string | null | undefined
}

// ── 解析选项与结果 ───────────────────────────────────────────────────

/** Options accepted by `parseDocx`. */
export interface ParseOptions {
  /** Keeps unrecognized elements as `unknownBlock` / `unknownInline` nodes with their original XML in `rawXml`; only an explicit `false` drops them. */
  preserveRawXml?: boolean
  /** Extra parser plugins, consulted after the built-in plugins. */
  plugins?: ParserPlugin[]
  /** Bounds for opaque chart source dependencies; overflow rejects import. */
  chartSourceLimits?: ChartSourceLimits
  /** Numbering reconstruction: nested `list` / `listItem` nodes (default) or Word-style flat numbered paragraphs. */
  numberingMode?: NumberingParseMode
  /** Malformed complex-field tokens are kept with a warning (`best-effort`, default) or reject the current story (`strict`). */
  malformedFieldMode?: 'best-effort' | 'strict'
}

/** Result of `parseDocx`: the document tree and every non-fatal problem found while reading it. */
export interface ParseResult {
  /** LitAST root, a `document` node; package-level data such as raw parts and comments lives in `ast.meta`. */
  ast: LitNode
  /** Non-fatal problems; content that triggered them is kept where possible. */
  warnings: ParseWarning[]
}

/** One non-fatal problem found while parsing. */
export interface ParseWarning {
  /** Stable code for programmatic handling. */
  code: string
  /** Human-readable explanation. */
  message: string
  /** XML path or description of where the problem occurred. */
  location?: string
  /** Tag name of the element that triggered the warning. */
  element?: string
}

// ── 解析上下文（解析器内部共享状态）────────────────────────────────

/**
 * 解析上下文，在整个解析过程中跨函数传递。
 * 包含递归解析子节点的帮助函数、各类定义表及选项。
 */
export interface ParseContext {
  /** Captures detached XML references using the explicitly named source part. */
  preserveXmlRelationships?: (element: XmlElement, sourcePart: string) => XmlElement
  /** Immutable opaque chart graph captured before story parsing. */
  chartSourceRegistry?: ChartSourceRegistry
  /** 递归解析 XML 子元素，返回 LitNode 数组 */
  parseChildren: (element: XmlElement) => LitNode[]
  /** 将运行属性（rPr）转换为 LitMark 数组 */
  parseRunProperties: (rPr: XmlElement) => LitMark[]
  /** 文档编号定义表 */
  numbering: NumberingDefinitions
  /** 文档样式表 */
  styles: StyleDefinitions
  /** document.xml 的关系映射 */
  relationships: Relationships
  /** 媒体文件表（路径 → 媒体条目） */
  media: Map<string, MediaEntry>
  /** 已解析的批注列表 */
  comments: CommentData[]
  /** 解析入口选项 */
  options: ParseOptions
  /** 累积的解析警告列表 */
  warnings: ParseWarning[]
  /** 解析样式继承链，返回合并后的样式定义 */
  resolveStyle: (styleId: string) => StyleDef | undefined
  /** 追加一条解析警告 */
  addWarning: (code: string, message: string, location?: string, element?: string) => void
  /** 页眉 XML 文件映射（文件名 → XML 字符串） */
  headerXmls?: Map<string, string>
  /** 页脚 XML 文件映射（文件名 → XML 字符串） */
  footerXmls?: Map<string, string>
  /** 页眉/页脚各自的关系映射（键为文件名如 "header1.xml"） */
  headerFooterRels?: Map<string, Relationships>
}

// ── 解析插件接口 ─────────────────────────────────────────────────────

/**
 * 解析器插件接口，用于扩展对自定义 XML 标签的处理。
 * priority 越大越优先匹配，默认为 0。
 */
export interface ParserPlugin {
  /** 插件名称（用于调试/去重） */
  name: string
  /** 匹配优先级，越大越优先，默认 0 */
  priority?: number
  /** 根据标签名、元素内容和文档级解析权威决定是否由此插件处理 */
  match: (tagName: string, element: XmlElement, context: ParseContext) => boolean
  /** 将 XML 元素转换为一个或多个 LitNode，返回 null 表示跳过 */
  parse: (element: XmlElement, context: ParseContext) => LitNode | LitNode[] | null
  /**
   * 在一个完整 package Story 解析完成后执行只读校验或派生诊断。
   * 主文档与辅助 Story 分别调用，插件不得跨 Story 假设 id 唯一。
   */
  complete?: (root: LitNode, context: ParseContext) => void
}
