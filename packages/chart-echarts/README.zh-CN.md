# @quirekit/chart-echarts

[English](./README.md) | 简体中文

把 QuireKit 图表数据转换成 ECharts 配置，并生成供文档使用的图表图片。

## 安装

```bash
npm install @quirekit/chart-echarts
```

## 使用方式

用 `compileChartOption(spec, fontFamily)` 生成 ECharts 配置。需要图片时，在浏览器中用 `createEChartsSnapshotAdapter(document)` 创建适配器。

## 使用时注意

- 图表的原始数据应保存为 ChartSpec；ECharts 配置和截图是显示结果。
- 调用方负责提供可用字体，导出前应等待字体加载完成。

## 相关说明

- [图表数据](../chart/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
