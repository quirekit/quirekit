# @quirekit/mind-map-simple

[English](./README.md) | 简体中文

把 simple-mind-map 的绘图界面接到 QuireKit 思维导图数据上，用于拖动、选择和编辑图形。

## 安装

```bash
npm install @quirekit/mind-map-simple
```

## 使用方式

在浏览器中用 `createSimpleMindMapEditor()` 创建实例，传入挂载容器、当前文档和更新处理。常规应用可以直接使用下方的完整编辑界面。

## 使用时注意

- 保存时通过适配器读取 QuireKit 数据，不要把绘图库的临时运行状态直接当作文档。
- 组件卸载时释放实例及其监听。

## 相关说明

- [数据工具](../mind-map/README.zh-CN.md)
- [完整编辑界面](../mind-editor/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
