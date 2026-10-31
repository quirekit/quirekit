import type { QuireAiPictureDefinition } from "./types";

/** Wide and full-page decorations in the palette's colours. */
export const quireAiDecorationPictures: readonly QuireAiPictureDefinition[] = [
  {
    id: "decor/header-band",
    category: "装饰",
    description: "页眉色带：主色横幅，右侧几何圆点；放在简历、报告第一页顶部，宽度与版心相同",
    width: 1200,
    height: 160,
    render: palette => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 160" width="1200" height="160">`
      + `<rect width="1200" height="160" fill="${palette.primary}"/>`
      + `<circle cx="1110" cy="20" r="120" fill="${palette.accent}" opacity=".35"/>`
      + `<circle cx="980" cy="150" r="70" fill="${palette.dark}" opacity=".35"/>`
      + `<circle cx="1180" cy="140" r="36" fill="#ffffff" opacity=".18"/>`
      + `<rect y="148" width="1200" height="12" fill="${palette.dark}" opacity=".4"/>`
      + `</svg>`
  },
  {
    id: "decor/divider",
    category: "装饰",
    description: "分隔线：细线中间一枚菱形；放在栏目之间，宽度与版心相同",
    width: 1200,
    height: 32,
    render: palette => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 32" width="1200" height="32">`
      + `<path d="M0 16h570M630 16h570" stroke="${palette.accent}" stroke-width="3"/>`
      + `<path d="M600 4l12 12-12 12-12-12Z" fill="${palette.primary}"/>`
      + `<circle cx="566" cy="16" r="4" fill="${palette.accent}"/><circle cx="634" cy="16" r="4" fill="${palette.accent}"/>`
      + `</svg>`
  },
  {
    id: "decor/corner",
    category: "装饰",
    description: "角花：四分之一圆环与圆点；放在封面或首页角落，宽 3–5 厘米",
    width: 240,
    height: 240,
    render: palette => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="240" height="240">`
      + `<path d="M0 0h240A240 240 0 0 1 0 240Z" fill="${palette.light}"/>`
      + `<path d="M0 0h170A170 170 0 0 1 0 170Z" fill="${palette.accent}" opacity=".55"/>`
      + `<path d="M0 0h100A100 100 0 0 1 0 100Z" fill="${palette.primary}"/>`
      + `<circle cx="196" cy="196" r="10" fill="${palette.primary}"/><circle cx="222" cy="150" r="6" fill="${palette.accent}"/>`
      + `</svg>`
  },
  {
    id: "decor/cover",
    category: "装饰",
    description: "封面背景：A4 比例，右上大圆与左下色块；作为报告、方案封面的整页底图（宽约 21 厘米）",
    width: 1240,
    height: 1754,
    render: palette => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1240 1754" width="1240" height="1754">`
      + `<rect width="1240" height="1754" fill="#ffffff"/>`
      + `<circle cx="1120" cy="160" r="460" fill="${palette.light}"/>`
      + `<circle cx="1060" cy="230" r="250" fill="${palette.accent}" opacity=".45"/>`
      + `<path d="M0 1380l620 374H0Z" fill="${palette.primary}"/>`
      + `<path d="M0 1500l420 254H0Z" fill="${palette.dark}"/>`
      + `<rect x="120" y="700" width="140" height="14" rx="7" fill="${palette.primary}"/>`
      + `</svg>`
  }
];
