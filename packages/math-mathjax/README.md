# @quirekit/math-mathjax

English | [简体中文](./README.zh-CN.md)

Uses MathJax to lay out formulas and produce SVG for formula editors and document previews.

## Installation

```bash
npm install @quirekit/math-mathjax
```

## Usage

Create a renderer with `createMathJaxRenderer()` and supply it to a formula editor. Use `serializeMathSvg()` to serialize the rendered SVG when saving an image.

## Things to know

- The Math package stores editable formulas. SVG is a display result and should not replace the source.

## Related documentation

- [Formula data and editing](../math/README.md)
- [Formula editor UI](../math-ui/README.md)

## License

[MIT](./LICENSE.md). Third-party notices: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
