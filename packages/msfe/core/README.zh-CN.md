# @quirekit/msfe-core

[English](README.md)

基于 CodeMirror 的 Markdown 源码编辑器内核，在保留源码的同时提供可切换的源码视图和即时呈现。

## 适合 / 不适合

- 适合把 Markdown 文件或字符串作为保存格式、希望直接控制命令和界面的应用。
- **源码优先**：唯一权威内容是 Markdown 文本，不是另存一份富文本树。即时呈现只改变显示，不通过反复转换来改写原文。
- 和所见即所得编辑器不同，编辑者仍会遇到 Markdown 标记；未支持的语法保留源码，不保证都有视觉呈现。
- 不适合需要任意富文本 JSON 结构、完整工具栏或由框架接管可编辑正文 DOM 的场景。

## 安装

示例一起安装默认功能预设。Core 本身没有需要另装的 peer 依赖，也不要求 Vue 或 React。

```bash
npm install @quirekit/msfe-core @quirekit/msfe-starter-kit
```

```bash
pnpm add @quirekit/msfe-core @quirekit/msfe-starter-kit
```

普通依赖由包管理器安装。只要源码编辑、不需要预设的视觉功能时，可以只安装 Core。包提供 ESM 导出。

## 最小可运行示例

将代码放入浏览器 TypeScript 项目的入口，例如 `src/main.ts`，通过项目打包工具运行。Core 自己挂载 CodeMirror，不需要额外的 QuireKit 视图包或主题 CSS 导入。

```ts
import { createMsfeEditor } from '@quirekit/msfe-core'
import { StarterKit } from '@quirekit/msfe-starter-kit'

const parent = document.createElement('div')
document.body.append(parent)

const editor = createMsfeEditor({
  parent,
  documentId: 'note-1',
  markdown: '# Hello\n\n**Markdown** stays the source.\n',
  mode: 'live',
  extensions: [StarterKit],
  onError: error => console.error(error),
})

console.log(editor.getMarkdown())
```

页面出现可编辑正文，控制台输出原始 Markdown。后面的片段沿用这里的 `editor`。不传 `mode` 时默认为 `source`，不传 `extensions` 时不会自动启用 StarterKit。

## 核心概念

1. **源码与位置**：正文是 CodeMirror 文本。逻辑位置从 0 开始，使用 UTF-16 单位；前导 BOM 不计入位置，CRLF 在内部算一个换行。BOM 是某些文件开头的编码标记。
2. **呈现模式**：`source` 显示源码；`live` 将已支持的语法呈现为格式或组件；`locked` 是不可编辑的即时呈现。它们共用同一文档和历史。`readOnly` 是独立的编辑权限设置。
3. **扩展与命令**：扩展安装语法、显示或命令。`commands` / `chain()` 返回布尔值；`can()` 查询命令能否执行，不修改文档。
4. **文档身份与版本**：`documentId` 标识宿主的文档，`revision` 标识实例接受的版本。外部修改必须说明它针对哪个版本，过期操作会被拒绝。
5. **宿主与生命周期**：应用负责加载、保存和资源权限；Editor 负责编辑状态及清理。切换文档使用 `replaceDocument()`，不再使用时调用 `destroy()`。

## 常见任务

### 监听变化，按需读取全文

```ts
const unsubscribe = editor.onChange(({ documentId, revision, changes, origin }) => {
  console.log({ documentId, revision, changed: !changes.empty, origin })
})

const markdownToSave = editor.getMarkdown()
console.log(markdownToSave)
```

变化事件携带增量，不含完整 Markdown。保存按钮或自己的保存策略需要全文时再调用 `getMarkdown()`，不要在每个按键后把全文复制进框架状态。输出保留输入时统一的 LF/CRLF 换行风格及 BOM。

### 执行命令，读取失败原因和撤销

```ts
const applicable = editor.can().toggleBold()
const accepted = editor.chain().setHeading(2).toggleBold().run()
if (!accepted) console.warn(editor.lastCommandResult)

console.log({ applicable, active: editor.isActive('bold') })
editor.undo()
editor.redo()
```

`setHeading()` 和 `toggleBold()` 由本例的 StarterKit 安装。链式操作全部成功才一次提交；`lastCommandResult` 提供拒绝原因。不要把布尔返回值当作带 `ok` 字段的对象。

### 区分修改当前文档与切换文档

对当前文档的外部文本修改使用 `applyChanges()`：

```ts
const documentId = editor.documentId
const baseRevision = editor.revision

const changeResult = editor.applyChanges({
  documentId,
  baseRevision,
  changes: { from: 0, insert: 'Introduction\n\n' },
  origin: 'host-edit',
})
if (!changeResult.ok) console.warn(changeResult.reason)
```

异步工作应在发起时捕获身份和版本，提交时仍用原值；不要换成最新版本来掩盖冲突。外部修改不进入用户撤销栈。

打开另一篇文档或明确重置内容时使用：

```ts
const replaceResult = editor.replaceDocument('# Another note\n', 'note-2')
if (!replaceResult.ok) console.warn(replaceResult.reason)
```

这会清空选区和撤销历史；它不是用于每次框架渲染的受控值同步接口。

### 切换显示、编辑权限和主题

```ts
editor.setMode('source')
editor.setMode('live')
editor.setReadOnly(true)
editor.setTheme('dark')
```

设置不会重建实例或另建历史。需要恢复输入时调用 `setReadOnly(false)`；`locked` 模式本身也阻止编辑。输入法组合期间的模式切换会延后。

### 增加一个快捷键扩展

```ts
import { Extension } from '@quirekit/msfe-core'

const AppShortcuts = Extension.create({
  name: 'appShortcuts',
  /** @returns 此扩展注册的快捷键。 */
  addKeyboardShortcuts() {
    return { 'Mod-Shift-y': () => this.editor.commands.insertText('Hello') }
  },
})

const initialExtensions = [StarterKit, AppShortcuts]
```

创建实例时把 `initialExtensions` 用作 `extensions`。这是 MSFE 自己的 Extension，不是 `@quirekit/core` 的同名类型；声明风格相似，不代表底层对象可以互换。

### 移除监听并销毁

```ts
unsubscribe()
editor.destroy()
```

在页面或组件的清理阶段执行。创建编辑器可能因无效配置抛错，应用仍应处理初始化异常；`onError` 用于运行中的错误报告。

## 和其他包的关系

| 包 | 分工 |
| --- | --- |
| [@quirekit/msfe-starter-kit](../starter-kit/README.zh-CN.md) | 可配置的默认 Markdown 功能集合 |
| [@quirekit/msfe-vue](../vue/README.zh-CN.md) | Vue 挂卸、状态订阅和组件视图 |
| [@quirekit/msfe-react](../react/README.zh-CN.md) | React 挂卸和组件视图 |
| [@quirekit/core](../../core/editor/README.zh-CN.md) | 另一套结构化富文本内核，不是 MSFE 的必装依赖 |

## 当前限制

- `0.x` alpha 为 alpha；公开接口和支持范围尚未稳定，不承诺所有 Markdown 方言的完整视觉一致性。
- 默认预设不含所有语法；未投影的内容回退为源码。复杂列表/表格交互、任意可编辑组件正文不能由基础展示能力推断为已支持。
- 输入必须是已解码字符串，且换行统一为 LF 或 CRLF。混合换行或单独 CR 会被拒绝。
- 过期目标不会自动映射到新版本；扩展不能在运行中随意热装卸。
- 挂载需要浏览器 DOM。存储、上传、完整工具栏和协同传输服务不在本包内。
- 第三方 CodeMirror 扩展需要使用相同的 `@quirekit/cm-*` 状态与视图包，不能假定和另一套 CodeMirror 运行时对象直接兼容。

## 许可

MIT，见 [LICENSE.md](LICENSE.md)。第三方许可声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
