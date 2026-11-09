# Word 原生中文样本

`chinese-basic.doc` 由 Microsoft Word for Mac 16.109.2（16.109.26052523）实际创建，
保存格式为 Word 97-2004；`chinese-basic.docx` 是同一 Word 对该原件的另存对照。
文件与文字为本仓库原创测试资产，按 MIT 提供。摘要、版本、操作及固定预期在 `manifest.json`。

第一段文字启用粗体，段落标记前关闭；第二段为中英文混排，结尾另有一个空段。DOC 的 CP
按 UTF-16 码元计数，正文结束于 44，段末为 22、43、44。首 21 个码元为粗体，其余关闭。

DOCX 对照是应用生成的参考，不能算成另一个独立生产者，也不能证明自有转换器已经通过。
这些文件只覆盖当前作者操作，不能外推到所有 Word 版本、Windows 或 WPS。
重新生成时保留原件另加 fixture，不覆盖已登记摘要来迎合候选结果。

`pnpm --filter @quirekit/lit-doc test` 运行固定作者断言；准备开发参考程序后，
`pnpm doc:producer:check` 进一步比较独立 POI 核心字段、Node/Chromium 完整结果、取消/超时及恢复。
