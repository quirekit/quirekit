# @quirekit/renderer API

[English](./API.md) | 简体中文

本文说明 `@quirekit/renderer` 从 package root 导出的公共 API。除非未来版本明确声明稳定 subpath exports，
否则都应从 package root 导入。

```ts
import {
  compileQuireViewNode,
  createCanvasClusterGlyphRunPainter,
  createCanvasPathGlyphRunPainter,
  createQkView,
  createQuireViewContextKey,
  createQuireViewScope,
  createQuireViewTargetIndex,
  createQuireViewWidgetIndex,
  qkView,
  renderCanvasDisplayList,
  serializeSvgDisplayListToSvg,
  type QuireDisplayList
} from "@quirekit/renderer";
```

## 包结构 Package Shape

```text
@quirekit/renderer
  core    几何/范围/绘制算法与中立契约转导出
  browser 显式注入 Document 的共享文字度量
  canvas  Canvas 2D 绘制后端
  svg     SVG 序列化与真实 DOM 同步后端
  widget  qkView 工厂与编译器
```

这个包只把普通渲染数据转换成 Canvas 2D 调用、SVG 输出或新的 display-list 输出。它不创建编辑器状态，
不读取 ProseMirror 文档，也不处理浏览器输入。

## 浏览器文字度量

`layoutQuireText` 的 `wrapMode` 默认为 `word`，`anywhere` 允许任意字素间折行；`none`
只保留显式换行和空行，不按宽度添加新行。后者供按外框适配的文字使用，仍共享原有 shaping、
对齐和 cluster 几何；绘制外框的缩放由调用方负责。

可选 `tabs` 使用同一逻辑原点的 CSS 像素：`stops` 按位置递增；正有限
`defaultInterval` 在最后一个显式位置后继续默认网格，`offset` 表示当前区域前缘距
原点的距离，悬挂首行先到该前缘再继续网格。默认网格无前导符，每个Tab仍只占一个
源位置；缺省不改变普通文字行为。

`tryCreateQuireBrowserTextMeasurer({ ownerDocument, cacheSize? })` 返回可清理的测量器；
Canvas 2D 不可用时返回 `undefined`，由宿主决定报错或采用显式 fallback。它不读取全局
`document`，不监听字体加载，不依赖 mounted View。`measureText(text, font)` 返回 CSS px
宽度、可用的字体盒 ascent/descent，以及脚本相关的 `normal` 行高，不使用当前字形墨迹高度。
`clear()` 用于字体变化后或生命周期结束时清空缓存；默认每缓存最多 2048 项。

`QuireTextCommand` / `QuireGlyphRunCommand` 的可选 `trailingSpacing` 是包含在 `rect.width`
中的布局尾部推进，不是作者字距，也不是字形横向缩放。原生文本拟合须从占位宽度扣除它；
独立定位的下一片段原点、选区和命中仍使用完整占位几何。

文本 run 与 text/glyph-run 命令可声明正有限 `horizontalScale` 比例（默认 1）。
布局缩放自然 advance 和 glyph 的水平位置，字距、行高和基线独立；命令矩形与 glyph
位置已经是最终几何。Canvas/SVG 在绘制时反投影水平位置，再围绕原点施加水平 affine。
自定义 glyph painter 收到反投影后的命令；Canvas 绘制上下文已施加缩放，SVG 返回节点由
surface 放入带缩放变换的 group。两种 painter 均不得重复乘比例。
Word 百分比等语义由文档 profile 转换，本包不解析。详见[字符缩放合同](../../docs/research/word-text-scale.zh-CN.md)。

`layoutQuireText` 的可选 `autoSpacing: QuireTextAutoSpacing` 控制同一行槽内汉字与拉丁字母
（`ideographAlpha`）、ASCII 数字（`ideographNumeric`）的相邻间距。数值是汉字一侧字号的
em 比例，须有限且非负；省略或 0 不添加间距，Word 等文档 profile 自行选择比例。
间距参与断行、cluster advance 和独立绘制定位，不改变源文本或位置；已有空白、替换节点、
换行和行槽边界不重复补距。基础范围不含复杂 RTL 边界、竖排或完整东亚网格挤压。

## 核心数据 Core Data

中立类型的唯一实现来源为 MIT 的 `@quirekit/render-contract`，本包为兼容继续转导出。
几何算法、组件编译及绘制实现在本包中。

核心数据类型是 widget 编译器、Canvas 后端、SVG 后端和编辑器视图包之间的共同语言。

### 几何 Geometry

几何 API 描述渲染坐标系中的点和矩形。它会用于命令边界、widget 布局、overlay 放置和脏区计算。

| API | 含义 | 说明 |
| --- | --- | --- |
| `QuirePoint` | `{ x, y }` 点坐标。 | 坐标只是普通数字。调用方决定它代表 CSS 像素、文档单位还是已变换单位。 |
| `QuireSize` | `{ width, height }` 尺寸。 | 宽高应为非负数。 |
| `QuireRect` | `{ x, y, width, height }` 矩形。 | 用于 display-list command、widget 输出、overlay 和 SVG viewbox。 |
| `isQuireRectFinite(rect)` | 判断坐标与尺寸是否有限，且尺寸非负。 | 非有限值和负尺寸 fail closed，不在 Renderer 内隐式翻转。 |
| `isQuireRectEmpty(rect)` | rect 非法或没有正面积时返回 `true`。 | 零面积仍可参与距离计算，但不参与绘制或正面积相交。 |
| `containsQuirePoint(rect, point)` | 判断点是否落在矩形内，边界也算命中。 | 适合轻量命中测试。 |
| `intersectQuireRects(first, second)` | 返回两个矩形的正面积交集；无交集时返回 `null`。 | 适合裁剪 invalidation 或可见区域。 |
| `doQuireRectsIntersect(first, second)` | 判断两个合法 rect 是否有正面积交集。 | 只接触边或角时返回 `false`。 |
| `doesQuireRectIntersectAny(rect, candidates)` | 判断 rect 是否与候选数组中的任意 rect 有正面积交集。 | 空数组返回 `false`；`undefined` 的 unbounded 语义由调用方保留。 |
| `measureQuireRectDistanceSquaredToPoint(rect, point)` | 返回点到 rect 的欧氏距离平方。 | rect 内部/边界为 `0`；非法几何返回 `Infinity`。 |

### 文档坐标 Document Coordinates

文档坐标只是可以跟随渲染输出流动的 metadata。Renderer 会保存它，但不会解释或修改 ProseMirror 文档。

| API | 含义 | 说明 |
| --- | --- | --- |
| `QuireDocumentPositionBias` | `-1 | 0 | 1`，用于歧义位置的方向偏好。 | 编辑器层可用它解析 caret affinity。 |
| `QuireDocumentPosition` | 文档位置和可选 bias。 | 渲染输出可以携带这个 metadata，供后续映射。 |
| `QuireDocumentRange` | `{ from, to }` 文档范围。 | 用于文本片段、overlay 和选区几何。 |
| `isQuireDocumentRangeEmpty(range)` | 当 `to <= from` 时返回 `true`。 | 生成选区或 overlay metadata 前可先判断。 |

### 显示列表 Display Lists

Display list 是 renderer 已解析后的绘制格式。它可序列化、与后端无关，并同时被 Canvas 和 SVG 消费。

| API | 含义 | 说明 |
| --- | --- | --- |
| `QuireDisplayCommand` | `fill-rect`、`text`、`glyph-run`、`caret`、`line`、`path`、`image`、`clip` 命令联合类型。 | 命令包含精确几何和绘制字段。`glyph-run` 还会携带 shaped glyph placement metadata、`glyphCoverage` 和 fallback text paint data。 |
| `QuireDisplayCommandLayer` | `"content" | "overlay"`。 | Overlay 命令可以从持久内容中拆出来。 |
| `QuireDisplayList` | `{ bounds, commands }`。 | `bounds` 是这批命令的 viewport / clear area。 |
| `QuireDisplayListLayers` | 拆分后的 `{ content, overlay }` 输出。 | 两个 list 保留同一份 bounds。 |
| `splitQuireDisplayListLayers(displayList)` | 把 overlay 命令从 content 命令中拆出来。 | 当视图想分开重绘内容与选区/caret overlay 时使用。 |
| `createQuireRoundedRectPathSegments(rect, radius)` | 创建顺时针、固定拓扑的圆角矩形 path segments。 | radius 会归零或限制到半短边；非法/零面积 rect 返回空数组。 |
| `readQuireDisplayCommandPaintBounds(command)` | 读取 command 的 renderer-neutral 近似绘制边界。 | 非法或缺失运行时几何返回 `null`，调用方必须采用保守的 unknown-bounds 策略。 |

### DOM 覆盖层 DOM Overlays

`QuireLayoutDomOverlay` 描述一个应该挂在 Canvas 或 SVG 上方的真实 DOM 岛。它包含稳定 id、几何、
可选文档范围、HTML 和无障碍 metadata。

Renderer 只输出 descriptor。真实 DOM 挂载、事件路由、focus、IME 和编辑器事务都由调用方负责。

### 绘制表面 Draw Surface

`QuireDrawSurface` 是渲染后端共享的命令式绘制协议。想让自定义 target 消费标准 display-list command
时，可以实现这个协议。

| API | 作用 | 参数 |
| --- | --- | --- |
| `paintQuireDisplayCommand(surface, command)` | 把一条 display-list command 分发到 `QuireDrawSurface`。 | `surface` 是你的后端实现，`command` 是一条 `QuireDisplayCommand`。 |

## Canvas 2D 输出 Canvas API

最终目标是浏览器 `CanvasRenderingContext2D` 或兼容测试/mock context 时，使用 Canvas API。

| API | 作用 | 参数与效果 |
| --- | --- | --- |
| `createCanvas2DDrawSurface(target)` | 把 Canvas 2D-like target 适配成 `QuireDrawSurface`。 | `target` 需要实现 display commands 会用到的方法，例如 `fillRect`、`fillText`、path、clip 和 image drawing。 |
| `renderCanvasDisplayList({ displayList, target })` | 先清理 `displayList.bounds`，再把所有命令绘制到 `target`。 | 调用方负责 canvas 尺寸、device-pixel-ratio scaling、调度和 retained-state 策略。 |
| `createCanvasClusterGlyphRunPainter()` | 创建一个可选的 glyph-run painter，通过原生 `fillText` 把源文本 cluster 绘制到 shaped offset 上。 | 适合诊断和早期 shaped-placement 验证。它不是真正的 glyph-id/path backend，可能丢失跨 cluster kerning。明确需要这个行为时，通过 Canvas render options 的 `glyphRunPainter` 传入。 |
| `createCanvasPathGlyphRunPainter(source)` | 创建一个可选的 glyph-run painter，填充调用方提供的 glyph outline。 | `source.getGlyphPath({ glyphId, font, fontId?, fontFamily? })` 必须返回 glyph-local CSS-pixel path segments。`font` 是 run 的 fallback CSS font shorthand，outline registry 可以用它解析绘制字号。它只会尝试接管 `glyphCoverage: "complete"` 的 run；coverage partial、缺少 outline 或缺少 Canvas path API 时都会回落到原生整段 `fillText`。 |
| `CanvasGlyphPathSource` | 把 glyph id 和可选 font identity 解析成 path outline。 | 这个抽象把字体解析、atlas/path cache、fontkit/HarfBuzz 相关状态留在 display-list contract 之外。 |
| `Canvas2DRenderTarget` | Renderer 需要的最小 Canvas 2D-like target 类型。 | 浏览器 `CanvasRenderingContext2D` 可直接使用。 |
| `CanvasGlyphRunPainter` | 可以完整接管一条 `glyph-run` command 并返回 `true` 的 adapter hook。 | 返回 `false` 时 Canvas adapter 会回落到原生整段 `fillText`。 |
| `Canvas2DRenderOptions` | `{ displayList, target, glyphRunPainter? }`。 | 传给 `renderCanvasDisplayList`。 |

编辑器默认的 Canvas 文本绘制仍然是整段 native `fillText`。
`CanvasClusterGlyphRunPainter` 是 shaped-placement 诊断工具，但它仍然用 `fillText`
绘制文本切片。`createCanvasPathGlyphRunPainter(source)` 只适合在 command 具备完整 glyph
coverage、且 source 能解析每个 outline 时做 exact-paint 实验。HTML editor runtime
不参与 Canvas 文本绘制 diff，因为它验证的是 DOM-mode 兼容性和浏览器 layout，而不是
Canvas display-list adapter。

## SVG 输出 SVG API

需要确定性 markup、快照、导出或已挂载 SVG runtime 时，使用 SVG API。

| API | 作用 | 参数与效果 |
| --- | --- | --- |
| `serializeSvgDisplayListToSvg(options)` | 把 display list 转成 SVG 字符串。 | 必须传 `options.displayList`。可选 overlays 和 viewport 会影响生成的分组和 viewbox。 |
| `syncSvgDisplayListToSvg(options)` | 用 content、overlay 和 DOM-overlay groups 替换 live SVG host。 | 适合已挂载浏览器视图。Host element 会被更新到当前 display list 状态。 |
| `createSvgSvgDrawSurface(options)` | 创建一个会追加 SVG elements 的 `QuireDrawSurface`。 | 自定义 serializer 想复用标准 command dispatcher 时使用。 |
| `SvgSerializeOptions` | Display list，以及可选 overlays 和 viewport。 | 传给 SVG serialization。 |
| `SvgSyncOptions` | SVG host，以及 display list、overlays 和 viewport。 | 传给 live DOM sync。 |
| `SvgDrawSurfaceOptions` | SVG parent 和可选 `defs`。 | 传给 SVG draw-surface creation。 |

## qkView 组件 qkView Widgets

`qkView` 是声明式书写层。你先创建一棵 `QuireViewNode` 树，再把它编译成 `QuireDisplayList` 和 DOM overlay
descriptors。

```ts
const output = compileQuireViewNode({
  id: "badge",
  origin: { x: 0, y: 0 },
  constraints: { minWidth: 0, maxWidth: 200, minHeight: 0, maxHeight: 48 },
  node: qkView.surface({
    padding: qkView.insets({ top: 4, right: 8, bottom: 4, left: 8 }),
    style: { fill: "#ecfeff", stroke: { color: "#67e8f9" } },
    child: qkView.text({
      text: "Ready",
      style: { font: "600 12px system-ui", color: "#155e75" }
    })
  })
});
```

### 布局与容器工厂 Layout And Container Factories

| API | 作用 | 关键参数 |
| --- | --- | --- |
| `qkView.surface(options)` | 语义化容器，可以绘制 fill/stroke 外框，并把一个 child 放进可选 padding 内。 | `width`、`height`、`padding`、`style.fill`、`style.stroke`、`child`。常见 card/callout 应优先用它，而不是手写 background box 加 overlay。 |
| `qkView.flex(options)` | 按显式 `direction` 布局 children：`"row"` 或 `"column"`。 | `direction`、`children`、`gap`、`padding`、可选固定 `width`/`height`。 |
| `qkView.row(options)` | `qkView.flex({ direction: "row" })` 的快捷写法。 | 适合 toolbar-like 横向内容。 |
| `qkView.column(options)` | `qkView.flex({ direction: "column" })` 的快捷写法。 | 适合 title/body 纵向内容。 |
| `qkView.overlay(options)` | 所有 children 从同一个 origin 按数组顺序绘制。 | `children`，可选 `width`/`height`。适合强调绘制顺序的 layered output。 |
| `qkView.positioned(options)` | 相对当前 parent bounds 定位一个 child。 | `left`、`right`、`top`、`bottom`、可选 `width`/`height`、`child`。通常放在 `overlay` 内使用。 |
| `qkView.padding(options)` | 只影响布局，把一个 child 向内缩进。 | `insets`、`child`。用于 spacing，不用于绝对定位。 |
| `qkView.clip(options)` | 用矩形 clip 包裹 child commands。 | 可选 `width`/`height`、`child`。 |
| `qkView.spacer(options)` | 保留固定空白，或消费 flex 剩余空间。 | `width`、`height`、`flex`。`flex` spacer 只会在 `qkView.flex`、`row` 或 `column` 中增长。 |

### 绘制与覆盖层工厂 Paint And Overlay Factories

| API | 作用 | 关键参数 |
| --- | --- | --- |
| `qkView.box(options)` | 绘制填充和/或描边矩形。 | `width`、`height`、`style.fill`、`style.stroke`。适合简单标记或底层绘制。语义化容器优先用 `surface`。 |
| `qkView.text(options)` | 绘制一条单行 text command。 | `text`、可选 `width`/`height`、`style.font`、`style.color`、`style.lineHeight`、`style.baselineOffset`。它不做可编辑段落布局。 |
| `qkView.paragraphPreview(options)` | 为 widget chrome 绘制可自动换行或省略号截断的静态文本。 | `text`、`width`、可选 `height`、`maxLines`、`overflow: "visible" | "clip" | "ellipsis"`、`whiteSpace: "normal" | "nowrap"` 和文本 `style`。它明确是不可编辑预览，不拥有 PM position、选区、IME 或分页。 |
| `qkView.divider(options)` | 绘制轻量分隔线。 | `axis: "horizontal" | "vertical"`、可选 `width`、`height`、`style.color`、`style.width`。 |
| `qkView.customPaint(options)` | 通过 callback 返回 display commands 的 escape hatch。 | `width`、`height`、`paint(rect, id, runtime)`。调用方传入时，`runtime.host` 会暴露 compile-time host surface。用于 primitive 未覆盖的 paths、icons 或特殊绘制。 |
| `qkView.domOverlay(options)` | 输出带 resolved geometry 的 DOM overlay descriptor。 | `width`、`height`、`html`、`ariaLabel`。调用方仍然负责挂载和事件绑定。 |
| `qkView.insets(value)` | 归一化 inset shorthand。 | 接收数字或部分 `{ top, right, bottom, left }` 对象。 |
| `qkView.emptyInsets` | 可复用的零 inset 对象。 | 当 factory 需要显式空 padding 时使用。 |
| `createQkView<TContext>()` | 返回同一组 qkView factories，但会按指定 runtime event context 做类型化。 | 它不会创建或捕获 scope。直接事件 handler 需要推导 `event.context` 时使用。 |

当 card 或 callout 需要“像文本一样展示”，但它并不是可编辑文档段落时，用 `paragraphPreview`：

```ts
qkView.paragraphPreview({
  text: "A long callout body can be collapsed into one visual line.",
  width: 180,
  maxLines: 1,
  overflow: "ellipsis",
  whiteSpace: "nowrap",
  style: { font: "13px system-ui", color: "#475569", lineHeight: 20 }
});

qkView.paragraphPreview({
  text: "The same primitive can wrap when the UI wants the callout to grow.",
  width: 180,
  overflow: "visible",
  style: { font: "13px system-ui", color: "#475569", lineHeight: 20 }
});
```

可编辑的 PM `Paragraph` 节点仍然属于 document-flow layout engine。它需要 position mapping、选区矩形、
caret stops、IME composition geometry 和分页数据；静态 widget preview 不应该假装拥有这些编辑器语义。

### 编译器 Compiler

| API | 作用 | 参数与结果 |
| --- | --- | --- |
| `compileQuireViewNode(options)` | 把一棵 widget tree 编译成 display-list 输出。 | `options.id` 会作为生成命令前缀，`origin` 放置 root，`constraints` 限制布局，`node` 是根 widget。可选 `host` 会作为 `runtime.host` 暴露给 widget callbacks。返回 `rect`、`displayList`、`domOverlays` 和 `targets`。 |

### View Targets 与事件 Scope

可交互 widget 在 node spec 上声明事件绑定。Compiler 会把语义化或有事件的节点转换成 `QuireViewTarget`。
已挂载 surface 负责监听原生事件和 hit testing，然后通过 scope 派发。

| API | 作用 | 说明 |
| --- | --- | --- |
| `createQuireViewContextKey<T>(name)` | 创建 view scope 使用的类型化 provide/inject key。 | Key 只在 scope 内生效，不是全局可变状态。 |
| `createQuireViewScope(options?)` | 创建 runtime scope，负责 context、provided values、named handlers 和事件派发。 | 独立 renderer 可以直接用它，不需要 editor。Editor view 或 clone 应各自创建一个 scope。 |
| `QuireViewScope.provide(key, value)` | 为后续事件 handler 提供依赖。 | Handler 通过 `event.inject(key)` 或 `event.require(key)` 读取。 |
| `QuireViewScope.setHost(host)` | 更新后续事件可访问的 host surface。 | mount、remount、mode switch 或 host surface 替换后使用。detached 时传 `undefined`。 |
| `QuireViewScope.getHost()` | 读取当前 host surface metadata。 | 返回的对象与 `event.host` 相同。 |
| `QuireViewScope.registerEventHandler(id, handler)` | 注册一个 named event handler。 | 返回 cleanup function。Named handler descriptor 携带可序列化 id；direct handler 是本地 runtime closure。 |
| `QuireViewScope.dispatchViewEvent(options)` | 派发 target event 或 semantic event。 | 如果没有传 `options.binding`，scope 会沿 `options.path` 从最深 target 向外层 target 派发，并读取每个 target 的 `events[options.type]` binding。`event.target` 保持为最初命中的 target；`event.currentTarget` 会随当前 target 变化。 |
| `QuireViewScope.dispatchViewEventResult(options)` | 派发事件并返回 detailed cancellation state。 | Mounted runtime 需要在 handler 调用 `event.preventDefault()` 后跳过默认选区或 pointer 行为时使用。 |
| `createQuireViewTargetIndex(targets)` | 从编译后的 targets 构建查询索引。 | 在通过 scope 派发前，用它做 hit testing、ancestry lookup、role/part lookup 和 range-based lookup。 |
| `QuireViewTargetIndex.hitTest(point)` | 查找 renderer-space 点下最深且最上层的 pointer target。 | 返回的 hit 包含 `target`、`path` 和 `point`。`pointerEvents: "none"` 的 targets 会被忽略。 |
| `QuireViewTarget` | 已解析的 hit-test/event target。 | 包含 id、树路径、rect、可选 range、role、part、owner、pointer policy、cursor 和事件绑定。 |
| `QuireViewOwner` | 挂在 target 或 widget 上的 renderer-neutral owner metadata。 | 用它记录 target 是由 document node、mark、decoration、extension 或独立 widget family 产生的。Owner metadata 本身不会让 target 变成交互目标；只有 owner 的 target 默认 `pointerEvents: "none"`。 |
| `createQuireViewWidgetIndex(targets, options?)` | 把编译后的 targets 包装成虚拟 widget objects。 | 当调用方需要类似 DOM 的 `parent`、`children`、`ancestors`、`host` 和几何 helper methods，而不是直接处理裸 target records 时使用。`options.getHost` 可以让 widget 延迟读取当前 host。 |
| `QuireViewWidget` | 由 `QuireViewTarget` 支撑的虚拟 widget object。 | 暴露包含 `owner` 在内的 target metadata，以及 `targetPath`、`parent`、`children`、`ancestors`、`host`、`containsPoint(point)`、`containsPosition(pos)` 和 `overlapsRange(range)`。`targetPath` 可以直接传给 `QuireViewScope.dispatchViewEvent()`。它仍然是 renderer-neutral，不 import editor types，也不是 ProseMirror widget decoration。 |
| `QuireViewHost` | Renderer-neutral 的 host surface metadata。 | 包含 `kind`、可选 `id`、宿主拥有的 `surface` 和可选 metadata。它是 scope-owned runtime data，不是 `QuireViewNode` 的字段。 |
| `QuireWidgetRuntimeContext` | 传给 widget callbacks 的 runtime data。 | 当前暴露 `host`，与传给 `compileQuireViewNode({ host })` 的 host 对应。 |
| `QuireViewEventBinding` | qkView node 可接受的事件绑定。 | 可以是 `{ handler, payload }` 或 direct handler；不支持字符串简写。 |

```ts
declare const canvasElement: HTMLCanvasElement;

const OpenKey = createQuireViewContextKey<(id: string) => void>("open");
const scope = createQuireViewScope({
  host: {
    kind: "canvas",
    surface: canvasElement
  }
});

scope.provide(OpenKey, id => console.log(id));
scope.registerEventHandler("detail.open", event => {
  console.log(event.host?.kind);
  event.require(OpenKey)(event.target?.id ?? "");
});

const output = compileQuireViewNode({
  id: "button",
  origin: { x: 0, y: 0 },
  constraints: { minWidth: 0, maxWidth: 160, minHeight: 0, maxHeight: 48 },
  node: qkView.surface({
    id: "doc-1",
    role: "button",
    onClick: { handler: "detail.open" },
    child: qkView.text({ text: "Open" })
  })
});
const targetIndex = createQuireViewTargetIndex(output.targets);
const hit = targetIndex.hitTest({ x: 8, y: 8 });

if (hit) {
  scope.dispatchViewEvent({
    type: "click",
    point: hit.point,
    target: hit.target,
    path: hit.path
  });
}
```

### 约束工具 Constraint Helpers

把编译器嵌入更大 runtime 时，约束工具会比较有用。普通 extension 作者通常只需要传给
`compileQuireViewNode` 的 `constraints` 对象。

| API | 作用 |
| --- | --- |
| `createQuireWidgetConstraints(options)` | 归一化 min/max width 和 height，用安全默认值补齐缺失字段。 |
| `createTightQuireWidgetConstraints(size)` | 创建 min 和 max 都等于同一尺寸的 tight constraints。 |
| `createQuireWidgetInsets(value)` | 归一化 inset shorthand。 |
| `insetQuireWidgetConstraints(constraints, insets)` | 用 padding insets 收缩 constraints。 |
| `clampQuireWidgetDimension(value, min, max)` | 把单个尺寸限制到 min/max 范围。 |
| `resolveQuireWidgetDimension(value, min, max)` | 根据 constraints 解析可选固定尺寸。 |
| `isFiniteQuireWidgetDimension(value)` | 判断尺寸是否为 finite number。 |
| `emptyQuireWidgetInsets` | 常量 `{ top: 0, right: 0, bottom: 0, left: 0 }`。 |

## 导入建议 Import Guidance

推荐从根入口导入：

```ts
import {
  qkView,
  renderCanvasDisplayList,
  serializeSvgDisplayListToSvg,
  type QuireDisplayList
} from "@quirekit/renderer";
```

避免导入 `@quirekit/renderer/src/svg/sync` 这类私有源码路径。Root export 才是公共兼容边界。
