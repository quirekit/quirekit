# @quirekit/chart

English | [简体中文](./README.zh-CN.md)

Defines data, styles and editing operations for statistical charts such as bar, line and pie charts. Charts can be created and validated without a user interface.

## Installation

```bash
npm install @quirekit/chart
```

## Usage

Also install `uuid` for this example. Keep generated IDs when saving; do not recreate them each time a document is read.

```ts
import { createChartSpec, assertChartSpec } from '@quirekit/chart'
import { v4 as uuid } from 'uuid'

const chart = createChartSpec('bar', uuid())
const saved = JSON.stringify(chart)
const restored = assertChartSpec(JSON.parse(saved))
console.log(restored)
```

## Things to know

- This package returns chart data. Use Chart ECharts to display it, or Classic Chart for document integration.

## Related documentation

- [Display charts](../chart-echarts/README.md)
- [Charts in Word documents](../classic/chart/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
