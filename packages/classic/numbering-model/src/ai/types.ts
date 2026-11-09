/** List membership as shown in the AI view. */
export interface ListValue {
  /** Marker family. */
  readonly kind: "bullet" | "number" | "task";
  /** Zero-based list level. */
  readonly level: number;
  /** Marker pattern of the level, when it is one of the named patterns. */
  readonly style?: string;
  /** Number the item shows, where the view shows it. */
  readonly start?: number;
  /** Whether a task item is done. */
  readonly checked?: boolean;
}
