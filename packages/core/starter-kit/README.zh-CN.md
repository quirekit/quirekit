# @quirekit/starter-kit

[English](README.md)

为 `@quirekit/core` 一次安装常见富文本结构、文字格式、快捷键和撤销历史的扩展预设。

## 适合 / 不适合

- 适合从段落、标题、列表和基础文字格式开始搭建编辑器。
- 可以逐项配置或关闭，不必先了解每个独立扩展包。
- 它不是编辑器实例，也不包含工具栏或视图。不要将它装入 MSFE；Markdown 源码编辑器使用 [msfe-starter-kit](../../msfe/starter-kit/README.zh-CN.md)。

## 安装

下面同时安装运行示例需要的 Core 和原生 DOM 视图。

```bash
npm install @quirekit/core @quirekit/starter-kit @quirekit/dom-view
```

```bash
pnpm add @quirekit/core @quirekit/starter-kit @quirekit/dom-view
```

本包没有 peer 依赖；其普通依赖自动安装。Core 和 DOM 视图列在命令里，是因为示例直接导入它们。包提供 ESM 导出。

## 最小可运行示例

将代码放进浏览器 TypeScript 项目的入口，例如 `src/main.ts`，通过项目打包工具启动页面。

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { DomViewExtension } from '@quirekit/dom-view'

const element = document.createElement('div')
document.body.append(element)

const editor = new Editor({
  element,
  mode: 'dom',
  extensions: [StarterKit, DomViewExtension],
  content: '<p>Hello QuireKit</p>',
})

console.log(editor.getJSON())
```

页面显示可编辑段落，控制台输出结构化内容。后面的片段沿用这里的导入和 `editor`。

## 核心概念与包含的扩展

- **预设**是一个包含其他扩展的扩展。`extensions: [StarterKit]` 不需要展开数组。
- **节点与标记**分别描述文档结构和文字格式；没有对应节点的 Schema 无法存放那种内容。
- **配置项**对应下表中的键。多数键接受选项对象或 `false`；`baseKeymap` 只接受布尔值。
- **视图**负责页面显示和输入；本包不提供视图，示例显式选择 `dom`。

以下是默认安装清单，不表示这些扩展都从本包根入口单独导出。

| 类别 | 安装的扩展 | 配置键 |
| --- | --- | --- |
| 基础结构 | Document、Paragraph、Text | `document`、`paragraph`、`text` |
| 块内容 | Blockquote、HardBreak、Heading、HorizontalRule、CodeBlock | `blockquote`、`hardBreak`、`heading`、`horizontalRule`、`codeBlock` |
| 列表 | BulletList、OrderedList、ListItem、ListKeymap | `bulletList`、`orderedList`、`listItem`、`listKeymap` |
| 文字格式 | Bold、Code、Italic、Strike、Underline | `bold`、`code`、`italic`、`strike`、`underline` |
| 编辑行为 | Gapcursor、TrailingNode、BaseKeymap、UndoRedo | `gapcursor`、`trailingNode`、`baseKeymap`、`undoRedo` |

Gapcursor 允许在部分块节点之间定位光标；TrailingNode 在需要时补上可继续输入的末尾段落；BaseKeymap 提供基础编辑按键；UndoRedo 提供历史记录。

## 常见任务

### 配置标题层级，关闭代码块

```ts
const configuredKit = StarterKit.configure({
  heading: { levels: [1, 2, 3] },
  codeBlock: false,
})
```

创建 Editor 时用 `[configuredKit, DomViewExtension]` 替换原 `extensions` 数组。配置在初始化时生效；这段代码不会修改已创建的 `editor`。

### 单独替换一个行为扩展

```ts
import { UndoRedo } from '@quirekit/starter-kit'

const historyExtensions = [
  StarterKit.configure({ undoRedo: false }),
  UndoRedo.configure({ depth: 200, newGroupDelay: 500 }),
  DomViewExtension,
]
```

把 `historyExtensions` 传给新 Editor。先关闭预设里的同一功能，避免安装两份。仅修改选项也可以直接写 `StarterKit.configure({ undoRedo: { depth: 200 } })`。

### 执行格式命令，读取内容并清理

```ts
editor.chain().toggleBold().run()
editor.commands.setHeading({ level: 2 })
editor.commands.undo()
console.log(editor.getJSON())
```

命令由已安装的子扩展提供。关闭某项后，不要再调用它的命令。离开页面或组件时清理实例：

```ts
editor.destroy()
```

## 和其他包的关系

| 包 | 分工 |
| --- | --- |
| [@quirekit/core](../editor/README.zh-CN.md) | 创建 Editor、执行命令和保存文档状态 |
| `@quirekit/dom-view` | 提供示例中的原生浏览器编辑区域 |
| [@quirekit/extensions](../../extensions/extensions/README.zh-CN.md) | 提供本预设使用的部分编辑行为，以及占位、计数等可选功能 |
| [@quirekit/msfe-starter-kit](../../msfe/starter-kit/README.zh-CN.md) | 另一套 Markdown 源码预设，不能与本预设互换 |

## 当前限制

- `0.x` alpha 尚未稳定，配套 QuireKit 包应保持同一版本。
- 默认不包含链接、图片、表格、占位文本或字数统计；需要另外安装对应扩展。
- 关闭 `document`、`paragraph`、`text` 等基础结构之前，必须提供能组成有效 Schema 的替代实现。列表子项也有结构依赖，不能任意删除后仍假定列表可用。
- 预设不提供持久化、工具栏、分页或协同服务，也不承诺任意 HTML 或未知 JSON 的无损导入。

## 许可

MIT，见 [LICENSE.md](LICENSE.md)。第三方许可声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
