# @quirekit/classic-editor

## 0.0.2

### Patch Changes

- Expose existing contribution augmentation and render contracts through the Classic headless entry. Make Word layout consume that contract as a declared production type dependency so declaration builds retain the external headless types without bundling product components. Layout runtime behavior is unchanged.

  从 Classic 无界面入口公开既有贡献模块扩充和渲染合同。Word 排版装配通过已声明的生产类型依赖消费该入口，使声明构建保留外部无界面类型而不打包产品组件；排版运行时行为保持一致。

- The default media service gives each new asset a random id (`classic-image-<uuid>`) instead of a per-editor counter, so two people inserting pictures into one shared document no longer produce the same asset id.

  默认媒体服务为新资源生成随机 id（`classic-image-<uuid>`），不再使用编辑器内的计数，两人在同一份共享文档中插入图片时不会再得到相同的资源 id。

- Classic and Block editors now share the Markdown editor's block handle: one chip with a colored block-type mark and a muted grip. Classic shows its insert button only on empty paragraphs; other blocks insert through the handle menu. Dragging a block now shows the grabbing cursor everywhere. New `QuireBlockHandle` component.

  Classic 与 Block 编辑器的块拖拽手柄统一为 Markdown 编辑器的样式：一个按钮内显示带颜色的块类型标记和弱化的拖拽点。Classic 的插入按钮只在空段落显示，其他块通过手柄菜单插入。拖动块时光标始终显示为抓取状态。新增 `QuireBlockHandle` 组件。
