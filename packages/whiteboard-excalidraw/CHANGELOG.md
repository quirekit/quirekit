# @quirekit/whiteboard-excalidraw

## 0.0.3

### Patch Changes

- The whiteboard editor now opens when the app is bundled with code splitting that exposes CommonJS packages only as a default export, as esbuild does for dynamically imported React.

  用会把 CommonJS 包只作为默认导出提供的方式拆包时（例如 esbuild 拆包后动态导入 React），白板编辑器现在也能正常打开。

## 0.0.2
