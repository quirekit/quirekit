import type { QuireAiPicturePort, QuireAiPreparedPicture } from "@quirekit/ai-contract";
import { quireAiAvatarPictures } from "./avatars";
import { quireAiDecorationPictures } from "./decorations";
import { quireAiIconPictures } from "./icons";
import { quireAiPicturePalettes } from "./palettes";
import type { QuireAiPictureDefinition, QuireAiPicturePortOptions } from "./types";

/** Every built-in picture. */
export const quireAiPictures: readonly QuireAiPictureDefinition[] = [
  ...quireAiAvatarPictures, ...quireAiIconPictures, ...quireAiDecorationPictures
];

/** Longest side of a generated image, in pixels. */
const maximumSide = 1800;

/** Upscaling of small pictures so they stay sharp in print. */
const scale = 3;

/**
 * Creates the picture port: built-in pictures recoloured by palette, rendered to PNG and stored
 * by the host once per picture and palette.
 * @param options - Host store and rasteriser.
 * @returns Picture port for a document SDK.
 */
export function createQuireAiPicturePort(options: QuireAiPicturePortOptions): QuireAiPicturePort {
  const prepared = new Map<string, Promise<QuireAiPreparedPicture>>();
  const port: QuireAiPicturePort = {
    list: () => quireAiPictures.map(picture => ({ id: picture.id, category: picture.category, description: picture.description, aspect: picture.width / picture.height })),
    palettes: () => quireAiPicturePalettes.map(palette => palette.name),
    prepare({ asset, palette: paletteName }) {
      const picture = quireAiPictures.find(entry => entry.id === asset);
      if (picture === undefined) return Promise.reject(new Error(`picture ${asset} is not in the catalog; call document_help with pictures for the ids.`));
      const palette = paletteName === undefined ? quireAiPicturePalettes[0]! : quireAiPicturePalettes.find(entry => entry.name === paletteName);
      if (palette === undefined) return Promise.reject(new Error(`palette ${paletteName} does not exist; use one of: ${port.palettes().join(", ")}.`));
      const key = `${picture.id}\u0000${palette.name}`;
      let pending = prepared.get(key);
      if (pending === undefined) {
        pending = generate(picture, palette);
        prepared.set(key, pending);
        // A failed render may succeed later; only successes are kept.
        pending.catch(() => prepared.delete(key));
      }
      return pending;
    }
  };

  /**
   * @param picture - Built-in picture.
   * @param palette - Palette to draw with.
   * @returns The stored picture.
   */
  async function generate(picture: QuireAiPictureDefinition, palette: (typeof quireAiPicturePalettes)[number]): Promise<QuireAiPreparedPicture> {
    const factor = Math.min(scale, maximumSide / Math.max(picture.width, picture.height));
    const width = Math.round(picture.width * factor);
    const height = Math.round(picture.height * factor);
    const bytes = await options.rasterize(picture.render(palette), width, height);
    const fileName = `${picture.id.replace("/", "-")}-${palette.name}.png`;
    const source = await options.store({ mimeType: "image/png", bytes, fileName, intrinsicSize: { width, height } });
    return { source, intrinsicSize: { width, height }, name: fileName };
  }

  return Object.freeze(port);
}

/**
 * Renders SVG markup to PNG bytes with the browser's image decoder and canvas.
 * @param svg - SVG markup without external references.
 * @param width - Output width in pixels.
 * @param height - Output height in pixels.
 * @returns PNG bytes.
 */
export async function rasterizeQuireAiSvg(svg: string, width: number, height: number): Promise<Uint8Array> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image(width, height);
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
    if (blob === null) throw new Error("the picture could not be rendered; try again.");
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}
