/** Colours one picture is drawn with. */
export interface QuireAiPicturePalette {
  /** Palette name the model writes. */
  readonly name: string;
  /** Main colour, such as clothing, icon strokes and bands. */
  readonly primary: string;
  /** Darker shade for depth and contrast. */
  readonly dark: string;
  /** Pale tint for backgrounds. */
  readonly light: string;
  /** Mid tone for accents. */
  readonly accent: string;
}

/** One built-in picture: catalog facts and its drawing. */
export interface QuireAiPictureDefinition {
  /** Identifier the model writes, such as `avatar/woman-1`. */
  readonly id: string;
  /** Category shown in the catalog. */
  readonly category: string;
  /** What the picture shows and what it suits. */
  readonly description: string;
  /** Width of the SVG canvas. */
  readonly width: number;
  /** Height of the SVG canvas. */
  readonly height: number;
  /**
   * Draws the picture.
   * @param palette - Colours to draw with.
   * @returns Standalone SVG markup without external references.
   */
  readonly render: (palette: QuireAiPicturePalette) => string;
}

/** A generated picture to store. */
export interface QuireAiPictureFile {
  /** Image type. */
  readonly mimeType: "image/png";
  /** Image bytes. */
  readonly bytes: Uint8Array;
  /** File name. */
  readonly fileName: string;
  /** Pixel size. */
  readonly intrinsicSize: { readonly width: number; readonly height: number };
}

/** Options of the picture port. */
export interface QuireAiPicturePortOptions {
  /**
   * Stores a generated picture.
   * @param file - The picture.
   * @returns Reference the document keeps, such as a media reference or a URL.
   */
  readonly store: (file: QuireAiPictureFile) => unknown | Promise<unknown>;
  /**
   * Turns SVG markup into PNG bytes; the browser canvas by default.
   * @param svg - SVG markup.
   * @param width - Output width in pixels.
   * @param height - Output height in pixels.
   * @returns PNG bytes.
   */
  readonly rasterize: (svg: string, width: number, height: number) => Promise<Uint8Array>;
}
