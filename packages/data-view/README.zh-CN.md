# @quirekit/data-view

[English](./README.md) | 简体中文

把一组记录显示成表格或看板所需的数据工具。包含字段、记录、视图设置、查询和修改操作。

## 安装

```bash
npm install @quirekit/data-view
```

## 使用方式

示例还需安装 `uuid`。实际保存时保留生成的 ID，不要每次读取文档都重新创建。

```ts
import { createDataView, serializeDataView } from '@quirekit/data-view'
import { v4 as uuid } from 'uuid'

const view = createDataView(uuid())
console.log(serializeDataView(view))
```

## 使用时注意

- 新建数据视图带有标题和状态字段，以及表格、看板视图。实际记录由应用或编辑界面添加。
- 它不是数据库服务；远程数据的读取、权限和保存由应用负责。

## 相关说明

- [数据视图编辑界面](../data-view-editor/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
