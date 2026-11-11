import { QuireProseH1, QuireProseH2, QuireProseH3, QuireProseH4, QuireProseH5, QuireProseH6 } from "../headings";
import { QuireProseA, QuireProseStrong, QuireProseEm, QuireProseB, QuireProseI, QuireProseCite, QuireProseDfn, QuireProseVar, QuireProseSamp, QuireProseSmall, QuireProseMark, QuireProseDel, QuireProseS, QuireProseIns, QuireProseU, QuireProseSub, QuireProseSup, QuireProseAbbr, QuireProseKbd, QuireProseCode, QuireProseBr } from "../inline";
import { QuireProseP, QuireProseBlockquote, QuireProsePre, QuireProseHr } from "../blocks";
import { QuireProseUl, QuireProseOl, QuireProseLi, QuireProseDl, QuireProseDt, QuireProseDd } from "../lists";
import { QuireProseTable, QuireProseThead, QuireProseTbody, QuireProseTfoot, QuireProseTr, QuireProseTh, QuireProseTd, QuireProseCaption } from "../table";
import { QuireProseImg, QuireProseFigure, QuireProseFigcaption } from "../media";
import type { QuireKitProseComponentMap } from "../types";

/** Immutable native tag defaults. Spread into the host renderer map before applying local overrides. */
export const quireProseComponents = /* @__PURE__ */ Object.freeze({
  h1: QuireProseH1,
  h2: QuireProseH2,
  h3: QuireProseH3,
  h4: QuireProseH4,
  h5: QuireProseH5,
  h6: QuireProseH6,
  a: QuireProseA,
  strong: QuireProseStrong,
  em: QuireProseEm,
  b: QuireProseB,
  i: QuireProseI,
  cite: QuireProseCite,
  dfn: QuireProseDfn,
  var: QuireProseVar,
  samp: QuireProseSamp,
  small: QuireProseSmall,
  mark: QuireProseMark,
  del: QuireProseDel,
  s: QuireProseS,
  ins: QuireProseIns,
  u: QuireProseU,
  sub: QuireProseSub,
  sup: QuireProseSup,
  abbr: QuireProseAbbr,
  kbd: QuireProseKbd,
  code: QuireProseCode,
  br: QuireProseBr,
  p: QuireProseP,
  blockquote: QuireProseBlockquote,
  pre: QuireProsePre,
  hr: QuireProseHr,
  ul: QuireProseUl,
  ol: QuireProseOl,
  li: QuireProseLi,
  dl: QuireProseDl,
  dt: QuireProseDt,
  dd: QuireProseDd,
  table: QuireProseTable,
  thead: QuireProseThead,
  tbody: QuireProseTbody,
  tfoot: QuireProseTfoot,
  tr: QuireProseTr,
  th: QuireProseTh,
  td: QuireProseTd,
  caption: QuireProseCaption,
  img: QuireProseImg,
  figure: QuireProseFigure,
  figcaption: QuireProseFigcaption,
} satisfies Required<QuireKitProseComponentMap>);
