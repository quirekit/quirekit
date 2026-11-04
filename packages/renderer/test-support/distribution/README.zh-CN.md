# Quire Render 本地开发者预览

这是本地开发者预览，不代表 API 稳定。

- `archives/`：通过 pnpm 实际打包的 Renderer 与契约包。
- `consumer/`：只安装这两个 tgz 的独立 TypeScript 示例，附 npm 锁文件。
- `source/`：由 tgz 提取的完整源码与独立构建配置，附 pnpm 锁文件。
- `consumer/preview.svg`、`canvas-calls.json`：同一 `qkView` 场景的 SVG 与 Canvas 调用记录。
- `manifest.json`：包版本、许可、SHA-256 和本轮验证记录。

使用 Node 22。在 `consumer/` 内执行：

```sh
npm ci --ignore-scripts
npm test
```

`example.ts` 演示一次编译后复用 display list；浏览器宿主可以把自身 Canvas 2D context
传给 `paint()`。该示例用记录型 Canvas target 验证绘制调用，SVG 可以直接打开。
它不等同于跨浏览器像素、复杂字体、PDF/OFD 或分页兼容验收。

使用源码包声明的 pnpm 10，在 `source/` 内重建：

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build
pnpm run typecheck
pnpm test
```

契约包先构建，Renderer 随后编译；全部依赖均由这份快照或 pnpm 锁文件给出，
不需要 QuireKit monorepo、源码别名或商业包。

`render-contract` 与 `renderer` 均使用 MIT。
第三方许可随包保留，根目录许可不覆盖包内独立 MIT 授权。本预览未包含商业 PDF/OFD
适配、付费模板或商业许可协议。首次公开前仍须确认历史交付、权属和正式商业条款。
