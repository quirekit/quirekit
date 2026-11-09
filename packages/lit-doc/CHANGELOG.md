# @quirekit/lit-doc

## 0.0.2

### Patch Changes

- Add optional browser and Node inspection of legacy DOC footnote/endnote numbering and placement, preserving version-specific document settings, section values and explicit overrides. Share bounded section reading with conversion and verify the original POI extractor assertions.

  新增浏览器与 Node 可选的旧版 DOC 脚注尾注编号、位置检查，保留按版本选择的文档设置、各节原始值与显式覆盖。转换共用有界分节读取，并验证 POI 原始提取测试断言。

- Recover named DOC bookmarks with repeated end indexes when the complete endpoint position counts match the physical table. Retain original ranges and indexes, report the compatibility decision, and preserve strict validation for annotation ranges and incompatible endpoints.

  兼容普通 DOC 书签的重复终点索引，仅在完整终点位置计数与物理表一致时恢复。保留原始范围和索引并报告兼容诊断，批注范围及不等价终点继续严格校验。

- Import standard legacy Word bookmark names and explicitly paired ranges through the existing OOXML, LitAST and Classic contracts. Add bounded source inspection and browser Worker support, preserve crossing/empty/hidden and table-column metadata, and report unsupported Story, instruction and cache-navigation boundaries.

  通过既有 OOXML、LitAST 和 Classic 合同导入旧版 Word 标准书签名称与显式配对范围，新增有界源索引检查和浏览器 Worker 支持，保留交叉、空、隐藏及表格列元数据，并明确报告未准入的 Story、域指令和缓存内导航边界。

- Read bounded legacy character codepage records with explicit conversion-loss reporting. Preserve the established text decoding and neighboring formatting operations, retain diagnostics across character resets, and expand independently verified source and conversion coverage.

  有界读取旧字符码页记录并明确报告转换损失。保留既有文字解码与相邻格式操作，在字符重置后继续保留诊断，并扩充独立验证的源格式及转换准入。

- Import bounded legacy Word comment authors, ranges, rich bodies and parent relationships through the existing OOXML, LitAST and Classic owners. Preserve unknown or floating dates without inventing UTC, admit empty initials, order imported replies before their descendants, and retain comment-only numbering definitions. Report legacy per-reply targets, ink and ordinal-presentation limits explicitly.

  通过既有 OOXML、LitAST 和 Classic 所有者导入有界的旧版 Word 批注作者、范围、富正文及父子关系。未知或无时区日期不再被补造为 UTC；允许空缩写，按父先于子的顺序导入回复，并保留批注正文独有的编号定义。旧回复独立目标、墨迹及旧序号呈现的限制均明确报告。

- Preserve ordinary legacy Word complex-field instructions, cached text, nested structure, locks and cross-paragraph results through OOXML and existing editor models. Keep unsupported binary resource fields under explicit display-content loss policies and existing media admission. Validate Story/cell boundaries, private results and shared field work limits.

  通过 OOXML 和既有编辑器模型保留旧 Word 普通复杂域的指令、文字缓存、嵌套结构、锁定及跨段结果。未接入的二进制资源域采用明确的显示内容损失策略和原有媒体准入，校验 Story/单元格边界、私有结果及共享域工作额度。

- Preserve legacy DOC automatic spacing between East Asian text and Latin letters or numbers, including normative defaults, style inheritance and explicit false overrides, through typed OOXML conversion and browser inspection.

  保留旧版 DOC 中东亚文字与拉丁字母、数字之间的自动间距，贯通规范缺省、样式继承和显式关闭、类型化 OOXML 转换及浏览器检查。

- Read compatible legacy CFB headers, partially populated final sectors and declared allocation prefixes with explicit diagnostics, while retaining actual stream-byte bounds and allocation ownership checks.

  兼容旧版 CFB 头固定字段偏差、部分填充的末扇区及分配表声明前缀，提供明确诊断并保留实际流字节范围和分配所有权校验。

- Add optional main-story character base-format inspection with bounded CHPX ranges, shared formatting budgets, inherited paragraph/character styles, ordered style resets and four-state toggles. Preserve source font/language/color identities and automatic states, expose explicit unsupported-operation diagnostics, and add independent core-field corpus admission with full browser parity.

  增加可选正文字符基础格式检查，提供有界 CHPX 范围、共享格式预算、段落/字符样式继承、有序样式重置和四值开关。保留源字体/语言/颜色身份与自动状态，明确报告未支持操作，并增加独立核心字段语料准入及完整浏览器一致性检查。

- Apply legacy Word character Majority operations selectively against the underlying paragraph style, preserving unmatched direct formatting and the source's proofing and East Asian font exceptions. Unsupported automatic comparisons remain explicit refusals.

  支持旧版 Word 的 Majority 字符选择性重置，按底层段落样式恢复匹配字段，保留不匹配的直接格式及源校对、东亚字体例外；尚不能确定的自动值比较继续明确拒绝。

- Recover bounded legacy Word core storage from inconsistent CFB metadata, directory links and partial stream tails. Accept complete v3 directory fields when only the unused upper size word is missing, read actual known FIB locator prefixes, and retain continuous readable main-story text after CLX damage. Report retained source CP ranges and omissions through the existing content-recovery contract while preserving strict source inspection.

  补齐旧版 Word 核心存储兼容，恢复有界的 CFB 元数据、目录链接与实际流前缀。v3 目录仅缺少未使用的长度高位时继续读取，FIB 使用实际完整的已知 locator 前缀，CLX 损坏时保留连续可读的主 Story 文字。通过现有内容恢复报告记录原始 CP 区间和省略，保留严格源检查合同。

- Read the documented Word 97 FIB version aliases and diagnose case-only variants of the root storage label, while retaining strict allocation and record-boundary checks. Validate the reader against a pinned, deduplicated multi-project DOC corpus with isolated execution and explicit unsupported outcomes.

  支持规范中的 Word 97 FIB 版本别名，对根存储名称的大小写变体提供明确诊断，继续严格检查分配与记录边界。使用固定版本、按内容去重的多项目 DOC 语料进行隔离执行回归，并单列未支持结果。

- Read complete known FIB prefixes with counted extension fields and recover complete stylesheet records within source-region boundaries. Report both compatibility decisions and retain cropped-picture documents through DOCX and LitAST conversion.

  支持包含额外计数字段的完整 FIB 前缀，在源区域边界内恢复完整样式记录，并报告兼容性诊断，使裁剪图片原件能够进入 DOCX 与 LitAST 转换。

- Preserve legacy Word document default tab intervals through DOCX and LitAST, and consume them in Classic ordinary text after explicit stops and across hanging indents. Keep plain paragraphs on their existing layout path and share the validated default with numbering.

  保留旧版 Word 文档默认制表间隔并贯通 DOCX、LitAST 与 Classic 普通文字布局，超过显式位置后继续默认网格，悬挂首行优先到缩进边缘；无 Tab 段落保留原布局路径，编号共享同一有效缺省值。

- Recover the root storage type from directory slot zero during best-effort DOC conversion. Recover detached streams after a broken root-level directory link only when all used non-root entries prove a flat stream-only layout. Preserve explicit diagnostics, allocation checks, and strict-mode rejection.

  默认尽力转换旧版 DOC 时，可由目录首槽恢复损坏的根存储类型；只有全部使用的非根目录项均为无子关系的流时，才恢复根级断链遗漏的流。保留明确诊断、分配检查与严格模式的拒绝行为。

- Convert supported legacy DOC groups of pictures and horizontal textboxes to native DrawingML, retaining original text ownership, media bytes and nested physical placement. Reject unsupported groups atomically and report the existing editable-leaf ungrouping boundary. Keep each leaf's aspect lock independent of its group and canonical after edits.

  将受支持的旧版 DOC 图片与水平文字框组合转换为原生 DrawingML，保留原文字归属、媒体字节及嵌套物理位置。不支持的组合整体拒绝，并明确报告既有的可编辑叶子拆组边界。各叶子的比例锁独立于父组，编辑后继续遵循统一字段权威。

- Read the observed 0xC3 Word 97-compatible FIB marker through its complete known field prefix, preserving effective version values, counted extension diagnostics and input bounds. Keep independently preserved section-boundary paragraphs outside Classic body-tail repair, so opening and editing an imported section does not add an extra empty body paragraph.

  按完整的 Word 97 已知字段前缀读取已观察到的 0xC3 FIB 标记，保留有效原版本、计数扩展诊断和输入范围检查。Classic 补齐正文末段时保留独立分节承载段的所有权，避免打开或编辑导入节时额外增加普通空段。

- Add experimental DOC-to-DOCX and LitAST APIs through a bounded typed OOXML source plan and a host-injected DOCX runtime. Preserve font/style definitions and direct-field provenance, report strict versus explicit best-effort loss decisions, and run the complete browser conversion in a cancellable dedicated Worker. Validate an authored Chinese Word fixture against independent XWPF, native Word output, codec round trips and full browser task cleanup; broader format and Classic support remain separately tracked.

  增加实验性的 DOC 到 DOCX / LitAST API，经有预算的 typed OOXML 源计划和宿主注入的 DOCX 运行时完成转换。保留字体/样式定义与直接字段来源，区分严格拒绝及显式尽力模式的损失报告，并在可取消的专用 Worker 中执行完整浏览器转换。原创中文 Word 样本经独立 XWPF、原生 Word 对照、codec 往返及完整浏览器清理验证；更广格式与 Classic 支持继续单独跟踪。

- Convert legacy DOC inverse RTL flags over an unset style flag using the established converter baseline, with an explicit compatibility diagnostic. Preserve automatic direction elsewhere and retain the reported limitation on future inverse style inheritance.

  按成熟转换器的标志基线解释旧 DOC 中未设置样式方向时的 RTL 取反，并明确报告兼容处理。其他自动方向保持原义，未来样式取反继承的限制继续报告。

- Allow best-effort DOC conversion to omit a diagnosed out-of-range character-spacing residue only when the final document grid is disabled. Preserve each complex-field boundary's independent run formatting through LitAST JSON, DOCX regeneration and Classic round trips, including distant range endpoints.

  仅在最终文档网格关闭时，允许尽力 DOC 转换省略并报告超范围的字符间距残留。补齐复杂域各边界独立字符格式在 LitAST JSON、DOCX 重建及 Classic 往返中的保全，包括跨段范围的独立终点。

- Convert legacy DOC inline pictures through bounded PICF and OfficeArt readers, retaining media bytes, frame geometry, crop, transforms and alternative text with explicit source and browser limits. Preserve fractional image dimensions and declared media MIME types through LitAST parsing and fresh DOCX generation. Validate original POI picture fixtures and the Classic media, editing and history lifecycle.

  旧版 DOC 转换通过有界 PICF 与 OfficeArt 读取保留内联图片字节、目标尺寸、裁剪、变换及替代文字，并明确源格式和浏览器边界。LitAST 解析与全新 DOCX 生成保留分数像素尺寸和媒体 MIME 声明，使用 POI 原始图片样本验证，并覆盖 Classic 媒体、编辑及历史生命周期。

- Convert validated same-paragraph legacy textbox chains into independently anchored OOXML frames with one author story. Add JSON-safe LitAST links and native regeneration that preserves chain order through text and geometry edits; Classic retains those links with an explicit warning that cross-frame text layout is unavailable.

  将验证完整的同段落旧版文本框链转换为各自独立锚定、共用一份作者正文的 OOXML 框。补齐 JSON 安全的 LitAST 链接和原生新包生成，使正文及几何编辑后仍保留框顺序；Classic 保全关系，并明确提示尚无跨框文字排版。

- Convert ordinary single-frame body/header textboxes into editable rich-text drawings with exact source ownership and shared resource budgets. Normalize legacy SHAPE wrappers and preserve valid anchor locks through fresh native DOCX generation.

  将普通单框正文/页眉文本框转换为可编辑富文本绘图，保留精确源所属关系并共享资源预算；明确规范化旧 SHAPE 域外壳，原生 DOCX 重建继续保全合法锚点锁。

- Accept redundant nested-table paragraph frames only after proving that every row repeats the complete first-paragraph frame tuple of its actual enclosing positioned row. Keep the inner table in its original cell without a second floating position, and report the compatibility decision. Unproved frame ownership still rejects conversion.

  仅在证明每个内表行均重复实际包围定位行的完整首段框参数后，接纳嵌套表格的冗余段落框。内表保持在原单元格中，不重复生成浮动定位，并明确报告兼容决定；无法证明框归属时仍拒绝转换。

- Preserve legacy DOC numbering definitions, instances, levels and start overrides in the shared OOXML conversion pipeline, including zero starts and style-local references. Diagnose unsupported graphs atomically in best-effort mode and retain explicit limits for shared counters and downstream presentation.

  在统一 OOXML 转换链中保留旧版 DOC 的编号定义、实例、层级及起点覆盖，包括零起点与样式本层引用。尽力模式整图诊断不支持的编号，明确保留共享计数与后续呈现的支持边界。

- Add optional, resource-bounded DOC numbering source inspection in Node and browser Workers. Preserve definitions, instances, actual-level overrides, zero starts and inherited paragraph references without evaluating markers or expanding experimental conversion support.

  新增 Node 与浏览器 Worker 的可选、有资源上限的 DOC 编号源检查，保留定义、实例、按实际层级定位的覆盖、零起点及继承后的段落引用；不计算显示标记，也不扩大实验性转换的支持声明。

- Retain complete modern DOC list graphs when unsupported legacy ANLD style references coexist, with explicit style cancellation and loss reporting. Preserve lists referenced only by named styles during Classic export, keeping style defaults independent of paragraph restarts and prior review states.

  旧 ANLD 样式与现代编号并存时，保留完整现代编号图，对未支持旧样式显式取消并报告损失。Classic 导出保留只被命名样式引用的列表，样式缺省编号与段落重启、修订前状态保持独立。

- Preserve DOC paragraph outline levels through source defaults, style inheritance, direct formatting and ending-piece overrides. Project the existing OOXML outline field without replacing source styles or confusing outline level with list depth.

  保留 DOC 段落大纲级别的缺省、样式继承、直接格式和段末片段覆盖；投影既有 OOXML 大纲字段，保留源样式并区分大纲与列表层级。

- Convert ordinary legacy DOC page borders with generation-aware color precedence, original spacing and section positioning. Preserve self-contained page-border XML through JSON, Classic editing and fresh DOCX export, with explicit limits for native rendering and resource-bound borders.

  转换旧版 DOC 普通页面边框，按新旧记录优先级保留颜色、原始间距与分节定位。自包含页面边框 XML 可经 JSON、Classic 编辑和新 DOCX 导出继续保全，并明确原生绘制及资源关联边框的支持边界。

- Add optional paragraph base-format inspection in Node and browser Workers, resolving inherited paragraph styles, direct properties and ending-piece modifiers. Inspect alignment, indentation, spacing and pagination settings with bounded property chains, explicit unsupported-operation reporting and independent corpus regression admission.

  增加 Node 与浏览器 Worker 的可选段落基础格式检查，组合段落样式继承、直接属性和段末片段修改。读取对齐、缩进、间距与分页设置，限制属性链与执行预算，明确报告未支持操作，并建立独立语料回归准入。

- Add optional main-story paragraph boundary inspection in Node and browser Workers, validating paragraph formatting records and distinguishing section endings from inline page breaks. Preserve empty paragraphs and source positions, enforce paragraph/page budgets, and explicitly report unresolved formatting and table roles.

  增加 Node 与浏览器 Worker 的可选正文段落边界检查，校验段落格式记录并区分分节结束和段内分页。保留空段与源位置，限制段落/格式页数量，并明确报告尚未解释的格式及表格角色。

- Preserve legacy DOC paragraph shading, including palette and RGB colors, explicit clearing and named-style inheritance. Standard shading patterns survive OOXML conversion, with unsupported pattern and Classic paint limits reported explicitly.

  保留旧版 DOC 段落底纹的调色板与 RGB 颜色、显式清除和命名样式继承。标准图案经 OOXML 转换保全，未映射图案和 Classic 绘制限制明确报告。

- Apply legacy DOC paragraph style replacement in source order, clearing superseded paragraph overrides and numbering provenance and selecting the replacement character baseline. Emit the effective paragraph style in OOXML while preserving original source records and existing unsupported-format refusals.

  按源顺序应用旧 DOC 段落样式重置，清除被覆盖的段落直接格式和编号来源，并选用新样式的字符基线。OOXML 输出最终有效样式，原始源记录和既有未支持格式拒绝保持独立。

- Read and project custom paragraph tab stops with inherited/direct provenance, bounded deletion ranges and explicit compatibility diagnostics. Preserve tab positions and descriptors through DOCX and LitAST conversion, including legacy style tab records.

  读取并投影段落自定义制表位，保留样式与直接层来源、有界删除范围和明确兼容诊断，支持制表位位置及属性经过 DOCX 与 LitAST 转换，包括旧样式中的制表位记录。

- Preserve confirmed structural formatting during best-effort DOC conversion when paragraph, section or table properties have incomplete tails. Resolve bounded legacy indirect PAPX groups and report unavailable references as local losses while retaining strict validation and resource limits.

  DOC 默认尽力转换在段落、分节和表格属性尾部不完整时保留已确认的结构格式，兼容有界旧式间接 PAPX 属性组。不可用引用记录为局部损失，同时保留严格检查与资源上限。

- Keep a legacy DOC run's existing font script hint when character styles are applied or direct formatting is reset, including its direct-field provenance for OOXML projection. Report loss when the source explicitly provides no hint guidance, which has no OOXML equivalent.

  在应用字符样式或重置直接字符格式时保留旧版 DOC run 原有的字体脚本提示，并保留其本层字段来源，供 OOXML 投影使用。源值明确表示无提示指导而 OOXML 没有等值时，报告转换损失。

- Continue best-effort conversion through valid legacy side-by-side paragraph flags with an explicitly located unprojected-property loss. Retain invalid-value checks and strict-mode rejection.

  对有效的旧段落并排标志继续尽力转换，明确报告所属位置的未投影属性损失，保留非法值检查和严格模式拒绝。

- Convert ordinary textboxes whose next-shape record points to themselves when the original text descriptor, frame sequence and unique anchor prove a single frame. Keep real linked or ambiguous frames explicitly unsupported.

  在原文字描述、框序号与唯一锚点能确认单框时，兼容下一形状回指自身的普通文本框；真实链接框及所属关系不明确的框继续明确拒绝。

- Add an independent legacy Word text-storage reader for Node and browser Workers, with bounded CFB/FIB/CLX parsing, source diagnostics, cancellation and timeouts. This initial API inspects raw source text and positions; it does not yet convert DOC to LitAST or DOCX or enable Classic DOC import.

  新增 Node 与浏览器 Worker 共用的自有旧版 Word 文字存储读取器，提供有界 CFB/FIB/CLX 解析、源诊断、取消和超时。首批 API 检查原始文字与位置，尚未实现 DOC 到 LitAST/DOCX 转换或 Classic DOC 导入。

- Read legacy script hints and paragraph-style highlighting without rejecting otherwise supported DOC files. Keep character-style highlighting ignored according to mature Word import behavior, preserving inheritance, explicit clears and direct overrides with bounded diagnostics.

  兼容旧 DOC 样式中的脚本提示和段落样式高亮；按成熟 Word 导入规则忽略字符样式高亮，保留继承、显式清除和直接覆盖，并提供有界兼容诊断。

- Read current legacy Word table properties across validated revision checkpoints and author marks, reporting omitted property history explicitly. Encode preserved DOCX binary resources with bounded temporary ASCII storage so large media can complete the existing conversion and round-trip memory gate without changing encoded bytes.

  跨已验证的旧版 Word 表格修订检查点和作者标记读取当前属性，明确报告尚未投影的属性历史。DOCX 二进制资源编码改用有界临时 ASCII 存储，在不改变编码字节的前提下，使大媒体完成既有转换与往返内存门槛。

- Project legacy DOC table grids, preferred dimensions, row settings and horizontal/vertical merges while retaining physical continuation cells and explicit loss boundaries. Preserve false table-header values in LitAST. Derive Classic horizontal merge rectangles for selection, splitting, history and clipboard output without rewriting source cells.

  旧版 DOC 转换保留表格网格、首选尺寸、行属性及横纵合并，保全物理续格并明确未支持边界；LitAST 保留显式 false 标题行。Classic 派生横向合并矩形，贯通选择、拆分、历史和剪贴板，不改写原始源格。

- Apply shared PAPX table-end flags only to their owning final paragraph. Best-effort conversion now reports local defaults for uncovered paragraph properties and accepts a bounded one-byte discrepancy in complete terminal table definitions, preserving confirmed structure and formatting.

  共享 PAPX 的表格结束标志仅作用于所属末段。默认尽力转换为没有属性覆盖的段落报告局部缺省，并兼容完整末尾表定义的一字节长度偏差，保留已确认的结构与格式。

- Add optional bounded main-story table topology inspection with nested parent-cell ownership, separate row markers, definition-count checks and adjacent-table identity. Keep unsupported formatting and boundary cases explicit, and verify the original table assertions plus independent corpus and browser parity.

  增加可选、有界的正文表格拓扑检查，保留内表所属父格、独立行末，校验格定义数与相邻表身份。明确未支持的格式和边界情况，并以原表格断言、独立语料和浏览器一致性验证。

- Read a missing final main-story paragraph-mark character layer only when both original formatting endpoints identify that exact boundary. Preserve its paragraph-style baseline without extending preceding direct formatting; keep ordinary gaps and auxiliary stories rejected.

  仅在原字符索引与末页共同确认精确终点时，兼容正文最后段落标记缺失的字符直接层；保留原段落样式基线，不延长前字格式，普通缺口与辅助 Story 仍明确拒绝。

- Add bounded body/header textbox source inspection, preserving complete chain descriptors, display fragments, spare slots and original terminal operands with full browser Worker validation.

  新增有界正文/页眉文本框源检查，完整保留文本链、显示分片、备用槽与原始终点，并验证浏览器 Worker 的完整结果。

- Preserve diagnosed zero font sizes from legacy DOC producers in best-effort conversion, while reporting their unsupported portable rendering and rejecting them in strict mode. Retain isolated zero OOXML size properties through fresh JSON/DOCX round trips and supported author size replacement.

  尽力转换时保留旧版 DOC 生产者写入的零字号，明确报告其可移植显示尚未支持，严格模式拒绝。单独的零字号 OOXML 属性可经过 JSON、新 DOCX 往返以及合法作者字号替换。

- Read legacy CFB files whose explicitly located FAT sectors use ENDOFCHAIN self markers, reporting the compatibility decision while retaining exclusive metadata ownership and full chain validation. Expand pinned POI text and paragraph assertions across Node and browser Workers.

  兼容由 DIFAT 明确定位、但自身项使用 ENDOFCHAIN 的旧版 CFB FAT 扇区，报告兼容决定并保留元数据独占与完整链校验。扩充固定 POI 正文与段落原始断言，覆盖 Node 和浏览器 Worker。

- Add optional bounded field indexes for all seven legacy Word document parts in synchronous and browser Worker inspection. Preserve original positions, reserved marker bits and distinct end flags. Admit nonstandard bounded root labels while retaining directory and allocation validation.

  同步与浏览器 Worker 检查新增七个旧版 Word 文档部分的有界域索引，保留原始位置、标记保留位和独立结束状态。兼容有效长度内的非标准根标签，继续校验目录与分配结构。

- Inspect bounded legacy Word floating drawing anchors, group ownership and complete source property layers in Node and browser Workers. Share OfficeArt record/property decoding with inline pictures, preserve both declared and physical image-store counts, and enforce drawing depth, count and complex-byte limits. Source inspection retains explicit boundaries for native picture, watermark and textbox conversion.

  在 Node 与浏览器 Worker 内检查旧版 Word 的有界浮动绘图锚点、组所属关系和完整源属性层。与内联图片共享 OfficeArt 记录及属性解码，保留声明和实际图片库存计数，限制绘图深度、数量及复杂字节分配；源检查继续明确原生图片、水印与文本框转换的独立边界。

- Convert ordinary legacy Word floating pictures through shared bounded OfficeArt and media readers. Preserve original image bytes, creation dimensions, independent position axes, paint order, basic wrapping, distances, crop, transforms and metadata in DOCX and fresh LitAST exports. Report contour approximation and unsupported object roles explicitly, with shared document-wide picture budgets in Node and browser Workers.

  通过共享的有界 OfficeArt 和媒体读取器转换旧版 Word 普通浮动图片，在 DOCX 与全新 LitAST 导出中保留原图片字节、创作尺寸、独立双轴位置、层级、基本环绕、距离、裁剪、变换及元数据。轮廓近似与未支持对象角色明确报告，Node 和浏览器 Worker 共享文档级图片预算。

- Convert legacy DOC floating-table positions, text clearances and overlap rules, including tables in headers and footers. Accept stale header directories when the header story is empty. Honor explicit clearing of imported table-position aliases across Classic layout and DOCX export.

  转换旧版 DOC 浮动表格的位置、文字距离与重叠规则，覆盖页眉页脚中的表格。兼容空页眉故事的残留目录。Classic 布局与 DOCX 导出统一遵循表格定位属性的显式清除，避免导入别名重新生效。

- Accept bounded zero padding after complete legacy DOC font names and retain explicit compatibility diagnostics. Stabilize generated DOCX ZIP entry timestamps so identical conversion inputs produce consistent package bytes and preserved-resource identities across Node and browser workers.

  兼容旧版 DOC 完整字体名称之后的有界零填充，并保留明确的兼容诊断。统一生成 DOCX 的 ZIP 条目时间，使相同转换输入在 Node 和浏览器 Worker 中产生一致的包字节及保全资源身份。

- Add bounded DOC header/footer source inspection and conversion with section variants, inheritance, explicit blank stories, shared numbering, and per-part image relationships. Isolate known optional story failures with explicit loss diagnostics and document-wide work budgets.

  增加有界 DOC 页眉页脚源检查与转换，保留分节变体、继承、显式空故事、共享编号和各部件图片关系。已知可选故事失败以明确损失诊断隔离，并共用文档工作预算。

- Read flat Word 97/2000 tables that declare direct membership without a depth operation, with an explicit compatibility diagnostic. Continue rejecting explicit zero depths, conflicting inner-table markers, and invalid row or cell boundaries.

  兼容读取仅声明直接成员、未存储深度操作的 Word 97/2000 外层表格，并明确报告兼容决定。显式零深度、冲突内表标记及非法行格边界继续拒绝。

- Convert automatic legacy DOC footnotes and endnotes with rich author content, connected part graphs and document-wide allocation budgets. Keep optional story refusals explicit and prevent orphaned notes. Preserve table cell paint when auxiliary stories receive page-local geometry identities.

  转换旧版 DOC 的自动脚注尾注，保留富正文、完整部件引用图和整文档分配预算。明确报告可选故事拒绝并避免孤立注释。修复辅助故事生成页面几何身份时表格单元格文字未绘制的问题。

- Preserve legacy DOC note numbering and placement in document settings and section overrides, keeping explicit zero and source restart semantics. Retain section-end endnote suppression through LitAST and regenerated DOCX, including explicit false. Report native editor limitations and keep settings connected to the actual note parts.

  将旧版 DOC 脚注尾注编号与位置保留到文档设置和分节覆盖，保留显式零与源重启语义。LitAST 和重新生成的 DOCX 保留节末尾注抑制及显式 false。明确报告编辑器原生消费边界，并使设置始终关联实际 note 部件。

- Add bounded footnote and endnote source inspection in Node and browser Workers, including exact reference positions, content ranges, automatic/custom selectors, and a shared note-count limit.

  为 Node 和浏览器 Worker 增加有界脚注尾注源检查，保留精确引用位置、内容区间、自动或自定义标记选择值，并共用注释数量上限。

- Read bounded ANLD80 metadata and its independent color operation without rejecting otherwise convertible legacy Word files. Keep legacy numbering explicitly unprojected, reject malformed descriptor envelopes, and preserve admitted text and media through DOCX and AST export.

  有界读取 ANLD80 元数据及独立颜色操作，使其他内容可转换的旧 Word 文件继续处理。旧编号保持明确未投影，非法记录包络继续拒绝，已准入正文及媒体经过 DOCX 和 AST 导出保留。

- Recover later legacy Word pictures with stale zero ClientAnchor values through unique same-part CP/FSPA-to-shape associations. Report the compatibility decision, reject ambiguous or nonzero conflicting references, and verify original media, native picture placement and editing through Node and browser conversion.

  通过同一文档区域内唯一的 CP/FSPA 与形状关联，恢复 ClientAnchor 残留零值的后续旧版 Word 图片。明确报告兼容决策，拒绝歧义及非零冲突引用，并验证 Node 与浏览器转换中的原媒体、原生图片位置及编辑往返。

- Add optional, bounded inspection of legacy Word revision-author tables in Node and browser Workers. Preserve original author slots, whitespace and table presence, and validate malformed Worker responses. This exposes source metadata without claiming insertion/deletion conversion support.

  在 Node 和浏览器 Worker 中增加可选、有界的旧版 Word 修订作者表检查，保留原始作者槽、空白姓名及表存在性，并校验异常 Worker 回复。本次提供源元数据，正文插入和删除修订转换仍待接入。

- Read bounded legacy section outline and color records without blocking otherwise admitted DOC content. Report omitted outline definitions and restart/color settings explicitly, retain strict rejection, and keep existing modern and legacy numbering boundaries unchanged.

  有界读取旧分节大纲及独立颜色记录，使其他已准入 DOC 内容可以继续转换。明确报告未投影的大纲定义、重启及颜色设置，保留严格模式拒绝，并保持既有现代和旧编号边界。

- Read valid legacy frame-overlap flags in paragraph styles with an explicit compatibility diagnostic and per-style unprojected loss. Preserve imported Picture anchor-lock booleans through Classic export and JSON while retaining current edited geometry.

  兼容段落样式中的有效旧框架重叠标志，明确报告兼容决定和各样式的未投影损失。Classic 图片导出及 JSON 往返保留导入的锚点锁定布尔值，并使用当前编辑后的几何数据。

- Inspect complete main-story legacy Word review states and import ordinary tracked text and paragraph marks through the existing OOXML, LitAST and Classic revision owners. Preserve original blank authors and floating minute-resolution dates, keep missing metadata distinct, and prevent stale format snapshots from duplicating paragraph revisions. Fix mixed whole-paragraph rejection ordering, exclusive endpoint ownership and failed-command transaction isolation. Unsupported review contexts retain explicit loss boundaries.

  检查旧版 Word 正文的完整审阅源状态，并通过既有 OOXML、LitAST 和 Classic 修订所有者导入普通修订文字与段末标记。保留原始空白作者和分钟精度无时区日期，区分元数据缺失，防止旧格式快照重复写出段末修订。修复混合整段拒绝顺序、右端点所有权及失败命令的事务隔离；未支持的修订上下文继续明确报告损失。

- Merge paragraph tab stops across style and direct formatting by position, consume explicit clear instructions without disabling the document grid, and retain each original layer for editing and DOCX round trips. Keep unsupported list tabs in canonical data without guessing their layout. Remove the obsolete legacy DOC inheritance warning while preserving unsupported-format diagnostics.

  按位置合并样式与直接格式的段落制表位，消费明确清除指令而不关闭文档默认网格，并保留各原始层用于编辑与 DOCX 往返。未支持的列表制表位保存在规范数据中，不猜测其布局。移除已解决的旧版 DOC 继承限制诊断，继续报告未支持格式。

- Default DOC conversion to best effort, isolate unreadable optional container streams, and recover validated main-story text as editable ordinary paragraphs after local source failures. Report recovery causes, omitted field caches and objects, unresolved display semantics, and unavailable source counts. Explicit strict conversion and source inspection retain validation, while input/output limits and cancellation remain enforced in Node and browser Workers.

  DOC 转换默认采用尽力策略，隔离不可读的可选容器流，并在局部源记录失败后将已验证正文恢复为可编辑普通段落。报告保留恢复原因、域缓存和对象省略、未解析显示语义及未知源计数。显式严格转换和源检查继续执行校验，Node 与浏览器 Worker 保留输入/输出限额与取消处理。
