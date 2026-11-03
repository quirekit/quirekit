# @quirekit/drawing-geometry

[English](./README.md) | 简体中文

计算文档形状的路径、连接点和文字区域，让渲染与导出使用相同的形状定义。

## 安装

```bash
npm install @quirekit/drawing-geometry
```

## 使用方式

先用 `isDrawingPreset()` 检查形状名称，再用 `resolveDrawingPreset()` 根据尺寸和调节参数计算几何信息。它返回几何数据，不创建画布或编辑器。

## 相关说明

- [相关包](../flowchart/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
