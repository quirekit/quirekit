# @quirekit/msfe-react

[English](README.md)

MSFE 的 React 接入层，通过组件和 Hook 管理 Markdown 编辑器及 React 组件视图的挂载与清理。

## 适合 / 不适合

- 适合在 React 应用中嵌入 Markdown 编辑区域，用自己的界面调用命令。
- MSFE 以 Markdown 源码为准。即时呈现是源码的显示方式，不是另存一份所见即所得文档。
- 不适合期待 `value` / `onChange` 在每次按键后回传全文的受控输入框模式。
- 本包不带完整工具栏。只需要框架无关接口时用 [msfe-core](../core/README.zh-CN.md)，Vue 应用用 [msfe-vue](../vue/README.zh-CN.md)。

## 安装

```bash
npm install @quirekit/msfe-react @quirekit/msfe-core @quirekit/msfe-starter-kit react@^19.3.0 react-dom@^19.3.0
```

```bash
pnpm add @quirekit/msfe-react @quirekit/msfe-core @quirekit/msfe-starter-kit react@^19.3.0 react-dom@^19.3.0
```

peer 依赖是 `react: ^19.3.0` 和 `react-dom: ^19.3.0`，两个都需要。Core 是普通依赖，这里显式安装是因为示例导入其类型；StarterKit 是示例功能预设，不是 peer 依赖。包提供 ESM 导出。

TypeScript 项目还需要对应的类型包：

```bash
npm install --save-dev @types/react@^19.3.0 @types/react-dom@^19.3.0
```

pnpm 对应命令为 `pnpm add -D @types/react@^19.3.0 @types/react-dom@^19.3.0`。已有应用应确认依赖和类型版本匹配。

## 最小可运行示例

在已配置 React、TypeScript 和 JSX 的浏览器项目中，将下面组件放进 `App.tsx`，由现有页面入口渲染。不需要额外 UI 库或主题 CSS 导入。

```tsx
import { useRef, useState } from 'react'
import type { MsfeEditor } from '@quirekit/msfe-core'
import { StarterKit } from '@quirekit/msfe-starter-kit'
import { MsfeEditorContent, type ReactEditorOptions } from '@quirekit/msfe-react'

/** @returns 可编辑的 Markdown 与显式读取按钮。 */
export default function App() {
  const editor = useRef<MsfeEditor | null>(null)
  const [saved, setSaved] = useState('')
  const [revision, setRevision] = useState(0)
  const options: ReactEditorOptions = {
    documentId: 'note-1',
    markdown: '# Hello React\n\nEdit this **Markdown**.\n',
    mode: 'live',
    extensions: [StarterKit],
    onChange: event => setRevision(event.revision),
    onError: error => console.error(error),
  }

  return (
    <section>
      <button type="button" onClick={() => setSaved(editor.current?.getMarkdown() ?? '')}>
        读取 Markdown
      </button>
      <span>版本：{revision}</span>
      <MsfeEditorContent options={options} onReady={instance => { editor.current = instance }} />
      <pre>{saved}</pre>
    </section>
  )
}
```

修改正文后点击按钮，下方会显示当前 Markdown。`onChange` 这里只更新版本号，不复制全文。组件在 effect 中创建编辑器，并在卸载时自动销毁。

## 核心概念

1. **初始 options**：每次挂载只读取初始配置。普通 React 重渲染不会重建编辑器，新的 options 对象也不会同步内容。
2. **Editor 引用**：`onReady` 在实例可用后调用。`useRef` 保存实例而不让底层 CodeMirror 状态参与 React 深层状态管理；挂载前引用为 `null`。
3. **源码与呈现**：`getMarkdown()` 读取权威文本。`source`、`live`、`locked` 共用文档和历史；`locked` 禁止编辑，`readOnly` 另行控制编辑权限。
4. **组件宿主**：React 组件视图通过 Portal 放入编辑区，同时保留应用的 Context。正文 DOM 和输入仍归 CodeMirror 所有。
5. **Effect 生命周期**：开发环境的 StrictMode 可能额外执行创建与清理，`onReady` 因而可能多次调用。不要将它当作全局只运行一次的事件。

## 常见任务

除最后一个独立组件外，下面函数放进主示例的 `App` 函数体，在 `return` 之前定义；将它们连接到自己的按钮事件。不要在 render 中直接执行编辑命令。

### 从按钮执行命令

```ts
/** 为当前选区或输入位置切换粗体。 */
function toggleBold(): void {
  const instance = editor.current
  if (instance && !instance.commands.toggleBold()) {
    console.warn(instance.lastCommandResult)
  }
}
```

按钮可用 `onClick={toggleBold}`。此命令由 StarterKit 安装，返回布尔值；失败详情在 `lastCommandResult`。

### 切换文档

```ts
/** 打开另一篇文档，清除旧选区和撤销历史。 */
function openAnotherNote(): void {
  const result = editor.current?.replaceDocument('# Another note\n', 'note-2')
  if (result && !result.ok) console.warn(result.reason)
}
```

不要用 effect 把每次本地变化通过 `replaceDocument()` 回写，否则会持续清空历史。仅修改当前文档的一段文本时，使用 Core 的带版本 `applyChanges()`。

### 调整模式、只读和主题

```ts
/** 切换为只读的深色源码视图。 */
function showReadOnlySource(): void {
  editor.current?.setMode('source')
  editor.current?.setReadOnly(true)
  editor.current?.setTheme('dark')
}
```

恢复输入时调用 `setReadOnly(false)`；若当前模式为 `locked`，还需切回 `source` 或 `live`。无需通过修改 React `key` 重建实例。

### 消费增量变化

在文件顶部追加类型导入，并在 `App` 内定义处理函数：

```ts
import type { MsfeChangeEvent } from '@quirekit/msfe-core'

/** @param event - 已接受的源码修改，不含全文副本。 */
function handleChange(event: MsfeChangeEvent): void {
  setRevision(event.revision)
  console.log({ origin: event.origin, changed: !event.changes.empty })
}
```

创建时将 options 的 `onChange` 设为 `handleChange`，替换原回调即可。运行中的 options 不会追踪 React 状态变化；如果回调需要读取会变化的应用值，可由应用通过稳定的 ref 提供最新值。保存全文仍在显式动作中调用 `getMarkdown()`。

### 自己控制挂载布局

用这个组件**替换**主示例的编辑区域，不要同时再挂一个 `MsfeEditorContent`：

```tsx
import { useRef } from 'react'
import { StarterKit } from '@quirekit/msfe-starter-kit'
import { useMsfeEditor, ReactNodeViewHost } from '@quirekit/msfe-react'

/** @returns 自定义挂载区域与对应的组件视图宿主。 */
export function CustomEditor() {
  const parent = useRef<HTMLDivElement>(null)
  const session = useMsfeEditor(parent, () => ({
    markdown: '# Custom mount\n',
    mode: 'live',
    extensions: [StarterKit],
  }))

  return (
    <section>
      <button type="button" disabled={!session} onClick={() => session?.editor.undo()}>撤销</button>
      <div ref={parent} />
      {session && <ReactNodeViewHost host={session.host} />}
    </section>
  )
}
```

`session` 在挂载前为 `null`。Hook 负责每次 effect 生命周期的创建与销毁，`ReactNodeViewHost` 渲染组件视图。不要在 ref 回调中反复创建实例，也不要手动销毁从 Hook 借用的实例。

## 和其他包的关系

| 包 | 分工 |
| --- | --- |
| [@quirekit/msfe-core](../core/README.zh-CN.md) | Markdown、命令、历史、文档身份与版本 |
| [@quirekit/msfe-starter-kit](../starter-kit/README.zh-CN.md) | 默认语法与呈现，可逐项关闭或替换 |
| `@quirekit/msfe-react` | `MsfeEditorContent`、`useMsfeEditor` 与 React 组件视图适配 |
| [@quirekit/msfe-vue](../vue/README.zh-CN.md) | Vue 接入；不需要在 React 应用中安装 |

## 当前限制

- `0.x` alpha 尚未稳定，peer 范围是 React / React DOM `^19.3.0`，不承诺更早版本兼容。
- 不是受控输入框；没有每次输入都返回完整 Markdown 的 `value` / `onChange` 协议，也没有自动更新 options 的行为。
- 浏览器 effect 才创建编辑器；服务端渲染不会得到完整的静态 Markdown 阅读正文。
- 无效扩展配置等初始化错误可能抛到 React；应用应使用自己的错误边界，不能把 `onError` 当作涵盖所有初始化异常的捕获器。
- 工具栏、存储、上传和资源权限由应用提供。自定义组件视图不能接管 CodeMirror 的正文 DOM；具体语法限制见 Core / StarterKit。

## 许可

MIT，见 [LICENSE.md](LICENSE.md)。第三方许可声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
