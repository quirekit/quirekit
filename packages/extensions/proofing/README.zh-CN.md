# @quirekit/extension-proofing

[English](./README.md) | 简体中文

为文档提供拼写和语法检查结果、建议及修改命令。实际检查由可替换的检查器完成。

## 安装

```bash
npm install @quirekit/extension-proofing
```

## 使用方式

把 Proofing 加入 Core，再配置 provider。可用 proofing-harper 检查英文语法和文风，或用 proofing-hunspell 检查字典中的拼写。通过 getProofingSnapshot 读取当前结果，为自己的面板或菜单显示提示。

## 使用时注意

- 检查结果不应自动改写正文；由用户选择是否应用建议。
- 支持哪些语言取决于检查器和已加载的词典。

## 相关说明

- [Harper 检查器](../../proofing-harper/README.zh-CN.md)
- [Hunspell 检查器](../../proofing-hunspell/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
