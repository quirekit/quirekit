# @quirekit/extension-paragraph

## 0.0.2

### Patch Changes

- Preserve imported single nonbreaking-space paragraphs through canonical JSON and DOCX export using existing source provenance. Current edits remain authoritative, and unpreserved browser placeholder paragraphs retain their empty-paragraph behavior.

  利用已有来源保全信息，在 canonical JSON 与 DOCX 导出中保留导入的单个不换行空格段落。导出继续使用当前编辑内容，无来源保全的浏览器占位段落继续按空段处理。
