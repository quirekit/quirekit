# @quirekit/extensions

[English](README.md)

供 `@quirekit/core` 按需安装的编辑行为集合，包括占位文本、内容计数、撤销历史和选择相关行为。

## 适合 / 不适合

- 适合已有 Core 编辑器、需要补充某一项行为的应用。
- 每项功能独立安装；导入本包不会自动启用全部扩展。
- 它不包含段落、标题等完整文档结构，也不是一个可直接挂载的编辑器。
- 这里的扩展不能装入 MSFE。MSFE 使用独立的 Markdown 源码扩展体系。

## 安装

下面安装本包，以及示例需要的 Core、基础预设和原生 DOM 视图。

```bash
npm install @quirekit/extensions @quirekit/core @quirekit/starter-kit @quirekit/dom-view
```

```bash
pnpm add @quirekit/extensions @quirekit/core @quirekit/starter-kit @quirekit/dom-view
```

本包没有 peer 依赖；普通依赖由包管理器安装。以上其他包是示例直接使用的依赖。包提供 ESM 导出。

## 最小可运行示例

在浏览器 TypeScript 项目的入口中运行，例如 `src/main.ts`，并通过项目打包工具启动页面。

```ts
import { Editor } from '@quirekit/core'
import { StarterKit } from '@quirekit/starter-kit'
import { DomViewExtension } from '@quirekit/dom-view'
import { CharacterCount, Placeholder } from '@quirekit/extensions'

const element = document.createElement('div')
element.className = 'quire-editor'
document.body.append(element)

const editor = new Editor({
  element,
  mode: 'dom',
  extensions: [
    StarterKit,
    DomViewExtension,
    CharacterCount.configure({ limit: 280 }),
    Placeholder.configure({ placeholder: 'Write something…' }),
  ],
  content: '<p></p>',
})

console.log(editor.getJSON())
```

在页面样式中加入下面的规则，空段落才会显示占位文字。Placeholder 提供属性和类名，不替应用绘制这段文字。

```css
.quire-editor .is-empty::before {
  content: attr(data-placeholder);
  color: #777;
  float: left;
  height: 0;
  pointer-events: none;
}
```

编辑区现在可输入，并设置了 280 的字符计数上限。后面的片段沿用这里的导入和 `editor`。

## 核心概念与扩展清单

1. **行为扩展**为已有文档增加命令、快捷键或状态，不等于提供所有文档节点。
2. **配置**通过 `Feature.configure(options)` 创建新的配置实例；只定义配置不会修改正在运行的编辑器。
3. **Storage**是某项扩展保存在 Editor 实例上的运行时数据，不是应用的持久化存储。
4. **装饰**是附加到文档显示上的信息，不是保存进内容的文本。占位、焦点和选区样式需要视图及应用 CSS 配合。

以下扩展均从本包根入口导出，但只有显式加入 `extensions` 的项才会启用。

| 扩展 | 用途 |
| --- | --- |
| `AutoCorrect` | 按配置替换刚输入的文字、处理句首大写 |
| `BaseKeymap` | 基础编辑按键 |
| `BlockInteraction` | 块标识、结构范围和块操作命令，不含拖动控件 |
| `CharacterCount` | 字符和单词计数，可设置字符上限 |
| `Focus` | 为焦点所在节点添加样式信息 |
| `Formatting` | 清除格式、格式刷及格式提供方的组合 |
| `Gapcursor` | 在部分块节点之间放置光标 |
| `Placeholder` | 为适用的空节点添加占位属性和类名 |
| `Selection` | 编辑器失焦时的选区显示信息 |
| `TextCase` | 大小写和全半角转换命令 |
| `TrailingNode` | 在需要时补上末尾可输入节点 |
| `UndoRedo` | 撤销、重做与历史快捷键 |

## 常见任务

### 读取字符数和单词数

```ts
import type { CharacterCountStorage } from '@quirekit/extensions'

const counter = editor.storage.characterCount as CharacterCountStorage
console.log({ characters: counter.characters(), words: counter.words() })
```

Core 的通用 `storage` 值类型是 `unknown`，因此这里显式标明已安装扩展的 Storage 类型。默认字符数使用 JavaScript 字符串长度；默认单词数按空格拆分，不是中文分词或可见字符簇计数。

### 调整占位显示规则

```ts
const allEmptyNodes = Placeholder.configure({
  placeholder: 'Start writing',
  showOnlyCurrent: false,
  includeChildren: true,
})
```

创建 Editor 时用 `allEmptyNodes` 替换原 Placeholder 项。要关闭功能，就从初始化数组中移除它；本包没有统一的“全开 / 全关”预设。

### 自定义撤销历史，不重复安装

```ts
import { UndoRedo } from '@quirekit/extensions'

const historyExtensions = [
  StarterKit.configure({ undoRedo: false }),
  DomViewExtension,
  UndoRedo.configure({ depth: 200, newGroupDelay: 500 }),
]

editor.commands.setHeading({ level: 2 })
console.log(editor.commands.undo())
```

`historyExtensions` 是给新 Editor 使用的配置。最后两行演示当前示例中已有的撤销命令；它目前仍使用 StarterKit 的默认历史。StarterKit 还默认包含 BaseKeymap、Gapcursor、TrailingNode，额外安装它们前也要关闭预设里的对应项。

### 在组件或页面结束时清理

```ts
editor.destroy()
```

销毁 Editor 会释放扩展插件与监听。将这一步放进宿主的卸载回调，不要在页面刚创建时调用。

## 和其他包的关系

| 包 | 分工 |
| --- | --- |
| [@quirekit/core](../../core/editor/README.zh-CN.md) | Editor、扩展生命周期和命令执行 |
| [@quirekit/starter-kit](../../core/starter-kit/README.zh-CN.md) | 文档结构预设，已包含本包的部分行为 |
| `@quirekit/dom-view` | 示例的显示与输入实现 |
| [@quirekit/msfe-core](../../msfe/core/README.zh-CN.md) | 独立的 Markdown 源码编辑器，不消费这些扩展 |

## 当前限制

- `0.x` alpha 的 API 尚未稳定，配套 QuireKit 包应使用一致版本。
- 扩展不会自动生成工具栏、格式刷按钮、块拖动手柄或持久化界面。
- 装饰的实际显示取决于视图实现和 CSS；这里的占位样式只演示原生 DOM 视图。
- 字数统计的默认规则较简单。语言相关的统计应配置 `textCounter` / `wordCounter`，不要把默认值当作语言学计数。
- 单独安装本包不足以组成有效文档 Schema，也不会把所有命令自动安装到实例。

## 许可

MIT，见 [LICENSE.md](LICENSE.md)。第三方许可声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
