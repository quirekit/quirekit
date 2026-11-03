# @quirekit/msfe-starter-kit

[English](README.md)

为 MSFE 组合标题、粗体、链接、图片和常见正文呈现的 Markdown 功能预设。

## 适合 / 不适合

- 适合从一组现成 Markdown 功能开始，再按需关闭或替换其中一项。
- 它遵循源码优先：Markdown 文本是权威内容，视觉呈现不会变成另一份富文本文档。
- 不适合拿来做完整 Markdown 渲染器或所见即所得产品界面。预设不带工具栏，也不保证覆盖所有方言。
- 它只供 MSFE 使用，不是 `@quirekit/core` 的 StarterKit。

## 安装

```bash
npm install @quirekit/msfe-core @quirekit/msfe-starter-kit
```

```bash
pnpm add @quirekit/msfe-core @quirekit/msfe-starter-kit
```

本包没有 peer 依赖；内含功能包是普通依赖，会自动安装。示例直接导入 Core，所以将它显式列出。包提供 ESM 导出。

## 最小可运行示例

把下面代码放进浏览器 TypeScript 项目的入口，例如 `src/main.ts`，通过项目打包工具运行。

```ts
import { createMsfeEditor } from '@quirekit/msfe-core'
import { StarterKit } from '@quirekit/msfe-starter-kit'

const parent = document.createElement('div')
document.body.append(parent)

const editor = createMsfeEditor({
  parent,
  markdown: '# A note\n\n**Bold**, *emphasis*, and `code`.\n',
  mode: 'live',
  extensions: [StarterKit],
})

console.log(editor.getMarkdown())
```

页面显示可编辑正文，控制台仍输出包含标记的 Markdown。编辑器自带基本显示样式，不需要另外导入主题 CSS。后面的片段沿用这里的导入和 `editor`。

## 核心概念与包含的扩展

- **预设**是包含子扩展的定义，直接使用 `[StarterKit]`。
- **源码呈现**只改变显示。`source` 模式保留完整语法标记；`live` 模式为支持的语法提供格式或组件，编辑时仍可能显露标记。
- **配置值**是 `false` 或一个完整扩展定义，而不是该功能的裸选项对象。这一点与富文本 StarterKit 不同。
- **命令**随功能安装；禁用某个功能后，即使类型里还看得到它的方法，也不代表实例能执行。

| 配置键 | 默认功能 |
| --- | --- |
| `heading` | 标题呈现与标题区段折叠 |
| `bold` | 粗体 |
| `link` | 链接 |
| `codeBlock` | 围栏代码块 |
| `image` | 图片呈现 |
| `emphasis` | 强调 |
| `inlineCode` | 行内代码 |
| `strikethrough` | 删除线 |
| `horizontalRule` | 分隔线 |
| `blockquote` | 引用正文与前缀 |
| `listMarkers` | 原生列表前缀 |
| `taskItem` | 任务复选框 |
| `table` | GFM 表格呈现 |
| `textLiterals` | 正文转义、实体与换行呈现 |
| `dataUrlFold` | 将长 base64 data URL 折成大小提示，不修改源码 |

GFM 是在普通 Markdown 上增加表格、任务列表等语法的一组约定。清单中的支持不代表完整 GFM 一致性。

## 常见任务

### 关闭某些功能

```ts
const configuredKit = StarterKit.configure({
  image: false,
  table: false,
})
```

在创建 Editor 时用 `[configuredKit]` 替换 `[StarterKit]`。关闭呈现功能不会删除文档里的图片或表格源码。

### 配置子扩展：关闭标题折叠

直接导入子包时，请显式安装它，不要依赖包管理器把传递依赖提升到顶层：

```bash
npm install @quirekit/msfe-heading
```

pnpm 对应命令为 `pnpm add @quirekit/msfe-heading`。

```ts
import { Heading } from '@quirekit/msfe-heading'

const noHeadingFolding = StarterKit.configure({
  heading: Heading.configure({ folding: false }),
})
```

将 `[noHeadingFolding]` 传给新 Editor。不要写 `heading: { folding: false }`：外层接收的是扩展定义。也不要同时额外安装另一份 Heading。

### 使用数组工厂

```ts
import { starterKit } from '@quirekit/msfe-starter-kit'

const featureExtensions = starterKit({ image: false })
```

把 `featureExtensions` 直接传给 `extensions`，不要写成 `[featureExtensions]`。`StarterKit` 是单个预设，`starterKit()` 返回扩展数组；选择一种写法即可，不要同时安装两份。

### 执行已安装的命令并清理

```ts
const accepted = editor.chain().setHeading(2).toggleBold().run()
if (!accepted) console.warn(editor.lastCommandResult)
editor.undo()
console.log(editor.getMarkdown())
```

命令返回布尔值；Core 自带历史入口 `undo()` / `redo()`，不是额外的预设功能。在页面或组件清理阶段执行：

```ts
editor.destroy()
```

## 和其他包的关系

| 包 | 分工 |
| --- | --- |
| [@quirekit/msfe-core](../core/README.zh-CN.md) | 编辑器、文本状态、模式、历史与保存读取 |
| `@quirekit/msfe-heading`、`msfe-bold`、`msfe-link`、`msfe-code-block`、`msfe-image` | 独立功能与其配置 |
| `@quirekit/msfe-prose` | 表中从 emphasis 到 dataUrlFold 的正文功能 |
| [@quirekit/msfe-vue](../vue/README.zh-CN.md) / [@quirekit/msfe-react](../react/README.zh-CN.md) | 将同一预设接入对应框架，不改变 Markdown 的权威性 |

## 当前限制

- `0.x` alpha 尚未稳定，配套 QuireKit 包请使用一致版本。
- 默认不包含 HTML 呈现、公式、脚注或图表等额外语法；未知或未启用的内容保留源码。
- 代码块语言高亮的语言加载器由宿主配置，预设不打包所有编程语言。
- 图片上传、私有资源鉴权和持久化由宿主提供；默认图片功能不等于上传服务。
- 列表、任务项和表格的呈现不代表任意复杂交互都已支持，也不提供任意可编辑组件正文。
- 初始化后不能靠重新赋值配置对象来热替换整套扩展。

## 许可

MIT，见 [LICENSE.md](LICENSE.md)。第三方许可声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
