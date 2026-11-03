# @quirekit/math-mathjax

[English](./README.md) | 简体中文

使用 MathJax 为公式计算布局并生成 SVG，供公式编辑界面和文档预览显示。

## 安装

```bash
npm install @quirekit/math-mathjax
```

## 使用方式

通过 `createMathJaxRenderer()` 创建渲染器，交给公式编辑界面使用。需要保存图片时，用 `serializeMathSvg()` 序列化生成的 SVG。

## 使用时注意

- 公式的可编辑内容由 Math 包保存；SVG 用于显示，不能替代公式源码。

## 相关说明

- [公式数据与编辑操作](../math/README.zh-CN.md)
- [公式编辑界面](../math-ui/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
