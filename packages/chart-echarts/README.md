# @quirekit/chart-echarts

English | [简体中文](./README.zh-CN.md)

Converts QuireKit chart data into ECharts options and produces chart images for documents.

## Installation

```bash
npm install @quirekit/chart-echarts
```

## Usage

Call `compileChartOption(spec, fontFamily)` to build ECharts options. For images, create a browser adapter with `createEChartsSnapshotAdapter(document)`.

## Things to know

- Save the original chart as ChartSpec. ECharts options and screenshots are display results.
- Supply available fonts and wait for them to load before exporting.

## Related documentation

- [Chart data](../chart/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
