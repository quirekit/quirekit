/** One documented key binding of the product editor. */
export interface MdShortcut {
  /** Toolbar intent run by the key, or a stable name for keys owned by an editor extension. */
  readonly id: string;
  /** CodeMirror key name; `Mod` is Command on macOS and Ctrl elsewhere. */
  readonly key: string;
  /** macOS key name when it differs from `key`. */
  readonly mac?: string;
  /** Localized action name. */
  readonly label: string;
  /** Whether the product keymap runs the toolbar intent; otherwise an installed extension owns the key. */
  readonly intent: boolean;
}

/** Shortcuts listed together in the reference dialog. */
export interface MdShortcutGroup {
  /** Localized group title. */
  readonly title: string;
  /** Bindings in reading order. */
  readonly items: readonly MdShortcut[];
}
