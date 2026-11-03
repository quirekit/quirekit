# @quirekit/media

[English](./README.md) | 简体中文

管理文档中的图片等媒体引用，把文档里的资源标识和实际文件读取分开。

## 安装

```bash
npm install @quirekit/media
```

## 使用方式

使用资源引用表示应用存储中的文件，使用外部引用表示 URL。通过 `createQuireMediaResolverChain()` 连接文件读取方式；测试或临时内容可用 `createQuireMemoryMediaRepository()`。

## 相关说明

- [相关包](../core/editor/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
