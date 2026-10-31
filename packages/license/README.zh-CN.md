# @quirekit/license

[English](./README.md) | 简体中文

管理 QuireKit 商业功能在应用中的许可证设置和检查。

## 安装

这是仓库内使用的私有包，不通过公开 npm 安装。在 QuireKit 工作区中通过 `workspace:*` 引用。

## 使用方式

应用启动时通过 `setQuireKitLicense()` 设置已获得的许可证；使用 `checkQuireKitLicense()` 查看当前检查结果。许可证内容由授权方提供，本包不会替你生成授权。

## 相关说明

- [相关包](../classic-pro/README.zh-CN.md)

## 许可

[商业许可](./LICENSE.md)：开发与评估免费，生产使用需要授权码；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
