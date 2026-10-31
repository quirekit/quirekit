import type { QuireAiPictureDefinition } from "./types";

/** Icon strokes on a 24 × 24 grid, with the catalog description of each. */
const icons: readonly (readonly [id: string, description: string, paths: string])[] = [
  ["phone", "电话", "<path d=\"M7 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 5 6a2 2 0 0 1 2-2Z\"/>"],
  ["mail", "邮箱", "<rect x=\"3\" y=\"6\" width=\"18\" height=\"12\" rx=\"2\"/><path d=\"M3.5 7l8.5 6 8.5-6\"/>"],
  ["location", "地址、所在地", "<path d=\"M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11Z\"/><circle cx=\"12\" cy=\"10\" r=\"2.2\"/>"],
  ["web", "网站、作品集", "<circle cx=\"12\" cy=\"12\" r=\"9\"/><ellipse cx=\"12\" cy=\"12\" rx=\"4\" ry=\"9\"/><path d=\"M3 12h18\"/>"],
  ["link", "链接、社交账号", "<path d=\"M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1\"/><path d=\"M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1\"/>"],
  ["calendar", "日期、时间安排", "<rect x=\"4\" y=\"5\" width=\"16\" height=\"15\" rx=\"2\"/><path d=\"M4 10h16M8 3v4M16 3v4\"/>"],
  ["clock", "时间、时长", "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>"],
  ["user", "个人信息、联系人", "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21c0-4 4-7 8-7s8 3 8 7\"/>"],
  ["briefcase", "工作经历", "<rect x=\"3\" y=\"7\" width=\"18\" height=\"13\" rx=\"2\"/><path d=\"M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 12.5h18\"/>"],
  ["graduation", "教育背景", "<path d=\"M2 9l10-5 10 5-10 5Z\"/><path d=\"M6 11v4c0 1.5 3 3 6 3s6-1.5 6-3v-4M22 9v5\"/>"],
  ["trophy", "荣誉、获奖", "<path d=\"M8 4h8v5a4 4 0 0 1-8 0Z\"/><path d=\"M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8\"/>"],
  ["award", "证书、资质", "<circle cx=\"12\" cy=\"9\" r=\"5\"/><path d=\"M8.5 13l-1.5 8 5-3 5 3-1.5-8\"/>"],
  ["star", "亮点、评分", "<path d=\"M12 3l2.8 6 6.2.5-4.8 4.1 1.5 6.4L12 16.6 6.3 20l1.5-6.4L3 9.5 9.2 9Z\"/>"],
  ["check", "完成、优势", "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M8 12.5l2.5 2.5L16 9.5\"/>"],
  ["language", "语言能力", "<path d=\"M4 5h9M8.5 3v2M6 5c0 4 3 7 6 8M11 5c0 3-3 7-6 9M13 21l4-9 4 9M14.5 18h5\"/>"],
  ["code", "技术、编程技能", "<path d=\"M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16\"/>"],
  ["chart", "数据、业绩", "<path d=\"M4 20h16\"/><rect x=\"6\" y=\"12\" width=\"3\" height=\"8\"/><rect x=\"11\" y=\"8\" width=\"3\" height=\"12\"/><rect x=\"16\" y=\"4\" width=\"3\" height=\"16\"/>"],
  ["book", "学习、出版物", "<path d=\"M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3Z\"/><path d=\"M21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7Z\"/>"],
  ["idea", "想法、创新", "<path d=\"M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3Z\"/>"],
  ["heart", "兴趣爱好、志愿服务", "<path d=\"M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z\"/>"]
];

/** Round badge icons: the stroke in the palette's colour on its pale tint. */
export const quireAiIconPictures: readonly QuireAiPictureDefinition[] = icons.map(([id, description, paths]) => ({
  id: `icon/${id}`,
  category: "图标",
  description: `${description}；圆形徽章图标，适合放在联系方式或栏目标题前，宽 0.6–1 厘米`,
  width: 96,
  height: 96,
  render: palette => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">`
    + `<circle cx="48" cy="48" r="48" fill="${palette.light}"/>`
    + `<g transform="translate(24 24) scale(2)" fill="none" stroke="${palette.primary}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`
    + `</svg>`
}));
