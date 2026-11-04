# @quirekit/license

[English](./README.md) | 简体中文

管理 QuireKit 商业功能在应用中的许可证设置和检查。

## 安装

这是仓库内使用的私有包，不通过公开 npm 安装。在 QuireKit 工作区中通过 `workspace:*` 引用。

## 使用方式

应用启动时通过 `setQuireKitLicense()` 设置已获得的许可证；使用 `checkQuireKitLicense()` 查看当前检查结果。许可证内容由授权方提供，本包不会替你生成授权。

### OEM 厂商

把 QuireKit 集成进自己的产品、交付给多家客户部署的厂商，持有 OEM 证书，并给每家客户签一个子码：

1. 在 QuireKit 签发系统的厂商账号中生成签发密钥，QuireKit 据此签发写明贵方产品的证书（`qkc1_…`）。
2. 在产品代码中调用 `setQuireKitOemCertificate(certificate, { application: "<证书上的产品名称>" })`。
3. 每家客户在签发系统中签一个子码（`qks1_…`），签发系统核对证书并加签后，在该客户的部署中用 `setQuireKitLicense()` 设置。
   加签的子码可以不绑定地址，桌面端、服务端与内网部署都可使用。

续费只更换下一个产品版本里随附的证书，客户手里的子码不用换；证书到期后不能再签新子码。

持有允许离线签发证书的厂商，也可以运行 `npx quirekit-oem keygen` 与
`npx quirekit-oem issue --certificate cert.txt --licensee "<客户名称>" --domains <地址>` 离线签发，或调用
`@quirekit/license/issue` 的 `signQuireKitSubLicense(vendorPrivateKey, certificate, { licensee, domains, offline: true })`。
离线子码必须绑定 1 到 5 个地址：域名、`*.example.com`、IPv4 地址或最宽一个 C 段（如 `192.168.10.*`）。

## 相关说明

- [相关包](../classic-pro/README.zh-CN.md)

## 许可

[MIT](./LICENSE.md)；第三方声明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。
