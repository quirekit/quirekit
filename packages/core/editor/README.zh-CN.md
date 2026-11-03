# @quirekit/core

[English](README.md)

QuireKit 的富文本编辑内核：管理结构化文档、扩展和编辑命令，页面上的编辑区域由独立视图包提供。

## 适合 / 不适合

- 适合需要自定义文档结构、快捷键或工具栏的应用。
- 扩展采用兼容 Tiptap 的写法：`Extension.create()`、`Node.create()`、`Mark.create()` 和 `.configure()`。
- 不适合只想安装一个包就获得完整编辑器界面的场景。Core 不带工具栏，也不自带页面视图。
- 如果保存的权威内容必须是 Markdown 源码，选择独立的 [MSFE](../../msfe/core/README.zh-CN.md)，而不是这个结构化富文本内核。

## 安装

下面的浏览器示例一起安装基础扩展集和原生 DOM 视图。DOM 视图使用浏览器的可编辑元素，不提供分页。

```bash
npm install @quirekit/core @quirekit/starter-kit @quirekit/dom-view
```

或使用 pnpm：

```bash
pnpm add @quirekit/core @quirekit/starter-kit @quirekit/dom-view
```

Core 没有需要另装的 peer 依赖。后两个包是此示例的显式依赖；Core 自身的普通依赖由包管理器安装。包提供 ESM 导出。

## 最小可运行示例

在已有的浏览器 TypeScript 项目中，将下面代码放入页面入口，例如 `src/main.ts`。需要通过项目的打包工具运行，不能直接把包名导入粘贴进未打包的 HTML。

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
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello QuireKit' }] }],
  },
})

console.log(editor.getJSON())
```

页面会出现可输入的正文，控制台输出初始文档。`mode: 'dom'` 必须与 `DomViewExtension` 配对；省略 mode 不会自动选中这个适配器。示例之后的片段沿用这里的 `editor`。

## 核心概念

1. **Editor**：持有文档状态和生命周期的实例。不传 `element` 时也能创建无界面的实例。
2. **Schema、节点与标记**：Schema 规定文档能容纳哪些结构；节点表示段落、标题等内容，标记表示粗体等文字格式。它们由扩展提供。
3. **扩展**：安装到实例中的功能定义。`StarterKit` 组合常见节点、标记和编辑行为。
4. **命令与事务**：命令表达一次编辑意图，事务记录它对状态的修改。`commands`、`chain()` 和 `can()` 使用同一组已安装命令。
5. **视图适配器**：把文档接到页面的独立实现。Core 管理状态；本示例的 DOM 视图管理浏览器输入、选区和显示。

## 常见任务

### 执行命令与检查可用性

```ts
const canToggleBold = editor.can().toggleBold()
const handled = editor.chain().toggleBold().run()
console.log({ canToggleBold, handled, active: editor.isActive('bold') })
```

`toggleBold()` 来自 StarterKit 中的 Bold 扩展。`can()` 是命令适用性查询，不是权限检查；不要仅凭 TypeScript 中存在某个方法就假定对应扩展已安装。

### 替换、读取与保存内容

```ts
editor.setContent({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Replacement' }] }],
})

const jsonToSave = JSON.stringify(editor.getJSON())
const plainText = editor.getText()
const html = editor.getHTML()
console.log({ jsonToSave, plainText, html })
```

JSON 保留已安装 Schema 支持的结构。纯文本会丢失格式；HTML 由扩展的序列化规则生成，不是编辑界面 DOM 的快照。存储与网络请求由应用负责。

### 监听变化并移除监听

```ts
const logUpdate = () => console.log(editor.getJSON())
editor.on('update', logUpdate)

editor.commands.setHeading({ level: 2 })
editor.off('update', logUpdate)
```

这里为了演示输出全文；大文档不要在每次按键后无条件序列化或写入存储。`on()` 不返回取消函数，移除监听要使用同一个回调。

### 添加自己的扩展

```ts
import { Extension } from '@quirekit/core'

const AppShortcuts = Extension.create({
  name: 'appShortcuts',
  /** @returns 此扩展注册的快捷键。 */
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-y': () => this.editor?.commands.toggleBold() ?? false,
    }
  },
})

const initialExtensions = [StarterKit, DomViewExtension, AppShortcuts]
```

创建实例时把 `initialExtensions` 传给 `extensions`，不要再同时保留旧数组。`Mod` 在 macOS 表示 Command，在其他常见桌面平台表示 Control。这里演示的是初始化配置，不是动态热安装。

### 只读、卸载与销毁

```ts
editor.setEditable(false)
editor.unmount()
editor.destroy()
```

`setEditable(false)` 关闭用户输入，不是所有程序化写入的安全锁。`unmount()` 移除视图但保留文档；不再使用实例时调用 `destroy()`。在 Vue/React 中应放到组件清理阶段，而不是创建后立即执行。

## 和其他包的关系

| 包 | 分工 |
| --- | --- |
| [@quirekit/starter-kit](../starter-kit/README.zh-CN.md) | 常见富文本节点、标记、快捷键和历史记录的预设 |
| [@quirekit/extensions](../../extensions/extensions/README.zh-CN.md) | 按需安装的占位、计数、撤销等行为扩展 |
| `@quirekit/dom-view` | 本示例使用的原生 DOM 视图（实验性） |
| [@quirekit/msfe-core](../../msfe/core/README.zh-CN.md) | 独立的 Markdown 源码编辑器，不共享这里的 Editor 或扩展实例 |

## 当前限制

- `0.x` alpha 是预发布版本，API、类型和文档格式契约尚未稳定。配套 QuireKit 包请使用一致版本。
- 兼容扩展写法不等于任意 Tiptap 插件可直接混装。需要底层 ProseMirror 对象时使用 QuireKit 的 `@quirekit/pm` 导出，避免混用不同运行时身份。
- Core 和上述 DOM 组合不提供完整产品界面、分页、文件存储或实时协同服务。
- 浏览器挂载需要真实 DOM；不要在服务端渲染阶段执行这里的页面入口。
- 更换 Schema 时要自行迁移旧 JSON；未知节点和标记不能指望自动无损保留。

## 许可

MIT，见 [LICENSE.md](LICENSE.md)。第三方许可声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
