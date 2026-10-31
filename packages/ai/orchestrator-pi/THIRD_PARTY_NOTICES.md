# 第三方声明 / Third-party notices

QuireKit 的分层授权只适用于相应权利人有权授权的原创部分，不替代或限制以下上游
材料的授权。独立第三方依赖及资源还可能有其自己的许可，分发包含它们的产物时必须
继续履行相关义务。本文件不声称是全部运行时依赖或所有构建产物的完整 SBOM。

The project license does not replace or restrict the licenses of upstream code.
Third-party dependencies and resources retain their own terms. This file covers
recorded upstream foundations and is not a complete dependency or artifact SBOM.
A license below applies to its identified material, not to all QuireKit code.

## QuireKit 原创部分 / Original work

Copyright (c) 2026 Wang Yishuai (王一帅) and QuireKit contributors

QuireKit 原创部分按包分为两层：MIT 开源包，以及 QuireKit 商业组件。每个包的许可以其
包内 `LICENSE.md` 为准。以下第三方材料继续遵循其原有许可，不受上述任何一层影响。

QuireKit original work is licensed per package in two tiers: MIT and the QuireKit
Commercial License. Each package's `LICENSE.md` is authoritative. Third-party
materials below retain their own terms regardless of tier.

## ProseMirror

The vendored ProseMirror packages retain their original MIT license files.
The following notices cover the respective upstream portions, including when
those portions are incorporated into a derived or bundled artifact.

### @quirekit/pm-collab, @quirekit/pm-commands, @quirekit/pm-decoration, @quirekit/pm-gapcursor, @quirekit/pm-history, @quirekit/pm-inputrules, @quirekit/pm-keymap, @quirekit/pm-model, @quirekit/pm-schema-list, @quirekit/pm-state, @quirekit/pm-transform, @quirekit/pm-view

Copyright (C) 2015-2017 by Marijn Haverbeke <marijn@haverbeke.berlin> and others

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## Tiptap

Upstream: https://github.com/ueberdosis/tiptap

The following notice applies to Tiptap-derived portions of the compatibility
layer and extensions, where present. It does not relicense QuireKit additions.

MIT License

Copyright (c) 2025, Tiptap GmbH

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## bidi-js

Upstream: https://github.com/lojjic/bidi-js

The renderer uses bidi-js; its code retains the following license.

Copyright (c) 2021 Jason Johnston

MIT License

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Fonts and other resources

The font-pack wrapper has its own MIT license. Distributed font assets retain
their individual OFL or other license files under the font package's licenses
and dist/licenses directories. The wrapper license does not replace font terms.
Local system fonts served by development tooling receive no new redistribution
rights. Other dependencies, bundled resources and license comments retain their
own notices; those obligations must be checked against the actual artifact.

## RevoGrid Community

The optional chart data editor loads `@revolist/revogrid` 4.28.2, MIT licensed.
Upstream: https://github.com/revolist/revogrid

Copyright (c) 2024 Revolist OU

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
