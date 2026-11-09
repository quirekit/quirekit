# @quirekit/lezer-markdown

## 0.0.2

### Patch Changes

- Incremental parsing now reuses unchanged groups of blocks whole and no longer reparses paragraphs with links when link definitions did not change, so parsing a keystroke costs about the same in a 3,000,000-character document as in a 100,000-character one.

  增量解析现在整组复用未变的块；链接定义没变时，带链接的段落也不再重复解析。300 万字文档中单次按键的解析开销与 10 万字基本相同。
