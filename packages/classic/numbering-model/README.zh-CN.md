# @quirekit/classic-numbering-model

[English](./README.md) | 简体中文

Word 兼容的多级列表编号：编号定义、多级层次、编号重排、项目符号与列表样式的数据模型和编辑命令。不含 DOCX 导入导出与修订留痕，可在任何 QuireKit 编辑器中使用。

## 安装

```bash
npm install @quirekit/classic-numbering-model
```

## 使用方式

把 `WordNumbering` 加入编辑器扩展，同时安装 `@quirekit/classic-paragraph-model` 与 `@quirekit/classic-styles-model`。需要与 Word 文档互转或修订留痕时，改用商业包 `@quirekit/classic-numbering`，它包含本包全部内容并加入 DOCX 编解码与修订集成。

定义、创建列表与重新编号均可显式使用零起点，计数按 0、1、2 推进。不同编号格式和语言有各自的零值显示规则；负起点不在支持范围。
在空段输入 `0. ` 仍作为普通文字保留，自动编号规则不变。

多级列表从子级开始时，默认祖先计数先取声明起点，后续实际父级继续递增；跳级与声明的重启触发层同样适用，零值保持为零。非顶层永不重启层的隐式前缀仍有已记录的互操作差异。

```ts
editor.commands.toggleWordOrderedList({ start: 0 })
editor.commands.restartWordNumbering({ start: 0 })
```

## 使用时注意

- 本包与 `@quirekit/classic-numbering` 二选一安装，不要同时注册两份编号扩展。
- 闭源产品使用本包需购买 QuireKit 商业授权。

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
