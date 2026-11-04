# 贡献指南 / Contributing

- 所有贡献都需要同意[贡献者许可协议](CLA.md)。你保留自己贡献的著作权，同时授权项目以 MIT
  与商业许可提供你的贡献。PR 中的 CLA 机器人会引导你签署。
- 每个包的许可以包内 `LICENSE.md` 为准。不要提交无权再分发的代码、字体、文档、图片或其他材料。
- 不得让本仓库的包依赖不在本仓库中的 `@quirekit` 包；`pnpm licenses:check` 与
  `pnpm publish:closure:check` 会拒绝这类依赖。
- 提交 PR 前请运行 `pnpm check`。
- 提交标题使用英文 [Conventional Commits](https://www.conventionalcommits.org/)，正文第一行写中文说明。
- 用户能感知的改动请运行 `pnpm changeset` 添加说明，先英文段、后中文段；1.0 之前选择 `patch`。
- 本仓库由维护者的主仓同步生成。合并后的 PR 会被导入主仓，并随下一次同步回到这里。

All contributions require accepting the [CLA](CLA.md); you keep the copyright of your
contribution and license it to the project under MIT and commercial terms. Each
package's `LICENSE.md` is authoritative. Do not add dependencies on `@quirekit` packages
that are not in this repository. Run `pnpm check` before opening a pull request. Write
commit subjects as English Conventional Commits with a Chinese line in the body, and add a
changeset (`pnpm changeset`, English paragraph then Chinese, `patch` before 1.0) for any
change users can notice. This
repository is generated from the maintainer's main repository; merged pull requests are
imported there and come back with the next sync.
