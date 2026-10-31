import type { QuireAiPictureDefinition, QuireAiPicturePalette } from "./types";

/** Skin tones of the portraits. */
const skins = { light: "#f6d6c4", medium: "#e7b894", tan: "#c98f67", deep: "#8e5b3c" } as const;

/** Hair colours of the portraits. */
const hairs = { black: "#1f2430", darkBrown: "#3b2a24", brown: "#6b4632" } as const;

/** Hair drawn behind the head, then over it. */
interface HairStyle {
  /** Shapes behind the head, such as long hair. */
  readonly back?: string;
  /** Shapes over the head, such as a fringe. */
  readonly front: string;
}

/** Hair styles, drawn on the 160 × 200 portrait canvas. */
const styles: Readonly<Record<string, HairStyle>> = {
  short: { front: "M50 88C48 58 62 44 80 44s32 14 30 44c-4-14-12-22-22-24-12 6-26 8-38 24Z" },
  sidePart: { front: "M50 90C47 58 61 42 81 42c19 0 32 14 30 42-10-2-20-10-26-20-4 12-18 20-35 26Z" },
  buzz: { front: "M51 82c0-22 13-36 29-36s29 14 29 36c-8-10-18-14-29-14s-21 4-29 14Z" },
  curly: { front: [[56, 64, 12], [68, 52, 13], [82, 48, 14], [96, 52, 13], [106, 64, 12], [51, 78, 8], [109, 78, 8]].map(([x, y, r]) => `M${x! - r!} ${y}a${r} ${r} 0 1 0 ${2 * r!} 0a${r} ${r} 0 1 0 ${-2 * r!} 0Z`).join("") },
  long: {
    back: "M44 90c0-34 16-52 36-52s36 18 36 52v60H44Z",
    front: "M50 86c2-24 14-38 30-38 18 0 30 14 30 38-14-4-24-12-30-22-6 10-16 18-30 22Z"
  },
  bob: {
    back: "M45 92c0-34 15-50 35-50s35 16 35 50v22c0 6-6 9-11 6V98H56v22c-5 3-11 0-11-6Z",
    front: "M50 82c0-21 13-35 30-35s30 14 30 35c-10-6-20-9-30-9s-20 3-30 9Z"
  },
  bun: { front: "M66 38a14 14 0 1 0 28 0a14 14 0 1 0-28 0ZM50 86c0-26 13-40 30-40s30 14 30 40c-6-12-16-20-30-20s-24 8-30 20Z" },
  wavy: {
    back: "M42 92c-2-34 16-54 38-54s40 20 38 54c4 20 2 40-6 58H48c-8-18-10-38-6-58Z",
    front: "M50 88c0-26 14-40 32-40 16 0 28 12 28 32-16 0-30-6-38-16-6 12-14 20-22 24Z"
  }
};

/** Portrait settings. */
interface Portrait {
  /** Catalog id. */
  readonly id: string;
  /** Catalog description. */
  readonly description: string;
  /** Skin tone. */
  readonly skin: string;
  /** Hair colour. */
  readonly hair: string;
  /** Hair style key. */
  readonly style: keyof typeof styles;
  /** Whether the portrait wears glasses. */
  readonly glasses?: boolean;
  /** Clothing: a jacket over a shirt collar, or a blouse with a round neckline. */
  readonly clothing: "jacket" | "blouse";
}

const portraits: readonly Portrait[] = [
  { id: "avatar/man-1", description: "短发男性，西装衬衫，证件照风格", skin: skins.light, hair: hairs.black, style: "short", clothing: "jacket" },
  { id: "avatar/man-2", description: "侧分短发男性，戴眼镜，西装", skin: skins.medium, hair: hairs.darkBrown, style: "sidePart", glasses: true, clothing: "jacket" },
  { id: "avatar/man-3", description: "寸头男性，西装", skin: skins.tan, hair: hairs.black, style: "buzz", clothing: "jacket" },
  { id: "avatar/man-4", description: "卷发男性，休闲上衣", skin: skins.deep, hair: hairs.black, style: "curly", clothing: "blouse" },
  { id: "avatar/woman-1", description: "长直发女性，圆领上衣", skin: skins.light, hair: hairs.black, style: "long", clothing: "blouse" },
  { id: "avatar/woman-2", description: "短发波波头女性，西装", skin: skins.medium, hair: hairs.darkBrown, style: "bob", clothing: "jacket" },
  { id: "avatar/woman-3", description: "盘发女性，圆领上衣", skin: skins.tan, hair: hairs.brown, style: "bun", clothing: "blouse" },
  { id: "avatar/woman-4", description: "长卷发女性，戴眼镜，圆领上衣", skin: skins.deep, hair: hairs.black, style: "wavy", glasses: true, clothing: "blouse" }
];

/**
 * Draws one portrait: head and shoulders on a pale backdrop, clothing in the palette's colour.
 * @param portrait - Portrait settings.
 * @param palette - Colours.
 * @returns SVG markup.
 */
function drawPortrait(portrait: Portrait, palette: QuireAiPicturePalette): string {
  const style = styles[portrait.style]!;
  const clothing = portrait.clothing === "jacket"
    ? `<path d="M14 200c4-42 30-64 66-64s62 22 66 64Z" fill="${palette.primary}"/><path d="M66 136l14 30 14-30Z" fill="#ffffff"/><path d="M76 146l4 26 4-26Z" fill="${palette.dark}"/><path d="M60 138l20 36-12 26H44Z" fill="${palette.dark}" opacity=".25"/><path d="M100 138l-20 36 12 26h24Z" fill="${palette.dark}" opacity=".25"/>`
    : `<path d="M14 200c4-42 30-64 66-64s62 22 66 64Z" fill="${palette.primary}"/><path d="M64 137c4 10 9 15 16 15s12-5 16-15Z" fill="${portrait.skin}"/>`;
  const glasses = portrait.glasses === true
    ? `<g fill="none" stroke="#2a2f3a" stroke-width="2.5"><rect x="58" y="83" width="19" height="14" rx="5"/><rect x="83" y="83" width="19" height="14" rx="5"/><path d="M77 89h6"/></g>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 200" width="160" height="200">`
    + `<rect width="160" height="200" fill="${palette.light}"/>`
    + `<circle cx="132" cy="30" r="46" fill="${palette.accent}" opacity=".25"/>`
    + (style.back === undefined ? "" : `<path d="${style.back}" fill="${portrait.hair}"/>`)
    + `<rect x="68" y="112" width="24" height="32" rx="10" fill="${portrait.skin}"/>`
    + clothing
    + `<circle cx="50" cy="90" r="6" fill="${portrait.skin}"/><circle cx="110" cy="90" r="6" fill="${portrait.skin}"/>`
    + `<ellipse cx="80" cy="86" rx="30" ry="36" fill="${portrait.skin}"/>`
    + `<path d="${style.front}" fill="${portrait.hair}"/>`
    + `<g stroke="${portrait.hair}" stroke-width="3" stroke-linecap="round"><path d="M63 79h10M87 79h10"/></g>`
    + `<circle cx="68" cy="90" r="3.2" fill="#1f2430"/><circle cx="92" cy="90" r="3.2" fill="#1f2430"/>`
    + `<circle cx="62" cy="101" r="5" fill="#f19a8e" opacity=".3"/><circle cx="98" cy="101" r="5" fill="#f19a8e" opacity=".3"/>`
    + `<path d="M72 106q8 6 16 0" fill="none" stroke="#9a4a3a" stroke-width="3" stroke-linecap="round"/>`
    + glasses
    + `</svg>`;
}

/** Portrait pictures, 4:5 like an ID photo. */
export const quireAiAvatarPictures: readonly QuireAiPictureDefinition[] = portraits.map(portrait => ({
  id: portrait.id,
  category: "头像",
  description: `${portrait.description}；适合简历照片、团队介绍`,
  width: 160,
  height: 200,
  render: palette => drawPortrait(portrait, palette)
}));
