import type { QuireKitLicenseCheck, QuireKitProduct } from "../types";

const reported = new Set<string>();

const reasons: Readonly<Record<string, string>> = {
  missing: "未设置授权码",
  malformed: "授权码格式无效",
  signature: "授权码签名无效",
  revoked: "授权码已被吊销",
  product: "授权码不包含该产品",
  domain: "授权码不包含当前域名",
  "updates-expired": "当前版本晚于授权码的可升级截止日期",
  unsupported: "当前环境不支持授权码验签（需要 WebCrypto Ed25519）"
};

/**
 * Logs one console explanation per product and reason; never throws or blocks features.
 * @param product - Product line shown in evaluation mode.
 * @param check - Failed check.
 */
export function reportEvaluation(product: QuireKitProduct, check: QuireKitLicenseCheck): void {
  const token = `${product}:${check.reason ?? check.status}`;
  if (reported.has(token)) return;
  reported.add(token);
  console.info(`[QuireKit] ${product}：${reasons[check.reason ?? ""] ?? "未授权"}，以评估版运行，功能不受限制，导出的 DOCX、PDF、OFD 带评估标记。`
    + "开发与评估不限时间；用于生产需要授权码，调用 setQuireKitLicense(key) 设置后去除界面与导出文件中的评估标记。"
    + "开源项目可使用 open-source 声明。");
}
