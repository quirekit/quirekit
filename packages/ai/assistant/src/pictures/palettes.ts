import type { QuireAiPicturePalette } from "./types";

/** Built-in palettes; the first is the default and carries the QuireKit brand blue. */
export const quireAiPicturePalettes: readonly QuireAiPicturePalette[] = [
  { name: "blue", primary: "#4b67f2", dark: "#2f45b8", light: "#e4e9fd", accent: "#93a5f7" },
  { name: "teal", primary: "#0f9d8a", dark: "#0a6b5e", light: "#daf3ef", accent: "#6fd0c2" },
  { name: "orange", primary: "#ee7a2c", dark: "#b0541a", light: "#fdeadb", accent: "#f6b17f" },
  { name: "slate", primary: "#475569", dark: "#1e293b", light: "#e5e9ef", accent: "#94a3b8" },
  { name: "rose", primary: "#de2b6e", dark: "#9c1449", light: "#fde3ed", accent: "#f18fb4" }
];
