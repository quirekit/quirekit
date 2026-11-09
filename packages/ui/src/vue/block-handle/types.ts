/** Color family of a block type, shared by handles and block menus. */
export type QuireBlockTone = "blue" | "indigo" | "green" | "orange" | "teal" | "purple" | "neutral";

/** Visible identity of the block a handle controls. */
export interface QuireBlockHandleProps {
  /** Accessible name; the type mark itself is decorative. */
  readonly label: string;
  /** Registered icon name, used when no badge is given. */
  readonly icon?: string | undefined;
  /** Short text mark such as H1, preferred over the icon. */
  readonly badge?: string | undefined;
  /** Color family of the type mark. */
  readonly tone?: QuireBlockTone | undefined;
}
