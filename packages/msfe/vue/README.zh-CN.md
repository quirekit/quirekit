# @quirekit/msfe-vue

[English](README.md)

MSFE 的 Vue 3 接入层，负责编辑器挂载、卸载、状态订阅和 Vue 组件视图的生命周期。

## 适合 / 不适合

- 适合在 Vue 页面中嵌入 Markdown 编辑区，并用自己的按钮或工具栏调用命令。
- MSFE 是源码优先编辑器：保存的是 Markdown 文本，即时呈现不会另建一份富文本权威数据。
- 它不是带工具栏的所见即所得组件，也不通过 `v-model` 在每次输入时同步全文。
- 只需普通 TypeScript 接入时，直接用 [msfe-core](../core/README.zh-CN.md)；React 项目使用 [msfe-react](../react/README.zh-CN.md)。

## 安装

```bash
npm install @quirekit/msfe-vue @quirekit/msfe-core @quirekit/msfe-starter-kit vue@^3.5.40
```

```bash
pnpm add @quirekit/msfe-vue @quirekit/msfe-core @quirekit/msfe-starter-kit vue@^3.5.40
```

peer 依赖是 `vue: ^3.5.40`。已有 Vue 应用也应检查版本范围。Core 是本包的普通依赖，这里显式列出是因为示例导入其类型；StarterKit 提供示例功能，不是 peer 依赖。包提供 ESM 导出。

## 最小可运行示例

在已经支持 Vue 单文件组件和 TypeScript 的浏览器项目中，将下面内容放进 `App.vue`。不需要另装 UI 库或导入主题 CSS。

```vue
<script setup lang="ts">
import { shallowRef } from 'vue'
import type { MsfeEditor } from '@quirekit/msfe-core'
import { StarterKit } from '@quirekit/msfe-starter-kit'
import { MsfeEditorContent, type VueEditorOptions } from '@quirekit/msfe-vue'

const editor = shallowRef<MsfeEditor>()
const saved = shallowRef('')
const revision = shallowRef(0)
const options: VueEditorOptions = {
  documentId: 'note-1',
  markdown: '# Hello Vue\n\nEdit this **Markdown**.\n',
  mode: 'live',
  extensions: [StarterKit],
  onChange: event => { revision.value = event.revision },
  onError: error => console.error(error),
}

/** @param instance - 挂载完成的编辑器。 */
function ready(instance: MsfeEditor): void {
  editor.value = instance
}

/** 在显式读取时获取全文，不在每次输入时复制 Markdown。 */
function readMarkdown(): void {
  saved.value = editor.value?.getMarkdown() ?? ''
}
</script>

<template>
  <section>
    <button type="button" :disabled="!editor" @click="readMarkdown">读取 Markdown</button>
    <span>版本：{{ revision }}</span>
    <MsfeEditorContent :options="options" @ready="ready" />
    <pre>{{ saved }}</pre>
  </section>
</template>
```

输入正文后点击按钮，下方会显示当前 Markdown。`MsfeEditorContent` 在挂载后创建实例，通过 `ready` 交给应用，并在组件卸载时自动销毁。

## 核心概念

1. **初始 options**：`options` 是创建时的配置，不是持续同步的受控值。修改内容、模式或主题应调用 Editor 方法。
2. **Editor 引用**：`shallowRef` 只跟踪实例是否可用，不把底层 CodeMirror 状态转成 Vue 深层响应式对象。挂载前它是 `undefined`。
3. **源码与呈现**：`getMarkdown()` 读取权威源码；`source`、`live`、`locked` 共用同一文档，`locked` 不可编辑，`readOnly` 另行控制编辑权限。
4. **组件宿主**：自定义 Vue 组件视图通过 Teleport 出现在编辑区，但仍留在应用的 Vue 提供者树中。正文输入仍由 CodeMirror 管理。
5. **增量订阅**：`onChange` 报告内容修改；`useMsfeState` 订阅指定状态切片，例如选区，而不是每次输入都复制全文。

## 常见任务

除最后一个完整组件外，下面片段放入主示例的 `<script setup>`；按钮可分别绑定对应函数。

### 从工具栏执行命令

```ts
/** 切换当前选区或输入位置的粗体。 */
function toggleBold(): void {
  const instance = editor.value
  if (instance && !instance.commands.toggleBold()) {
    console.warn(instance.lastCommandResult)
  }
}
```

例如给按钮绑定 `@click="toggleBold"`。命令来自 StarterKit，返回布尔值；禁用功能后不可假定对应命令仍可执行。

### 切换文档，而不是反复重置初始值

```ts
/** 打开另一篇文档，并重置旧的选区和撤销历史。 */
function openAnotherNote(): void {
  const result = editor.value?.replaceDocument('# Another note\n', 'note-2')
  if (result && !result.ok) console.warn(result.reason)
}
```

不要在 `watch` 中把每次本地变化通过 `replaceDocument()` 写回；这会不断重置历史。修改当前文档的一段文本时使用 Core 的带版本 `applyChanges()`，不是换文档接口。

### 切换模式、只读和主题

```ts
/** 切换为只读的深色源码视图。 */
function showReadOnlySource(): void {
  editor.value?.setMode('source')
  editor.value?.setReadOnly(true)
  editor.value?.setTheme('dark')
}
```

恢复编辑时调用 `setReadOnly(false)`；若当前为 `locked`，还需切回 `source` 或 `live`。这些操作不重建编辑器。

### 订阅选区，而不是序列化全文

```ts
import { useMsfeState } from '@quirekit/msfe-vue'

const selectionStart = useMsfeState(editor, {
  select: state => state.selection.main.from,
})
```

可以在模板中显示 `{{ selectionStart }}`。挂载前值为 `undefined`；订阅随 Vue 作用域自动清理。选区位置是从 0 开始的逻辑源码 UTF-16 偏移。

### 自己控制挂载区域

需要自定义外层布局时，可用下面组件**替换**主示例，而不是再嵌套一个 `MsfeEditorContent`：

```vue
<script setup lang="ts">
import { shallowRef } from 'vue'
import { StarterKit } from '@quirekit/msfe-starter-kit'
import { useMsfeEditor, VueNodeViewHost } from '@quirekit/msfe-vue'

const parent = shallowRef<HTMLElement | null>(null)
const { editor, host } = useMsfeEditor(parent, () => ({
  markdown: '# Custom mount\n',
  mode: 'live',
  extensions: [StarterKit],
}))
</script>

<template>
  <div>
    <button type="button" :disabled="!editor" @click="editor?.undo()">撤销</button>
    <div ref="parent" />
    <VueNodeViewHost :host="host" />
  </div>
</template>
```

`useMsfeEditor` 负责创建和销毁；`VueNodeViewHost` 负责组件视图，不能因为自己提供了挂载 div 就省略它。不要再手动创建第二个实例或销毁从该组合函数借用的实例。

## 和其他包的关系

| 包 | 分工 |
| --- | --- |
| [@quirekit/msfe-core](../core/README.zh-CN.md) | Markdown、命令、历史、文档身份与版本 |
| [@quirekit/msfe-starter-kit](../starter-kit/README.zh-CN.md) | 默认语法功能，可逐项关闭或替换 |
| `@quirekit/msfe-vue` | `MsfeEditorContent`、`useMsfeEditor`、`useMsfeState` 以及 Vue 组件视图适配 |
| [@quirekit/msfe-react](../react/README.zh-CN.md) | React 接入；不是本包的依赖 |

## 当前限制

- `0.x` alpha 尚未稳定；Vue peer 范围为 `^3.5.40`，不是任意 Vue 3 版本。
- `options` 的后续变更不会重建或重置实例，没有全文 `v-model` 协议。
- 这是浏览器编辑组件，不提供服务端渲染后的完整静态 Markdown 阅读内容。
- 自定义组件视图不是任意可编辑的富文本容器，不能由 Vue 接管 CodeMirror 的正文 DOM。
- 工具栏、文件保存、上传和资源权限仍由应用负责。默认语法范围和内容限制以 StarterKit / Core 为准。

## 许可

MIT，见 [LICENSE.md](LICENSE.md)。第三方许可声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
