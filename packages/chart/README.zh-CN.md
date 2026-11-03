# @quirekit/chart

[English](./README.md) | 简体中文

定义柱状图、折线图、饼图等统计图表的数据、样式和编辑操作。可以在没有界面的环境中创建和校验图表。

## 安装

```bash
npm install @quirekit/chart
```

## 使用方式

示例还需安装 `uuid`。实际保存时保留生成的 ID，不要每次读取文档都重新创建。

```ts
import { createChartSpec, assertChartSpec } from '@quirekit/chart'
import { v4 as uuid } from 'uuid'

const chart = createChartSpec('bar', uuid())
const saved = JSON.stringify(chart)
const restored = assertChartSpec(JSON.parse(saved))
console.log(restored)
```

## 使用时注意

- 本包返回图表数据；显示图表可用 Chart ECharts，文档中的图表功能见 Classic Chart。

## 相关说明

- [显示统计图表](../chart-echarts/README.zh-CN.md)
- [Word 文档中的图表](../classic/chart/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
