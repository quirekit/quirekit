# @quirekit/proofing-harper

[English](./README.md) | 简体中文

通过 Harper 检查英文拼写和语法，返回问题位置与修改建议。

## 安装

```bash
npm install @quirekit/proofing-harper
```

## 使用方式

用 `createHarperProofingProvider()` 创建检查服务，传给 `@quirekit/extension-proofing` 的配置。检查结果由扩展显示到文档中。

## 使用时注意

- 调用方负责准备对应引擎资源或词典；语言覆盖取决于实际配置。
- 建议只是辅助检查，接受修改仍由用户决定。

## 相关说明

- [编辑器拼写检查扩展](../extensions/proofing/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
