# @quirekit/lit-doc

QuireKit 自有的 TypeScript 旧版 Word 二进制读取与基础转换库，支持 Node 和浏览器模块 Worker，按 MIT 发布。
读取与投影代码不依赖原生转换引擎；`lit-docx-contract` 仅作类型依赖。DOCX 编译/解析运行时由宿主注入，沿用其自身许可。

**当前提供源检查与实验性的 DOC → typed OOXML → DOCX → LitAST 转换。** 基础转换保留正文、空段、
已准入的字符/段落直接字段、命名样式和显式页面属性。表格投影统一网格、尺寸与横/纵合并，完整样式仍有限制；
编号已投影定义、实例、层级及起点覆盖，共享计数与完整呈现仍有限制。正文与页眉页脚的内联图片、普通顶层浮动图片支持有界媒体提取和 DrawingML 投影；浮动图片保留独立双轴位置、基本环绕和层级，轮廓环绕明确近似。页眉页脚保留六种变体、分节继承与显式空段，浮动表格保留独立位置与重叠规则，完整绕排、其他辅助 story、复杂对象和完整 DOP 设置继续单列边界。Classic 基础接入由原创中文样本验收，编号另由原生 1/0 起点样本验证编辑往返，表格尺寸与横/纵拆分、PNG/JPEG 图片元数据及尺寸另有实际 Classic 历史和导出验证。
源检查中的原始文字保留控制码元，不能直接用作纯文本或可编辑文档。

## Node / 同步读取

```ts
import { readFile } from 'node:fs/promises'
import { inspectDoc, DocReadError } from '@quirekit/lit-doc'

try {
  const source = inspectDoc(await readFile('legacy.doc'))
  console.log(source.scope, source.pieces, source.stories, source.diagnostics)
} catch (error) {
  if (error instanceof DocReadError) console.error(error.code, error.message)
  else throw error
}
```

输入为 `Uint8Array`，文件获取由调用方负责。CP 区间按 UTF-16 码元计数，右边界不包含；
片段字节位置相对 `WordDocument` 流。BOM、孤立代理项与控制码元原样保留。
调用方的字节不会被修改或转移。

由 DIFAT 明确定位的 FAT 扇区若将自身标记写为 `ENDOFCHAIN`，读取器记录
`fat-sector-end-marker` 并保留元数据独占。目录与用户流的共享扇区、循环、越界及错误链长
仍会拒绝。源文字通过检查后，段落格式与完整转换分别执行各自的校验。

根目录在 slot 0/type 5、无兄弟及分配结构均通过后，允许忽略有效长度内的非标准根标签，
报告 `root-label-ignored`。标签不用于流名查找，诊断不包含原始路径；普通成员名称的
终止符、非法字符、重复名称与父级隔离仍须通过。

## 浮动绘图源检查

`inspectDoc(bytes, { includeDrawings: true })` 返回 `drawings` 源图：两part原锚点、带标签
的正文/页眉绘图、组所属关系、原始形状类型/标志、各层属性与全局缺省。标签顺序不代表
所属part，页眉CP转换到共同源坐标；未定义的PLC终点以原相对值独立保留。原twip矩形、
负值、fBid/fComplex、复杂属性字节和数组头不提前归一化。缺目录与存在的空组有区别。
媒体库存的原声明数 `mediaDeclaredCount` 与实际记录数 `mediaCount` 分开保留，差异报兼容诊断。

该选项不隐含全文格式或媒体解码。`OfficeArtProperty.complex` 是独立 `Uint8Array`，真实
Worker返回同一完整源图；它不是可编辑LitAST、OOXML原始保全或可直接JSON持久化的合同。
水印文字源条件不代表艺术字/水印呈现；普通浮动图片及其余对象的转换按
[独立实施范围](../../docs/changes/legacy-doc-import/floating-drawings.zh-CN.md)准入。

锚点与形状分别受 `maxDrawings` 限制，默认10,000、硬上限100,000；容器深度
`maxDrawingDepth` 为64/256，累计复杂属性复制 `maxDrawingPropertyBytes` 为8/64MiB。
内联图片共享同一OfficeArt记录/属性读取及复杂字节上限；记录与属性工作另计入共享
`maxPropertyOperations`。预算和结构错误明确失败，不替换为空绘图成功。

## 文本框源检查

`inspectDoc(bytes, { includeTextboxes: true })` 返回独立的 `textboxes` 源索引。正文与页眉
两个 part 各自保留 FTXBXS 文本链、BKD 显示分片、原相对 CP、完整标志、形状标识及
未使用终点；文字仍在原 `text` 中存储一次。最后的 FTXBXS 始终为备用槽，即使其原标志
为零，超出当前子文档的备用终点也不当作显示文字。缺表与存在的空表分别保留。

该选项不隐含格式、绘图或媒体解码，不创建 LitAST 或 Classic Story。两种表及两个 part
共享 `maxTextboxEntries`，默认 10,000、硬上限 100,000，并消耗共享属性工作预算。
`textbox-formatting-unresolved` 明确说明源索引不包含有效格式、显示链执行或原生对象；普通框转换另按下述范围准入。
Node 与真实 Worker 验证全部字段、输入保留及预算，旧 Worker 缺少请求结果会明确失败。

`pnpm doc:textboxes:source` 对全部 558 份原件进行独立 POI 全表比对及真实 Worker 验证：
414 份一致、139 份源拒绝、5 份参考不可确认，零差异。50 份含文本框子文档的原件中
48 份可读，共 804 个链描述和 804 个显示分片；该源检查结果不代表转换或最终版面。

## 普通文本框转换

正文和页眉中的普通顶层矩形文本框，按原 CP/FSPA、ClientTextbox/lTxid 与 FTXBXS owner
精确关联。单框链的完整段落、作者空段、表格、字符/段落格式、共享样式/编号及普通域，
复用既有 Story 转换，进入 DrawingML、LitAST `textBox` 和 Classic 独立 owned Story。
保护 CR、备用槽及未知显示缓存不变成作者文字，也不按形状出现顺序猜配对。
下一形状回指自身时，仅在原 FTX 为单框、框序号为零、活动文字 owner 与 FSPA 唯一时
兼容，报 `textbox-self-link-variant`；不建立循环或擅自拆开真实链接框。

框保留创建尺寸、独立双轴位置、基本环绕/距离/层级、旋转/翻转、直接 RGB 实色/无填充、
普通线条、四边距、水平换行、垂直对齐及 fit-shape-to-text。锚点锁作为安全绘图元数据
经 JSON 与新包继续保全，不扩展 Classic 锁定命令。内联图片沿原部件资源 owner 原子安装；
失败的文字框不留下图片关系，预算错误仍失败。形状角色只在源索引建立时分类一次。
旧 SHAPE 域外壳按成熟对象消费方式明确规范化，报 `legacy-shape-field-normalized` 损失；
其显示绘图继续进入独立对象与文字 owner，避免封装为不可编辑的普通域缓存。

普通矩形文字框与图片的轴对齐组合复用同一解释器，保留原父链、嵌套物理位置、文字
身份及原媒体。初次 DOCX 保留原生 `wpg` 组合；LitAST/Classic 沿既有合同拆为独立可编辑
对象，并报告组合关系不会在新导出中保留。整组预检失败不认领文字，也不安装部分媒体。
叶子比例锁独立于父组，后续编辑不会被旧 XML 保全值覆盖。

跨段/域内/组合内链接框、旋转/反射组合、剪切、未解释的组内形状、竖排/旋转文字、自动边距、复杂/主题填充、效果及原位置非法值继续
明确拒绝或记录未投影字段；轮廓环绕报矩形近似。严格模式按明确损失拒绝，不伪造全保真。
文本框目录、绘图出现次数、格式/表格/媒体和输出分别使用既有共享预算。

`pnpm doc:textboxes:content` 固定全部 50 份文本框原件，46 份可转换、4 份源拒绝。
20 份输出 40 个原生框，原身份和框属性均独立一致，38 个完整文字、表格结构、
域指令/缓存独立一致。另两个含图片控制符的框暂不计完整内容准入；其媒体源摘要及
Classic 编辑/历史/导出重开保全已核对。40框的原身份与内容边界逐项锁为准入。
两种 raw 选项、JSON **强制清除整框 rawXml** 后生成新包及全部 50 份真实 Worker 通过。
域指令比较只忽略生成器补齐的两端 ASCII 空格，内部/引号空格、flags 和缓存保持精确。
46 份可转换原件另有 560 条源文字链未原生投影（其中 Bug61268 占 482 条），
仍明确诊断，不从分母删除；不宣称全部文本框、生产者或最终版面。

八份实际原件通过 Classic 框内文字/表格编辑、移动、完整历史与独立新包重开。
Canvas/SVG 验证真实文件菜单、专用 Worker、普通文字及表格框的绘制、文字命中、输入、
完整历史和实际导出重开。现有完整转换与图片准入分别复核，不能用框数量代替旧能力验证。

## 链接文本框的数据转换

同一个完整段落中、域外的普通独立锚定文字框链，校验原高位作者槽、低位连续序号、
精确后继、唯一形状/FSPA 及 FTXBX 首框 owner。所有框和作者内容预检成功后，才认领
一份作者正文并安装媒体；输出仍位于每框原 CP。首框使用 `wps:txbx(id)`，后继使用
`wps:linkedTxbx(id,seq)`，不会重复正文或将源显示缓存当作排版结果。
规范链长必须一致；原生生产者的 count=1 变体仅在完整图证明多框时接纳，并报告
`textbox-chain-count-variant`。

LitAST `textBox.attrs.textBoxLink` 保存 `{ chainId, sequence }`；只有序号零拥有作者
children。JSON 与清除 raw XML 后的原生导出保持同一链、各框属性及一份最新正文。
缺首框、重复/跳跃序号、后继拥有正文、跨 Story 或未覆盖链扩展明确拒绝。
Classic 保全该语义关系，支持首框正文编辑和各框几何编辑及完整历史；当前文字仍只在
首框独立排版，不会流入后继，导入明确报 `drawing-linked-textbox-flow-unavailable`。

`pnpm doc:textboxes:links:produce --seed <固定 ODT> --soffice <原生程序> --corpus <外部目录>`
从固定公开原件的有效框样式生成自有两框/三框、六段中英文原生 DOC；生产者摘要与生成
文件哈希写入外部清单。`pnpm doc:textboxes:links` 独立核对五个框的源图/几何及两份完整
作者正文，验证两种 raw/JSON 新包与真实 Worker。它们不加入固定 558 份分母。
Classic 两份原件的新包与 Canvas/SVG 真实导入、点击输入、历史及导出重开有单独回归。
固定 LibreOffice 重开本批纯 WPS 输出时保留框和完整正文，但未恢复文字流；Word 原生
重开、VML 回退与多应用版面对照仍未准入，不以结构通过宣称排版保真。

## DOCX 与 LitAST 基础转换

```ts
import * as runtime from '@quirekit/lit-docx'
import { convertDocToDocx, parseDoc, DocConversionError } from '@quirekit/lit-doc/conversion'

// 默认尽力转换，调用方通过报告查看具体损失和恢复等级。
const converted = await convertDocToDocx(bytes, runtime)
console.log(converted.docx, converted.report)
const parsed = await parseDoc(bytes, runtime, {
  lossPolicy: 'best-effort',
  parseOptions: { numberingMode: 'flat-numbered-paragraphs', preserveRawXml: true },
})
console.log(parsed.ast, parsed.warnings, parsed.report)
```

`createDocxSourcePlan(bytes, options)` 只生成统一合同中的 typed package graph，不依赖 ZIP writer。
同一源解析器保留样式定义、四字体槽和实际直接字段；不会把全部派生格式铺成直接属性。
`convertDocToDocx` 复用注入运行时的关系分配/打包，`parseDoc` 再调用同一运行时的 `parseDocx`。
`@quirekit/lit-docx` 是独立商业组件，本包 MIT 不改变该运行时的授权。

默认 `lossPolicy: 'best-effort'` 先执行完整转换。已准入的格式、表格、普通域和对象继续使用
各自的投影与局部损失策略。无关容器流损坏时，优先取得正文和 FIB 选定表流，再审计其余流，
以 `cfb-unreadable-streams-omitted` 报告省略。显式 `strict` 继续完整预检源流，已知省略或
近似会抛出携带完整报告的 `DocConversionError`。

默认路径兼容有界的 CFB 分配计数、元数据标记、目录链接/名称和实际流前缀，v3 目录末项只缺
未使用的长度高位时可继续读取。FIB 已知 locator 前缀和无效 cbMac 使用实际字节验证。
CLX 损坏时仅保留首个连续可读的主 Story 区间，`report.recovery.mainStoryRange` 记录原始
CP 起止位置，缺失字符省略并报告。缺失开头且无法确定域显示归属时继续返回具体错误。

源文字的实际区间验证后，局部格式页、样式、表格、域或对象记录失败可触发一次
普通正文恢复。`report.recovery.level` 为 `text`，`cause` 保留原错误码。
恢复产物保留正文文字顺序、空段、tab 和手动换行，表格和分节扁平化为普通段落，
样式、图片及辅助 Story 的省略均记为损失。字段指令和有效索引标记的私有缓存省略，索引损坏时所有字段
缓存省略，字段归属歧义之后的尾部明确省略。完整字符运行可用时省略隐藏/删除文字，保留
插入文字并报告修订扁平化；运行本身不可读时，`unresolvedTextSemantics` 标明隐藏格式和
修订状态未解析，恢复产物属于存储正文。`unmeasuredSourceCounts` 列出未知源计数，其数字
槽为零。原始文件继续由调用方保存。

`inspectDoc` 及下文的源记录校验保持独立的严格合同。尽力转换对上述局部失败使用明确恢复
策略。无法取得核心正文、加密输入、不支持的格式/版本、预算耗尽或取消继续返回具体错误。
密码与解密 API 仍待实现。非预期程序异常和宿主 writer/parser 错误继续向调用方传播。恢复与完整尝试共用输出
预算，非法 XML 字符替换为 U+FFFD 并报告损失。完整映射与正文恢复分开统计，详见
[内容优先验收](../../docs/changes/legacy-doc-import/content-recovery.zh-CN.md)。

报告分开列出 `loss`、`approximation`、`host-limit` 与兼容决定。重复问题按字段/权威汇总，
`occurrences` 保留次数及首次 CP。`source.codeUnits` 计完整源存储，`paragraphs`、`characterRuns`、`tables`
继续表示正文计数，页眉页脚的原始槽和范围通过 `includeHeaderFooters` 查询。样式、字体与分节按文档计数。
`host-limit` 表示 OOXML 保留成功但 LitAST/Classic 呈现尚有限制，例如逻辑 start/end 和直接 hAnsi 字体槽。
旧 `sprmCCpg`（`0x486B`）按完整双字节操作数读取，其未知语义记入 `source-properties-unprojected`。
源文字采用既有 FcCompressed/UTF-16 规则，字符重置保留未投影诊断，严格策略按损失报告拒绝。
输出上限为元素/属性 500,000（硬上限 2,000,000）、累计 XML 码元 16 Mi（64 Mi）、
报告条目 1,000（10,000）；用 `outputLimits` 降低或在硬上限内提高，溢出明确失败。

## 普通复杂域转换

普通域保留 begin/separate/end、原指令及其 run 格式、文字缓存、无 separator 形态、嵌套
指令与跨段结果。任意祖先仍在代码区时使用 instrText，子域的缓存保持独立；跨段结果保留
原段落、空段和完整表格流。已有 LitAST、lit-docx 和 Classic 域模型承担持久化与编辑。
源 end 的 locked 映射为 begin 的 fldLock，保留显式 false；DOC 编辑/格式状态不猜测为
OOXML dirty，未映射状态报告损失。有实际数据的私有结果报 `unsupported-field`；空结果
保留并报告私有状态未映射。坏配对报 `invalid-field-data`，跨 cell/Story 及指令跨段明确拒绝。

FORMTEXT/FORMCHECKBOX/FORMDROPDOWN、EMBED/LINK 属于未接入的资源域。尽力模式报告
`field-resource-unprojected`，原子省略其代码和标记，保留显示结果并沿已有图片/note 准入，
防止绕过 Classic 媒体边界；严格模式因该损失拒绝。其他指令资源控制明确报告省略。
普通域的非文字缓存、表单数据/宏、OLE 编辑、复杂引用依赖与完整重算仍须单独准入。

17 份固定原件中 13 份可转换、4 份因独立格式边界拒绝。97 条源域中，32 条普通域按声明的
指令控制损失策略独立对照指令、缓存、separator 和 locked；65 条资源域仍明确未建模。
六组结构向量经过两种 raw 保留选项、JSON 和新包重开；嵌套向量通过完整 Worker 生命周期。
五项 Classic 验证覆盖原件锁定、代码编辑、嵌套子域、表格结果编辑及完整撤销/重做。

## 书签范围转换

标准书签按名称/起点表与独立终点表的显式索引配对，保留名称大小写、隐藏前缀、空范围、
交叉范围、跨段和完整表格流。边界在原 CP 处切 run，原字符格式不变；标记属于段落子节点。
表格列范围映射为 colFirst/colLast 并往返保留，列矩形导航另报宿主限制。临时 `_GoBack`
明确省略；源 fNative 保存提示未映射时报告损失，仍保留命名引用目标。

独立实际 Story、代理对中间、未输出的结构 CP 和域代码区边界不能产生半对标记：未准入范围
整对省略并报告。域缓存内锚点经既有富结果保存，Classic 全局导航和引用读取另报宿主限制。
普通范围可由既有 Classic 书签命令和 REF 上下文读取；本批没有新增 PAGEREF 页码重算。

源检查可调用 `inspectDoc(bytes, { includeBookmarks: true })`，Worker 接口接受同一选项。
`bookmarks.scope` 为 `bookmark-source`，entries 保留绝对 UTF-16 CP、原始 BKC、终点索引和
列区间；不隐含字符格式。maxBookmarks 默认 10000，硬上限 0x3FFC，坏计数、重复终点索引、
逆序和截断报 `invalid-bookmark-data`。仅检查源文字时不解析此可选索引。

原始 POI pageref.doc 的四条源断言通过 Node 与真实 Worker；三种替换及整对删除合同经
Classic 完整历史与独立导出验证。原始 DOC 坐标与编辑器坐标分开，按已声明的指令资源省略
核对范围变化。更多语料计数与未验证目标见[书签验收](../../docs/changes/legacy-doc-import/bookmark-ranges.zh-CN.md)。

## 批注转换与源索引

转换保留作者、原始缩写、点/范围、完整段落/空段、表格、列表与普通域正文，复用已有
OOXML、LitAST 与 Classic 批注/消息 Story。有效旧 DTTM 写成分钟精度的无时区 ISO 日期，
秒字段以 00 作载体；未知日期保持缺失，非法有效日期明确报损失，不补造当前时间或 UTC。
Classic 已补齐空缩写、父记录在回复之后的导入顺序，以及批注独有编号实例的引用收集。

父子关系通过 commentsExtended 保留，线程使用根消息锚点；旧回复自己的引用/引用范围
明确报损失，不生成无法独立删除的回复锚点。任一消息、引用或范围端点未准入时整线程
省略，资源不会成为孤儿。源正文自标记保留在初始 DOCX；旧序号呈现/位置、墨迹与对象
选区的原生支持分别报告。源自标记缺失或位于前缀之后时不截掉作者文字。

`inspectDoc(bytes, { includeComments: true })` 及 Worker 可选返回 `comments.scope =
'comment-source'`，保留完整作者表、原始 tag/范围、消息绝对 CP、DTTM 与正负父偏移，
不隐含富正文格式。maxComments 默认 10000/硬上限 100000，maxCommentAuthors 为
10000/0x7FFF，maxCommentDepth 为 64/256；坏图报 `invalid-comment-data`，预算超限仍失败。

固定 19 份原件共 95 条源批注，94 条与独立 POI 一致，另一条参考不可读。实际转换有
19 份、95 条消息；其中 18 份的 94 条消息与 80 个范围独立匹配，1 份参考不可读。两种 raw、JSON 新部件与完整 Worker 通过；Classic 的编辑、回复、解决、删除及
完整历史/导出另行验证，详见[批注验收](../../docs/changes/legacy-doc-import/comment-stories.zh-CN.md)。

## 修订作者源表（可选）

`inspectDoc(bytes, { includeRevisionAuthors: true })` 及 Worker 返回
`revisionAuthors.scope = 'revision-author-source'`、`present` 与原顺序 `authors`。
缺表与存在的空表分开，重复、空串和空格姓名原样保留，不隐含段落或字符格式读取。
非标准首项保留并诊断；完整全零残留目录按已验证的 POI 行为读为空表并报告
`revision-author-empty-directory`，其他坏表报 `invalid-revision-data`。

`maxRevisionAuthors` 默认 10000/硬上限 65534；累计 UTF-16 的
`maxRevisionAuthorCodeUnits` 默认 1 Mi/硬上限 8 Mi，均在分配前检查。
三组 POI 原方法的 16 条断言及 558 份原件完整 Worker 通过；其中 416 份作者事实独立一致，
137 份源拒绝、5 份参考不可用。本接口只读取作者目录；正文修订使用下述独立源图与转换。

## 普通文字修订与正文源图

`inspectDoc(bytes, { includeRevisions: true })` 及 Worker 返回 `revisions.scope =
'main-story-revision-source'`，隐含正文段落/字符检查及作者目录。每个完整字符区间保留
最终插入/删除标志、两套作者索引、显式作者/日期来源、原始 DTTM、原因码与三个独立
保存会话。缺日期操作为 null；原 CP 包括段末，不能直接当成编辑器坐标。源检查保留原始
操作数，实际转换另要求活跃作者引用有效，缺表/越界引用报 `invalid-revision-data`。

转换把普通正文文字写成 ins/del，删除 payload 使用 delText 并保留空白；普通段末单独写入
pPr/rPr，复用现有 LitAST/Classic 修订载体。作者空串和空格原样保留；未知日期保持缺失，
有效日期使用分钟精度无时区 ISO 字符串，不补当前用户、当前时间或 UTC。字符 reset 保留
原审阅元数据，保存会话不当成业务修订 ID，也不按“同作者同分钟”猜测原修改分组。

双重标志、域/资源、分页/分栏控制、辅助 Story，以及表格/分节/最终段末等结构上下文
仍按原 owner 保留内容并明确报修订损失；属性修订和移动没有冒充普通 ins/del。
保存会话保留在初始 run 属性，LitAST/Classic 的编辑后持久化另报 host-limit，段末会话
属性尚未映射。未激活的作者/日期操作数保留在源检查中，不生成虚构审阅事件。

558 份原件中，322 份正文修订源事实与 POI 独立一致，172 份源拒绝、64 份参考不可用，
完整 Worker 一致。全部 12 份含修订原件均可转换并通过两种 raw、JSON
和新包重开。7 份可独立核对的原件匹配 20,767 个原审阅文字
码元与 260 个段末，10 个结构段末保持明确省略。Classic 另验证原件、完整决策和历史，
详见[文字修订验收](../../docs/changes/legacy-doc-import/text-revisions.zh-CN.md)。

## 旧编号样式与现代列表

命名样式的旧ilfo=2047不再作为现代LFO索引拖垮整份编号图。它在原样式owner处报告
`legacy-style-numbering-unprojected`损失，并写numId=0阻断错误继承；其余合法现代
引用、定义及覆盖继续完整投影。实际Story仍使用旧哨兵、负引用或现代实例缺失时，
保持原整图拒绝，严格转换不放宽。旧ANLD计数仍未投影。

`pnpm doc:numbering:styles`固定7份原件，4张现代图的97实例、193层级及362个活动
段落独立一致；Bug61268另有4实例/36层级的实际重建及往返，其POI样式重置参考仍
不可用。两种raw保留运行时Map重建编号部件，JSON保全新包与完整Worker通过。
Classic另补齐样式独占编号的导出选取，保留独立于段落重启/修订前状态的原始实例；
四份原件的编辑/完整历史/重开通过，72pt原项目符号的规范markerStyle和输出保持。
这些结果不宣称旧计数、完全共享计数或最终版面保真。

## 编号转换

转换保留源定义/实例关系，按实际 UTF-16 偏移转换模板，并保留格式、零起点、legal、restart、
后缀、对齐及完整/起点覆盖。层级段落和标记字符属性复用原有解释器；实际 direct 写入与
样式继承分开，不把编号前缀插入正文。未知格式不退成十进制，字面 `%1`–`%9` 歧义和
负引用逻辑缩进明确拒绝编号图；未覆盖属性报损失，共享计数和宿主字段缺口报 `host-limit`。

两份原生 Word 的 1/0 起点 DOC 经实际 DOCX 和独立 XWPF 对照，并通过 Classic 局部重启、
撤销/重做及导出再导入。全量图计数是投影观察，不表示全部编号格式、计数或版面已经保真。
具体边界见[编号投影](../../docs/changes/legacy-doc-import/numbering-ooxml.zh-CN.md)。

## 表格尺寸与合并转换

转换从原始行属性统一所有行的边坐标，保留物理网格、跨列、前后省略格、首选百分比/绝对
尺寸、行高、显式 false 和横/纵合并；首选宽度不覆盖实际网格。每个物理 continuation 格与
存储内容保留，Classic 以派生语义矩形编辑，拆分及撤销不抹掉源数据。

未知样式、边框/底纹/边距明确报损失；逻辑对齐、行级属性例外、省略格首选宽度以及非默认
文字方向、fitText/hideMark 保留但报告宿主限制。可选几何图若明确拒绝，尽力模式整表省略
几何并报告 `table-geometry-unprojected`，基础行格/文字仍保留；预算、核心拓扑和非预期异常
始终失败。独立验证与原生生产者边界见[表格转换](../../docs/changes/legacy-doc-import/table-geometry-ooxml.zh-CN.md)。

## 内联图片转换

正文或页眉页脚的 U+0001 与字符 locator 经 PICF、OfficeArt 和 BLIP 读取，保留 PNG/JPEG/TIFF 文件字节，
以及解压后的 EMF/WMF/PICT 字节。按源尺寸、缩放、裁剪、旋转、翻转和宽高比锁生成
DrawingML，保留名称和替代文字。共享源图片只登记一份媒体，每个出现位置使用独立绘图身份。
标准 zlib 解码使用随转换产物打包的 MIT 依赖 fflate 0.8.3。

已知图片源拒绝在尽力模式报告 `picture-unprojected`，保留相邻正文；严格模式拒绝。
图片数、单图和累计解码预算始终生效。未覆盖属性、边框、全局图形默认值及附加记录明确报损失。
累计预算还按重复引用次数核算媒体字节，约束 AST 与 Worker 传输的放大。
DIB及OLE等对象路径继续单独准入，普通浮动图片见下一节。矢量媒体通过 DOCX/AST 保存字节，Classic
的图片创作与浏览器解码目前验证 PNG/JPEG，其他格式报告 `picture-media-host-limit`。

固定 POI 原件验证字节、尺寸与替代文字，并验证实际包及全新 AST 导出。分数像素尺寸与包内
MIME 声明由 lit-docx 保留。独立断言及 Classic 范围见[内联图片转换](../../docs/changes/legacy-doc-import/inline-pictures.zh-CN.md)。

## 普通浮动图片转换

正文和聚合页眉的U+0008、最终特殊字符属性与原始FSPA/形状共同确定普通图片，使用原
一基媒体槽读取全局BStore。全局缺省与局部标量分层解释，布尔属性按各自use位覆盖。
保留原媒体、FSPA创作矩形、双轴参考和对齐或偏移、前后层级、锁、重叠/表格内布局、
四向距离、裁剪、旋转/翻转、宽高比锁及名称/替代文字，不套用新建图片预设。

none、square和top-and-bottom原生投影；tight/through因图片codec尚未往返源轮廓，
明确以`floating-picture-wrap-approximated`近似为square。普通组合图片另按上述整组合同处理；OLE、未支持的组变换、隐藏/脚本角色、
不支持的参考或负距离按`floating-picture-unprojected`拒绝该图片；其余属性/记录分别报
损失。已知源拒绝只在尽力模式隔离；预算和非预期错误继续失败。

完整四字节ClientAnchor在后续槽仍为零，且当前part的FSPA与形状唯一配对时，沿实际
CP/FSPA关联恢复图片并报`drawing-client-anchor-variant`兼容诊断。其他非零冲突、坏
长度、重复记录及多FSPA别名继续拒绝，见[零锚点兼容](../../docs/changes/legacy-doc-import/picture-anchor-compatibility.zh-CN.md)。

内联与浮动图片共享`maxPictures`、媒体解码/引用字节、OfficeArt工作和复杂属性预算。
共享媒体与出现身份分开，完整几何和XML验证成功后才登记关系；未成功的Story不泄漏资源。
固定45份原件的98个独立图片型锚点全部在分母；可转换独立范围另观察144个组内图片叶子。
40份转换、5份源拒绝，输出68个浮动图片（含一个组内PNG）；64个独立媒体/几何/位置
一致，4个参考不可用单列。两种raw策略、JSON新包和45份真实Worker通过；25个未投影
独立锚点、143个随整组拒绝的图片叶子及15个轮廓近似单列，不能理解为完整绘图或版面保真。准入锁定
每个已独立证明的源身份与原媒体验证，图片总数量不能掩盖旧项消失。
Classic及后端验证见[浮动图片范围](../../docs/changes/legacy-doc-import/floating-drawings.zh-CN.md)。

## 页眉页脚

转换保留 default/even/first 页眉与页脚、每节独立引用、首页不同和全局奇偶页开关。
源内容的保护 CR 被剔除，作者空段保留。缺少当前节同槽时继承前节，显式空段形成独立
空故事。文字、样式、制表位、普通表格、编号及内联图片复用既有解释器和投影范围。
媒体可以复用，每个故事的图片关系归该 part 所有。

```ts
const source = inspectDoc(bytes, { includeHeaderFooters: true })
console.log(source.headerFooters?.evenAndOddHeaders, source.headerFooters?.stories)
// start/end 使用完整 DOC 的绝对 CP，contentEnd 排除独立保护 CR。
```

`inspectDocInWorker` 接受同一选项。`maxHeaderFooterStories` 默认 10,000，硬上限 100,000，
计入空槽和注释分隔故事。转换的段落、run、表格、图片与属性执行预算跨故事共享。

尽力模式对损坏目录报告 `header-footer-directory-unprojected`。有效目录中的不可解释
故事保留明确空 part 和节引用，并报告 `header-footer-content-unprojected`，避免继承错误。
资源上限与非预期异常终止任务。空故事的残留目录报告 `stale-header-directory` 并忽略。
注释分隔故事、域重算依赖及段落 frame 继续单独处理。八份 POI 原件的 69 条源断言与全部故事内容通过。
独立输出与 Classic 扩展范围见[浮动表格与空页眉兼容](../../docs/changes/legacy-doc-import/floating-table-position.zh-CN.md)。

## 脚注尾注正文转换

自动引用和正文分别进入 footnote/endnote 部件，保留段落、空段、字符格式、列表与表格。
每个家族读取一次格式数组，段落、run、表格和媒体预算跨所有故事累加。实际输出的正文引用
决定 note 成员，未准入指令引用不会建立对应 note。已确认引用的正文失败以带诊断
的空 note 隔离，预算耗尽终止转换。

固定 21 份原件中，16 份内容独立匹配，1 份部分覆盖，4 份源格式拒绝。
25 条正文通过独立初次包和保全部件往返，其中 21 条另通过新 note 部件检查。
一条含嵌入对象的正文为参考未覆盖，另一条为明确内容拒绝，完整 Node/Worker 一致。
原 16 份准入通过 Classic 脚注编辑、撤销、重做和重新导入。有效版本对应的编号格式、起点、重启和位置已保留到
OOXML，分节覆盖与显式零单独保留。非默认编号/位置和节末尾注抑制报告 `note-settings-host-limit`，
Classic 的原生布局仍使用默认编号与位置。系统分隔故事报告 `note-separators-approximated`，
自定义标记另行拒绝。note 媒体可进入初始 DOCX，当前 LitAST
writer 对含关系资源的编辑后重新生成保留显式拒绝边界。
Canvas/SVG 已验证实际引用及脚注表格的文字绘制、编辑和重开。引用/自身标记的任意源呈现
属性在初始 DOCX 保留，其 LitAST/Classic 重建仍待完善。
新增原件来自有界字体名称零填充兼容，转换报告保留 `font-name-zero-padding`。
其中四张 WMF 在 Classic 图片准入层明确拒绝并替换为标签，矢量图呈现和保全继续单列。
DOCX 打包器统一 ZIP 条目时间为 1980 年 UTC，文档 XML 内的创建、修改时间仍由相应字段序列化。
详见[正文转换与页面验收](../../docs/changes/legacy-doc-import/note-content.zh-CN.md)和
[字体兼容与新增原件边界](../../docs/changes/legacy-doc-import/font-name-padding.zh-CN.md)。

## 浏览器完整转换

```ts
import { parseDocInWorker } from '@quirekit/lit-doc/conversion/browser'

const result = await parseDocInWorker(bytes, {
  runtimeModuleUrl: new URL('./docx-runtime.mjs', import.meta.url).href,
  lossPolicy: 'best-effort',
  signal: controller.signal,
})
```

`docx-runtime.mjs` 是宿主构建的模块，导出 `resolveDocxPackageSourcePlan`、
`materializeNewDocxPackagePlan`、`parseDocx`；模块 URL 由宿主指定，文件内容不能选择它。
`convertDocToDocxInWorker` 返回包字节，`parseDocInWorker` 返回完整可结构化克隆的 LitAST 数据，
保留 Map 与字节元数据。解析、投影、打包和 AST 解析都在同一专用 Worker；取消/超时终止整条计算，
并释放监听器和时钟。运行时不隐式获取文件、字体或办公套件。

打包器也可静态装配 Worker，避免动态模块 URL：

```ts
// legacy-doc.worker.ts
import * as runtime from '@quirekit/lit-docx'
import { installDocConversionWorker } from '@quirekit/lit-doc/conversion/worker-runtime'
import type { ConversionWorkerScope } from '@quirekit/lit-doc/conversion/worker-runtime'
installDocConversionWorker(globalThis as unknown as ConversionWorkerScope, runtime)
```

调用端用现有 `createWorker` 工厂注入该新建专用 Worker。单次 parseOptions 只传序列化选项，
插件/回调由宿主的静态 Worker 装配；默认相邻 ESM 的路径与源检查 Worker 遵循相同规则。

## 正文段落边界（可选）

```ts
const source = inspectDoc(bytes, { includeParagraphs: true })
console.log(source.paragraphs)
// [{ start: 0, end: 12, ending: 'paragraph' }, ...]
```

浏览器的 `inspectDocInWorker` 接受同一选项。每个区间包含结束码元；空段保留，手动换行和
非节尾的分页符仍在段内。`ending` 为 `paragraph`（0x0D）、`section`（真实节尾 0x0C）或
`cell-or-row`（0x07）。0x0D 也可能是嵌套表格的单元格/行标记，角色需要后续属性解释。
只检查正文，其他 story 继续提供原始文字区间。

段末属性通过文字片段、段落格式索引与页内记录定位，校验属性字节包络；仅请求边界时样式索引和原始
属性保留内部，尚未计算有效格式。结果包含 `paragraph-formatting-unresolved` 诊断。
请求后遇到损坏记录会抛出 `invalid-paragraph-data`，不会静默退回纯文字；省略此选项时不
要求段落记录可读，结果没有 `paragraphs`。

## 段落基础格式（可选）

```ts
const source = inspectDoc(bytes, { includeParagraphFormatting: true })
console.log(source.paragraphs?.[0]?.baseFormat)
```

该选项隐含请求正文段落，浏览器接受同一选项。`baseFormat.scope` 固定为 `paragraph-base`，
按默认值、段落样式继承、PAPX 和段末 piece 修改依次计算基础设置：

- `styleIndex`、带 physical/logical 基准的 `alignment`、`leftIndent` / `rightIndent`，
  以及有符号的 `firstLineIndentTwips`。
- `outlineLevel`：0–8 是大纲级别，9 是正文，缺省为 9；与列表层级独立。
  转换分别保留样式继承和直接覆盖，不因大纲值应用标题外观预设。
- `spacingBeforeTwips` / `spacingAfterTwips` 与 `lineSpacing: { value, multiple }`；
  负行距为精确 twips，非负 multiple 为 `value / 240`，其他非负值为最小 twips。
- `keepLines`、`keepNext`、`pageBreakBefore`、`widowControl` 与 `bidi`，保留明确的 false 和 0。
- `autoSpaceLatin` / `autoSpaceNumber` 分别控制东亚文字与拉丁字母、数字的自动间距，
  DOC规范缺省均为true；样式继承和显式false分别保留，非法Bool8拒绝。
- `tabs.stops` 保存有效自定义制表位，`tabs.changes` 保存当前样式或直接层的确切新增/清除，
  `tabs.rangeDeletion` 标记源删除范围。位置采用有符号 twip，记录最多 64 个有效 stop。
- `shading: { pattern, foreground, background } | null` 保存段落底纹的原Ipat与RGB/auto。
  null表示无源层设置，65535表示显式nil；同层完整RGB记录优先于旧调色板兼容记录。

转换保留本层制表位与样式引用，范围删除转成当前确切 clear 位置并报告近似。
旧样式中的 PChgTabs 返回 `legacy-style-tab-operation`。Classic 当前原生布局覆盖正向
start/center/end 及常用前导符。DOP正默认间隔原样写入文档设置，LitAST与Classic普通
文字在最后一个显式位置后继续默认网格；原件设置修改、完整历史和再导出另有
[默认间隔验收](../../docs/changes/legacy-doc-import/default-tab-interval.zh-CN.md)。Classic还按位置
合并样式与直接层，同位置覆盖、明确clear及清除后恢复默认网格经过
[增量继承验收](../../docs/changes/legacy-doc-import/tab-inheritance.zh-CN.md)，原始各层不铺平。
clear在产品面板仍只读保全；其他对齐、负位置和中点leader继续按
[制表位支持范围](../../docs/changes/legacy-doc-import/paragraph-tabs.zh-CN.md)处理。

自动间距分别投影为标准 `autoSpaceDE` / `autoSpaceDN`，本层未写入的值继续继承，
文档缺省明确记录DOC的两个true。既有LitAST与Classic负责消费、两个开关的独立编辑、
完整历史及新包重开；Canvas/SVG沿既有四分之一汉字字号的几何近似，见
[自动间距验收](../../docs/changes/legacy-doc-import/auto-spacing.zh-CN.md)。

段落底纹分别保留样式和直接写入，输出标准 `shd`。原件、原生另存的纯色语义、
raw/JSON、Worker和Classic内容/填色/显式清除/恢复继承及完整历史另有
[底纹验收](../../docs/changes/legacy-doc-import/paragraph-shading.zh-CN.md)。未有精确标准对应的
图案报loss并省略该shd；可标准保存但Classic目前只绘背景fill的图案报host-limit，
不以纯色或全局像素相似率冒充图案支持。

返回值是检查用的派生设置。编号、表格条件样式、字符格式，以及自动/行单位间距、字符单位
缩进、网格与相邻段落效果仍待解释，不能将基础值直接作为最终布局或 LitAST 的直接属性。
未解释的普通操作列入每段的 `unsupportedOpcodes`；结果固定携带
`paragraph-formatting-partial`。源定义和直接属性的持久投影仍待单独验收。

样式循环、错误引用、损坏包络返回 `invalid-formatting-data`；未支持的整组格式变更返回
`unsupported-formatting`。HugePapx / TableProps 间接 Data 链有环、深度和预算检查。
可选模式失败不静默回退；缺省文字和单独边界模式维持各自准入条件。

### 段落样式重置

PIstd按PAPX→段末piece顺序替换目标样式的已建模段落基线，清除旧直接字段、制表符
增量和编号来源；字符层及OOXML pStyle共同使用最终样式。索引1..9明确设置对应大纲
级别，表格结构和审阅状态仍由独立源owner保留。无效目标、样式置换和增量级别继续拒绝。

`pnpm doc:paragraphs:styles` 固定三份原件、200个重置段，独立核对目标样式核心字段与
真实源Worker。原生命名样式154段匹配、46段未唯一绑定；两段原PAPX身份不可确认，
最终piece重置仍有独立字节证据。o_kurs仍有显式表格深度冲突；另两份原件已分别由Majority和
表格修订当前值读取进入实际转换，不把源样式对照升级为完整格式准入。
三组完整规范DOC另通过两种raw/JSON新包和Classic内容/样式修改、完整历史及重开。

## 字符基础格式（可选）

```ts
const source = inspectDoc(bytes, { includeCharacterFormatting: true })
console.log(source.characterRuns)
```

隐含请求正文段落及段落基础格式；`characterRuns` 按 UTF-16 `[start,end)` 覆盖正文，
包括结束控制码元，交集按段落、piece、CHPX 与 BTE 范围推进。`baseFormat.scope` 为
`character-base`，包括常用字形开关、字号/字体索引、语言索引、颜色/高亮/下划线、上下标、
字距/位置/缩放等基础设置。自动方向、复杂文字字号和字体选择保留自动状态；字体槽索引
尚未解析成字体名，LCID 尚未转换成 BCP47。颜色保留 palette 或 COLORREF 编码。

段落和字符样式按继承链处理；相对 toggle 使用稳定样式快照，CIstd 切换与 CPlain 清除按
源顺序执行，保留规范要求的高亮、方向和特殊状态。固定返回 `character-formatting-partial`，
未知普通字段列入 `unsupportedOpcodes`；尚未实现的复合变更、复杂脚本自动状态的反转明确拒绝。
这些结果尚未作为持久 marks、最终字体/布局或完整修订模型输出。

### 零字号兼容与原值保全

旧生产者的普通CHps=0按原值读取，报告`legacy-zero-font-size`；其他越界字号不放开。
转换以原OOXML属性保留零，同时报告`zero-font-size-unportable`损失和宿主限制，严格
模式拒绝。零不成为0pt规范mark，也不扩大Classic作者控件或显示/测量范围。
仅普通零、仅复杂零及双零的独立属性信封均经JSON和两种raw新包保留；无关编辑保留
原值，合法普通字号按既有所有权替换两种字号，显式复杂字号再覆盖。
`pnpm doc:characters:zero-size`核对三原件、两项原样式零、869个有效零码元、固定原生
LO包、实际新包及真实Worker；7项Classic内容/格式/合法字号编辑、完整历史及重开通过。
未取得原生Word零字号效果证明，保留原值不代表已验证零字号显示。

### Majority 选择性重置

CMajority以独立文档缺省编译比较集，仅把当前值相等的规范字段恢复为底层段落样式。
未匹配值及未列出的字段保留；noProof=true特例和东亚目标Times New Roman例外分别处理。
恢复继承时删除旧直接/相对toggle来源，后续属性仍按原顺序覆盖。自动复杂字体/字号与
明确值之间不能可靠比较时继续拒绝，显式文字动画及未实现比较属性也不吞掉。

`pnpm doc:characters:majority` 独立核对rasp.doc原段末比较字节、前缀与段落基线，以及
实际DOCX和两种raw/JSON新包的粗体、字号、语言与继承来源。规范DOC及该原件的4项
Classic内容/格式编辑、完整历史与新包通过。当前没有独立原生Word Majority效果对照，
不据此声明其完整格式或最终版面保真。

### 旧样式的脚本提示与高亮

样式字符 UPX 中的脚本提示按原层保留，报 `legacy-style-script-hint`。段落样式中的
高亮和显式零清除继续参与继承，报 `legacy-paragraph-style-highlight`；字符样式中的
高亮按成熟 Word 消费规则忽略，报 `character-style-highlight-ignored`，不清掉底层
段落或直接高亮。两类 UPX 使用独立上下文和缓存；其他非法操作、截断和非法值仍拒绝，
被忽略的操作仍计入共享预算。CIstd/CPlain 的原有保留与直接层顺序不变。

`pnpm doc:styles:characters` 固定九份原件，八份实际转换，另一份保留复合分节限制。
82 个原始样式 owner 的字段、身份/父链与实际新包独立一致；两条上游高亮断言、两种
raw/JSON 新包及全部九份真实 Worker 通过。三份原件通过 Classic 编辑、完整历史与
独立导出重开；Canvas/SVG 验证真实菜单/Worker、继承与清除的绘制、实际选择及直接
高亮、完整历史和导出再导入。该范围不包含原测试另外两条 shading 背景断言。

### 正文末段标记的缺失字符层

正文最后CR的原BTE与末页FKP都精确停在该字符之前时，仅在同piece有完整前文且Prm为零
的限定条件下，允许空直接字符层，报 `terminal-character-format-absent`。末段仍由完整
PAPX及原段落样式管理，不复制前字的字号、开关、图片或修订状态。普通字符缺口、终点
冲突、非零片段修改、独立末CR piece与辅助Story继续拒绝；运行数量及共享预算不放宽。

`pnpm doc:characters:terminal` 固定十份原件，独立POI核对两套终点及段落样式核心基线，
八份Word 16.109.2与两份LibreOffice原生另存包验证空直接末段。十份实际转换、两种
raw/JSON新包、真实Worker、三份Classic末段编辑/完整历史/新包及Canvas/SVG真实输入
往返通过。另存包版本、位置和摘要记录在固定清单，文件留在外部语料目录。
这项独立末段证明不替代整份字符核心参考；完整源检查仍把参考不可确认的文件单列。

### 未设置样式方向时的 RTL 取反

CFBiDi=0x81 对未设置的样式标志取反时，采用成熟转换器的标志基线 false，得到明确
RTL=true，并报 `implicit-rtl-style-inversion`。缺省和0x80仍保持自动方向；复杂脚本
自动取反、非法样式操作及预算限制不放开。既有 `direct-inverse-toggle-approximated`
继续说明未来父样式变化时，OOXML明确值不能保留源取反关系。

`pnpm doc:characters:rtl` 固定四份原件、31个相关源区间，独立核对完整源方向、实际包、
两种raw/JSON新包和真实Worker。原生LibreOffice另存确认565个文字码元及5个空段，
另10个非空段末没有直接原生对照，不计完整双向版面保真。四份Classic方向编辑、完整
历史与新包通过；其中嵌入WMF的原件仍明确报告图片传输不支持并显示占位文字，这不是
WMF预览或编辑支持。Canvas/SVG真实菜单、普通输入、段末保全及新包往返另行通过。

## 域源索引（可选）

```ts
const source = inspectDoc(bytes, {
  includeFields: true,
  limits: { maxFields: 10000, maxFieldDepth: 64 },
})
console.log(source.fields?.indexes)
```

`fields.scope` 为 `field-index-source`，含七个文档部分。tokens 保留部分内相对 CP、下一 CP、
完整 `rawCode`、忽略高三保留位后的控制类型及原状态字节；entries 按 begin 排序，使用
绝对 CP 和右开 end，separator 可为 null。索引深度不包含未入表的外层域，原 end flags
不随推导的层次或 separator 改写。末 CP 只保留排序关系，不作为正文范围。

此选项不隐含段落或字符格式，返回 `field-formatting-unresolved`。原始七条 POI 断言与
真实 Worker 已通过；普通域转换见上文，求值依赖另行验收。错误位置、重复 CP、坏配对及
截断报 `invalid-field-data`。字段总数默认 10000、硬上限 100000，深度默认 64、硬上限 256；
两者适用于同步与 Worker，超限报 `limit-exceeded`。

## 脚注与尾注源索引（可选）

编号与位置可独立使用 `inspectDoc(bytes, { includeNoteSettings: true })` 检查，结果位于
`noteSettings`。它包含按有效版本选择的 DOP 字段、各节原始格式码/重启/偏移与显式字段。
该选项独立于 `includeNotes`，两者可以组合。固定 21 份原件中 20 份设置与 POI 一致，
1 份跨正文范围的分节目录受控拒绝，完整 Worker 一致。两项原始 extractor 方法的 10 条
断言通过。设置、显式节末尾注抑制的 OOXML 保全与 Classic 消费进度见[编号与位置](../../docs/changes/legacy-doc-import/note-settings.zh-CN.md)。

```ts
const source = inspectDoc(bytes, { includeNotes: true, limits: { maxNotes: 10000 } })
console.log(source.notes?.entries)
```

返回两种 note 家族的源 slot、正文锚点、绝对 UTF-16 内容范围和自动/自定义标记选择值。
内容包含自身结尾段落符。两类 note 共用数量上限，未定义 PLC 终值被忽略，重复/越界和
自动引用缺少 U+0002 按源错误拒绝。浏览器使用相同选项和完整结果。

原始位置四条断言与固定 21 份原件已验证，20 份的 35 条 note 独立一致，一份含七处错误
锚点的原件受控拒绝。该检查入口返回 `note-formatting-unresolved`，完整内容由转换入口
独立处理。详见[源索引范围](../../docs/changes/legacy-doc-import/note-source.zh-CN.md)。

## 表格结构（可选）

```ts
const source = inspectDoc(bytes, { includeTables: true })
console.log(source.tables) // 按 level、start 排序的源表格
```

隐含正文段落检查。每行的 `cells` 保留源单元格，`markerStart` 指向独立行末；格内 `blocks`
按源顺序引用正文 `paragraphs` 或结果 `tables` 的索引，内表的 `parent` 指向外表的行/格。
包含格末码元的源 CP 不是编辑器位置。相邻行按样式、PGP 组、方向及完整定位元组分表，定义数必须与
实际格末数相符；内表行末同时带两个标志时仍只作行末处理。

这是源成员检查。合并、网格、尺寸、边框、样式格式与布局仍返回 `table-formatting-unresolved`。
Word 97/2000 的直接成员完全没有深度操作且无内表末标志时，按外层深度一处理，并报告
`implicit-table-depth`。显式零和较新版本不采用该兼容，详见[范围](../../docs/changes/legacy-doc-import/implicit-table-depth.zh-CN.md)。
仅段落 frame、混合 None 定位、保护/SDT 范围、未知复合操作和不满足上述条件的零深度表格拒绝为 `unsupported-table`；
不完整或矛盾成员为 `invalid-table-data`。这些拒绝不改变缺省文字模式的准入。

## 页面边框转换与保全

普通线型的四边页面边框沿原分节写入 OOXML。新 RGB BRC 覆盖同边旧调色板 BRC，
保留自动色、线宽、pt 间距、阴影/立体标志、适用页、前后层与 page/text 参考位置；
边框不改写正文页边距。源小于 2 的线宽按规范等效为 2 个八分之一点。
特殊线型 5、艺术边框、超过本切片 96/8pt 的线宽及非法记录仍明确拒绝。

`LitSectionAttrs._pgBordersRaw` 是独立的 JSON 安全保全信封，两种 `preserveRawXml`
配置都保留它。Classic 沿现有分节 preservation 保存，正文/页面编辑、完整历史、拆/合节
及新 DOCX 输出已验证；报告 `page-borders-host-limit`，**当前 Canvas/SVG 不绘制页面边框，
也不提供创作入口**。DOCX 的图片/角图关系、外部命名空间或嵌套边框内容明确拒绝，
不输出悬空关系。只有空分节承载段的节仍受 Classic 最小可编辑正文规则影响。

`pnpm doc:sections:borders` 固定五份 POI/LibreOffice 原件、六个节，以独立原 SEPX、
原生 LibreOffice DOCX、实际新包、JSON 和真实 Worker 核对。该闭包不代表原件中的
段落/表格/图片边框或最终页面外观全部支持。

## 旧分节大纲记录

旧分节 `OLST80` 大纲记录按完整 212B 载荷校验九级共享的 32 码元文字槽；独立大纲颜色
按九个 COLORREF 的 36B 载荷校验。有效记录允许其他已准入内容继续尽力转换，并报告
`legacy-section-outline-unprojected` 损失。**旧级别定义、前后缀、重启和颜色没有原生投影或
二进制保全**，不创建现代列表或改写正文颜色；严格模式仍拒绝未支持语义，248B 扩展形态、
截断和未知相邻操作继续拒绝。`pnpm doc:sections:outlines` 固定三份原件验收源记录、
实际新包、JSON 与 Worker；该记录边界不代表旧编号格式支持。

## 浮动表格定位

`tables[].identity.position` 保留锚点、两轴距离/对齐、四向文字距离及重叠规则。
数值距离按 MS-DOC plusOne 规则解码，DOCX 投影按 Word 原生另存行为保留源整数，并报告
`table-position-offset-compatibility`。定位独立于可选网格几何。

八份固定原件通过实际 DOCX、新 AST 输出及 Classic 编辑/历史/重开，包含页脚表格。
Canvas/SVG 验证相邻浮动表格及清除对齐后的实际移动与命中。完整绕排、碰撞、跨页和嵌套
布局逐项验收，详见[范围](../../docs/changes/legacy-doc-import/floating-table-position.zh-CN.md)。

## 编号源结构（可选）

```ts
const source = inspectDoc(bytes, { includeNumbering: true })
console.log(source.numbering?.definitions, source.numbering?.instances)
console.log(source.paragraphs?.[0]?.numbering)
```

浏览器接受同一选项，隐含正文段落及段落基础格式检查。`numbering.scope` 为
`numbering-source`，保留一/九级定义、源身份与样式链接、实例、实际 level 标识的覆盖、
UTF-16 模板及占位位置。显式零起点保持为 0；bullet/none 的无效起点为 null，同时保留原值。
定义/层级/实例/覆盖的固定头与层级属性字节均为独立副本，不修改调用方缓冲区。

段落引用按同一次样式、PAPX、段末 piece 遍历求得；`rawIndex`/`rawLevel` 保留源值，
`instanceIndex` 为归一后的 1 起点引用，`level: 12` 表示跳过。取消和无列表引用的
instanceIndex/level 为 null；负引用的 `keepLogicalIndentation` 为 true。

这只检查源结构与引用。层级属性字节尚不执行，不生成标记或求最终缩进，也不创建编辑器
持久身份；固定报告 `numbering-formatting-unresolved`。转换另按上面的编号投影合同执行，不扩大此检查范围。
损坏、缺失引用、截断与区域重叠报 `invalid-numbering-data`；尚未准入的重复 level 覆盖报
`unsupported-numbering`。省略选项时不读取这些记录，既有范围不因此扩张。

旧版 `ANLD80` 与独立颜色操作只做有界包络/计数检查，保留在未投影操作中；不单独建立
现代编号图。尽力转换继续处理已准入正文和媒体，严格模式因明确损失拒绝，详见
[旧编号记录范围](../../docs/changes/legacy-doc-import/legacy-numbering-descriptor.zh-CN.md)。

## 浏览器 Worker

```ts
import { inspectDocInWorker } from '@quirekit/lit-doc/browser'

const controller = new AbortController()
const result = await inspectDocInWorker(new Uint8Array(await file.arrayBuffer()), {
  signal: controller.signal,
  timeoutMs: 20_000,
  limits: { maxInputBytes: 32 * 1024 * 1024 },
})
```

每次调用拥有独立模块 Worker，成功、出错、取消或超时都会终止 Worker；取消会停止计算。
被转移的是输入副本。默认 URL 适用于保持相邻目录关系的构建后 ESM 文件。
打包器须保留该关系或由宿主提供自己的 Worker URL，例如使用 Vite 的 `?worker` 导入：

```ts
import DocWorker from '@quirekit/lit-doc/worker?worker'

const result = await inspectDocInWorker(bytes, {
  createWorker: () => new DocWorker(),
})
```

工厂必须返回实现本包协议的**新建专用** Worker，其终止权交给本库。URL 须满足宿主 CSP。
Node 使用根入口时不要求或创建浏览器全局对象。

## 准入与资源上限

- CFB v3/v4、普通/mini 流、FAT/DIFAT 分配链与根目录流身份。
- FIB 版本 `0x00c1`、`0x00d9`、`0x0101`、`0x010c`、`0x0112`；CLX 片段、
  压缩字符、UTF-16 码元和七类源子文档区间。
- Word 97 的规范别名 `0x00c0` / `0x00c2` 使用同一布局，有 newer 版本时仍以 newer 为准。
  `version` 保留实际有效数值。仅大小写不同的根名可读取，并返回 `root-name-case-variant`。
- 已知 base 版本且完整定位表前缀存在时允许缺少版本扩展，并返回
  `missing-fib-version-extension`。额外计数字段按实际长度跳过，返回 `extended-fib-regions`。
  未知有效版本、前缀不足、截断及超出有效流范围均拒绝读取。
- 样式表声明长度短于完整计数记录时，可在下一源区域边界内恢复，返回
  `extended-stylesheet-range`。样式头、每条定义和 UPX 仍须完整，禁止跨区域恢复。
- 加密 DOC/OOXML、其他格式和损坏存储通过 `DocReadError.code` 拒绝。
  ZIP 不作为 DOCX 自动透传；不执行或解释宏及嵌入对象。本库不是完整 CFB 合规校验器。

| 限制 | 默认值 | 硬上限 |
| --- | --- | --- |
| 输入字节 | 64 MiB | 256 MiB |
| 目录槽位 | 65,536 | 262,144 |
| UTF-16 码元 | 8 Mi | 32 Mi |
| 文字片段 | 200,000 | 1,000,000 |
| 正文段落 / 分节边界 | 200,000 | 1,000,000 |
| 格式索引项 / 页（字符模式合计） | 16,384 | 65,536 |
| 正文字符范围 | 200,000 | 1,000,000 |
| 正文表格 | 10,000 | 100,000 |
| 显示图片出现次数 | 10,000 | 100,000 |
| 单图解码字节 | 16 MiB | 64 MiB |
| 累计图片解码字节 | 64 MiB | 256 MiB |
| 表格嵌套深度 | 32 | 64 |
| 编号定义 | 4,096 | 32,767 |
| 编号实例 | 4,096 | 65,536 |
| 编号层级（含完整覆盖） | 65,536 | 262,144 |
| 编号模板 UTF-16 码元合计 | 1 Mi | 8 Mi |
| 属性读取、展开和应用次数 | 1,000,000 | 4,000,000 |
| 样式继承 / 间接属性链深度 | 64 | 256 |
| 批注消息 | 10,000 | 100,000 |
| 批注作者 | 10,000 | 32,767 |
| 批注线程深度 | 64 | 256 |
| 修订作者槽 | 10,000 | 65,534 |
| 修订作者累计 UTF-16 码元 | 1 Mi | 8 Mi |
| Worker 时限 | 20 秒 | 120 秒 |

同步 API 不提供超时；浏览器通过 Worker 离开 UI 线程，Node 不可信任务由宿主隔离。
上述限制约束数据结构和属性处理工作量，不等于精确峰值内存。未支持的属性不会作为完整格式输出。

## 验证

编号源结构另用 `pnpm doc:producer:numbering:check` 与
`pnpm doc:corpus:run --split all --label numbering-source-accepted --numbering --browser`。
独立匹配 378 份，其中 142 份含实例；174 份受控拒绝、6 份参考无法确认。全部 558 份
Node/Chromium 一致。准入只覆盖声明的源核心字段，不覆盖未被实例引用的定义、全部保留位
或有效标记格式；现有 DOCX/Classic 编号支持不因此升级。

仓库中运行 `pnpm --filter @quirekit/lit-doc test` 验证合成格式、损坏输入和任务生命周期。
另行准备 POI 参考程序并下载固定样本后，`pnpm doc:reader:check` 对照 Node、Chromium Worker
与独立 POI 事实，保留未支持的表格断言。批量语料可用 `pnpm doc:corpus:fetch` 下载，然后执行
`pnpm doc:corpus:run --split all --label acceptance --browser`。四个固定来源共 558 份去重输入，
固定分组为 439 份开发和 119 份保留样本。411 份与 POI 源事实相符，142 份受控拒绝，5 份
参考不可读；全部 Node/Chromium 结果一致，已知支持项退化会使门禁失败。受控拒绝不计为兼容
通过，文字存储一致不代表格式、LitAST/DOCX 或 Classic 支持。段落模式另用
`pnpm doc:corpus:run --split all --label paragraphs-acceptance --paragraphs --browser` 验证：
402 份正文边界与独立参考相符，152 份受控拒绝，4 份参考不可读；单独维护段落准入，
不能用文字准入替代。基础格式另用 `--formatting` 验证，393 份与独立参考字段一致，
159 份受控拒绝，6 份参考无法确认，全量 Node/Chromium 一致，单独锁定格式准入。
物理/逻辑标签由规范向量及浏览器一致性验证，未声明真实生产者覆盖。字符模式另用
`--characters` 验证：307 份独立核心字段一致、188 份受控拒绝、63 份参考无法确认；全量浏览器
与 Node 一致。POI 未可靠覆盖的字符样式切换/重置从参考确认中排除，保留规范用例证据，
不把核心字段摘要一致当成全部字符效果与生产者认证。
表格结构用 `--tables` 独立验证：351 份参考一致（其中 69 份含表格）、200 份受控拒绝、7 份
参考无法确认，全量浏览器一致；`pnpm doc:reader:check --tables` 通过原三份的全部十项固定断言。
行格数量与 CP 对照不能替代尺寸/合并或最终转换。
另有原创 Word for Mac 16.109.2 中文原件通过作者断言、POI 核心字段与浏览器验证，使用
`pnpm doc:producer:check` 复核；它独立于公开语料，原生另存 DOCX 不计为自有转换通过。
基础转换另用 `pnpm doc:conversion:check`：独立 POI XWPF 对照原生 DOCX 的正文、加粗、字体、
页面/网格，并验证实际 DOCX 与 LitAST 再导出重开。完整浏览器 Worker 比较保留 Map/字节的结构数据，
验证打包/解析阶段的实际取消、超时、恢复和释放。当前转换生产者证据只有这一份 Mac Word 样本，
不扩算成 558 份转换或 Classic 支持。该样本另经 opt-in Classic 服务验证真实菜单导入、编辑/撤销、Worker 释放、DOCX 下载再导入及实际下载文件的独立 XWPF 对照，见 [Classic 接入](../classic-docx/README.zh-CN.md)。Windows Word/WPS、其他版本和完整语义验收仍待补齐；流程见[语料工具](../../tooling/legacy-doc-reference/README.zh-CN.md)。

[English](README.md)

## 表格属性修订的当前值

TWall和TPropRMark验证计数/布尔载体后，当前表格仍按完整原序解释；最后的检查点与
作者标记都清除时没有该项历史。活动旧快照、作者与日期尚未投影，独立报告
`table-property-revision-unprojected` loss，严格转换拒绝。TCnf等复合样式仍不在此范围。

`pnpm doc:tables:revisions` 核对两份原件的10段元数据，8表/46行/270格当前几何独立
一致，另一份几何参考不可用单列。两种raw/JSON、真实Worker及3项Classic当前列宽/
正文编辑、完整历史与新包通过；这不表示Classic可决策已省略的DOC属性历史。

共享DOCX媒体编码已减少大媒体的瞬态分配，10MiB向量在64MiB堆与独立标准编码一致，
大原件在原256MiB语料限制下完整往返通过；不把单机内存观测当成浏览器或移动端预算。

## 关闭网格的非法间距

最终网格为关闭状态时，`best-effort` 可省略超出 DOC 规范范围的字符间距，产生
`inactive-grid-character-spacing-omitted` loss，并记录所属节与原数值。合法负值、0、
端点及行距保持原值；严格模式与所有启用网格仍拒绝非法间距，不夹值、不取模。

`pnpm doc:sections:inactive-grid` 核对两份固定上游原件、独立 POI 与原生另存、
PAGE 的五处10pt格式、JSON 新包和真实 Worker。原生另存存在间距溢出，
只作为关闭模式和内容证据，不作为非法参数的正确值。

## 嵌套表格的重复框

`redundant-nested-table-frame` 表示内表每行首段与完整框参数均已证明属于实际包围它的
定位行。内表继续位于原格中，不复制外层位置；顶层框、缺省/混合框和无法证明的归属
仍拒绝。`pnpm doc:tables:frames` 核对两份原件、4表/22行/49格的独立原几何、
原生文字、两种raw/JSON与真实Worker。Classic内格/列宽编辑、完整历史及两后端
真实菜单往返通过，原件分页和完整表格样式仍须单独验证。
