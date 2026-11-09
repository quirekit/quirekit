import type { QuireKitSemanticTypographyRole } from "../../theme";

/** Physical direction used to interpret horizontal toolbar arrow keys. */
export type QuireKitToolbarDirection = "ltr" | "rtl";

/** Layout and keyboard-navigation direction of one toolbar. */
export type QuireKitToolbarOrientation = "horizontal" | "vertical";

/** Desktop controls, touch controls, or the owning document's 768px layout breakpoint. */
export type QuireKitToolbarMode = "desktop" | "mobile" | "auto";

/**
 * Horizontal overflow presentation; vertical toolbars keep their natural layout.
 * `scroll` scrolls the row with edge arrows; `collapse` moves trailing top-level entries into a
 * "more" panel (configured `items` only); `visible` lets content overflow its container.
 */
export type QuireKitToolbarOverflow = "scroll" | "collapse" | "visible";

/** Measured toolbar control used by collapse layout; groups contribute one unit per child. */
export interface QuireKitToolbarCollapseUnit {
  /** Inline advance in CSS pixels: the unit's width plus the gap or group edge before it. */
  readonly advance: number;
  /** Whether the unit is a separator, which never ends the visible row. */
  readonly separator: boolean;
}

/** Native scrollbar presentation within a horizontally scrolling toolbar. */
export type QuireKitToolbarScrollbar = "hidden" | "auto";

/** Inline alignment while horizontal content fits; overflow always starts at its logical edge. */
export type QuireKitToolbarAlignment = "start" | "center";

/** Stable host-owned data attributes on a configured native trigger. */
export type QuireKitToolbarAttributes = Readonly<Record<`data-${string}`, string | number | boolean | undefined>>;

/** Public floating-surface attributes, excluding behavior or private machine overrides. */
export interface QuireKitToolbarContentAttributes extends QuireKitToolbarAttributes {
  /** Optional application content class. */
  readonly class?: string;
  /** Language inherited by the floating content. */
  readonly lang?: string;
  /** Direction inherited by the floating content. */
  readonly dir?: QuireKitToolbarDirection;
}

/** Floating presentation delegated to the public Menu and Popover components. */
export interface QuireKitToolbarOverlayProps {
  /** Owning document's public portal target. */
  readonly portalTarget?: string | HTMLElement;
  /** Whether an ordinary menu selection closes immediately; controlled hosts may close after success. */
  readonly closeOnSelect?: boolean;
  /** Menu's fixed content width. */
  readonly width?: import("../menu/types").QuireKitMenuLength;
  /** Menu's minimum content width. */
  readonly minWidth?: import("../menu/types").QuireKitMenuLength;
  /** Menu's maximum content width. */
  readonly maxWidth?: import("../menu/types").QuireKitMenuLength;
  /** Host content language and stable application markers. */
  readonly contentAttributes?: QuireKitToolbarContentAttributes;
  /** Whether a disclosure or selector popover returns focus to its trigger on close; false when the host hands focus elsewhere. */
  readonly restoreFocus?: boolean;
}

/** Popup roles exposed by toolbar disclosure controls. */
export type QuireKitToolbarPopup =
  | "dialog"
  | "grid"
  | "listbox"
  | "menu"
  | "tree";

/** Overlay composition owned by a Toolbar Split Button disclosure. */
export type QuireKitToolbarSplitOverlay = "custom" | "menu" | "popover";

/** Toggle state exposed through the native aria-pressed contract. */
export type QuireKitToolbarToggleState = boolean | "mixed";

/** One focusable toolbar item used by the renderer-neutral navigation model. */
export interface QuireKitToolbarRovingItem {
  /** Stable identity shared by the renderer and navigation state. */
  readonly id: string;
  /** Whether this item is unavailable and excluded from the roving sequence. */
  readonly disabled?: boolean;
}

/** Inputs that control toolbar keyboard navigation. */
export interface QuireKitToolbarNavigationOptions {
  /** Layout direction that determines which arrow-key pair is owned. */
  readonly orientation: QuireKitToolbarOrientation;
  /** Text direction used to mirror horizontal previous and next movement. */
  readonly direction?: QuireKitToolbarDirection;
  /** Whether movement beyond an edge wraps to the opposite edge. */
  readonly loop?: boolean;
}

/** Typography values owned by the Toolbar component family. */
export interface QuireKitToolbarTypographyTokens {
  /** Product font shared by labeled toolbar controls. */
  readonly fontFamily: QuireKitSemanticTypographyRole["fontFamily"];
  /** Compact label font size. */
  readonly fontSize: QuireKitSemanticTypographyRole["fontSize"];
  /** Compact label line height. */
  readonly lineHeight: QuireKitSemanticTypographyRole["lineHeight"];
  /** Medium control-label weight. */
  readonly fontWeight: QuireKitSemanticTypographyRole["fontWeight"];
  /** Compact control-label letter spacing. */
  readonly letterSpacing: QuireKitSemanticTypographyRole["letterSpacing"];
}

/** Geometry values owned by the Toolbar component family. */
export interface QuireKitToolbarGeometryTokens {
  /** Stable height of an action or disclosure control. */
  readonly itemHeight: string;
  /** Optical icon box inside every toolbar action. */
  readonly iconSize: string;
  /** Compact icon-width target for the Split disclosure. */
  readonly splitDisclosureWidth: string;
  /** Inline padding of a labeled disclosure control. */
  readonly itemPaddingInline: string;
  /** Gap between a disclosure label, icon, and indicator. */
  readonly itemGap: string;
  /** Gap between actions in the same semantic group. */
  readonly groupGap: string;
  /** Gap between adjacent semantic groups. */
  readonly toolbarGap: string;
  /** Radius applied to each toolbar action. */
  readonly itemRadius: string;
  /** Visible item boundary width. */
  readonly borderWidth: string;
  /** Width of a group separator. */
  readonly separatorWidth: string;
  /** Block inset that keeps separators shorter than the toolbar. */
  readonly separatorInset: string;
}

/** Color values owned by the Toolbar component family. */
export interface QuireKitToolbarColorTokens {
  /** Persistent toolbar surface. */
  readonly surface: string;
  /** Default icon and label color. */
  readonly foreground: string;
  /** Pointer-hover surface. */
  readonly hoverBackground: string;
  /** Active pointer surface. */
  readonly activeBackground: string;
  /** Persistent toggle and open-disclosure surface. */
  readonly selectedBackground: string;
  /** Visible keyboard-focus boundary color. */
  readonly focusBorder: string;
  /** Disabled icon and label color. */
  readonly disabledForeground: string;
  /** Separator color between semantic groups. */
  readonly separator: string;
}

/** Complete Toolbar action and group token contract. */
export interface QuireKitToolbarTokens {
  /** Toolbar label typography. */
  readonly typography: QuireKitToolbarTypographyTokens;
  /** Toolbar control and group geometry. */
  readonly geometry: QuireKitToolbarGeometryTokens;
  /** Toolbar surface and interaction colors. */
  readonly color: QuireKitToolbarColorTokens;
  /** Feedback transition duration. */
  readonly feedbackDuration: string;
  /** Feedback transition easing. */
  readonly feedbackEasing: string;
}

/** Natural control widths, or widths measured in toolbar units. */
export type QuireKitToolbarSizing = "natural" | "units";

/** Embedded, bordered standalone, or borderless elevated toolbar surface. */
export type QuireKitToolbarVariant = "plain" | "outlined" | "elevated";

/** One explicit horizontal row sharing its Toolbar's surface and focus scope. */
export interface QuireKitToolbarRow {
  /** Stable row identity, prepended to configured entry event paths. */
  readonly value: string;
  /** Accessible name for this row's semantic group. */
  readonly label: string;
  /** Ordered controls using the same contract as a single-row toolbar. */
  readonly items: readonly QuireKitToolbarEntry[];
  /** Exclude the row from layout and keyboard navigation. */
  readonly hidden?: boolean;
  /** Inherited availability for every control in this row. */
  readonly disabled?: boolean;
}

/** Declarative toolbar entry rendered by the existing keyboard-aware primitives. */
export interface QuireKitToolbarEntry {
  /** Stable identity used in emitted intents and keyed rendering. */
  readonly value: string;
  /** Visible or accessible action name; separator entries may use an empty label. */
  readonly label: string;
  /** Entry behavior; omission means an immediate action. */
  readonly kind?: "action" | "toggle" | "menu" | "selector" | "disclosure" | "split" | "group" | "separator" | "custom";
  /** Provider icon name; without an icon the action displays its label. */
  readonly icon?: string;
  /** Normalized icon data; takes precedence over a provider icon name. */
  readonly iconData?: import("../icon/types").QuireKitIconData;
  /** Runtime accent used by stateful artwork such as a current-color underline. */
  readonly iconAccentColor?: string;
  /** Whether stateful artwork represents an explicitly cleared value. */
  readonly iconEmpty?: boolean;
  /** Tooltip explanation; defaults to label. False is for an enclosing compound tooltip owner. */
  readonly tooltip?: string | false;
  /** Keyboard shortcut shown in the tooltip, in reading order such as `["⌘", "B"]`; display only, never registered. */
  readonly shortcut?: readonly string[];
  /** Explanation shown while this entry is unavailable. */
  readonly disabledReason?: string;
  /** Native trigger data attributes; keyboard and interaction properties remain component-owned. */
  readonly attributes?: QuireKitToolbarAttributes;
  /** Menu trigger appearance; selector displays a current value, disclosure represents an operation. */
  readonly trigger?: "selector" | "disclosure";
  /** Show the public disclosure indicator; menu disclosures default to true. */
  readonly indicator?: boolean;
  /** Disclosure or custom-control popup semantics; false represents a persistent external panel. */
  readonly popup?: QuireKitToolbarPopup | false;
  /** Public floating-surface options for Menu and Popover content. */
  readonly overlayProps?: QuireKitToolbarOverlayProps;
  /** Optional text shown next to the icon. */
  readonly text?: string;
  /**
   * Width in toolbar units, where one unit is an icon action and half units are
   * allowed. Omitted spans are derived from the entry kind in unit sizing; text
   * and custom controls keep their natural width unless a span is declared.
   */
  readonly span?: number;
  /** Whether activation and roving focus are unavailable. */
  readonly disabled?: boolean;
  /** Hidden entries are unmounted and excluded from keyboard navigation. */
  readonly hidden?: boolean;
  /** Host-defined metadata, such as a command id; never interpreted by Toolbar. */
  readonly meta?: unknown;
  /** Default command parameters; custom renderers may supply a different payload. */
  readonly payload?: unknown;
  /** Registry key for an arbitrary custom control using public Toolbar primitives. */
  readonly renderer?: string;
  /** Registry key for a selector, disclosure, or split button's Popover body. */
  readonly contentRenderer?: string;
  /** Popup body inset; none lets a composed list or picker own its outer spacing. Defaults to default. */
  readonly contentPadding?: "default" | "none";
  /** Controlled popup state; omission gives each mounted entry local state. */
  readonly expanded?: boolean;
  /** Optional accessible description element id. */
  readonly describedBy?: string;
  /** Split primary action name; defaults to label. */
  readonly actionLabel?: string;
  /** Split primary explanation; defaults to its action name. */
  readonly actionTooltip?: string | false;
  /** Split disclosure name; defaults to label. */
  readonly disclosureLabel?: string;
  /** Split disclosure explanation; defaults to its disclosure name. */
  readonly disclosureTooltip?: string | false;
  /** Disable only the split primary action. */
  readonly actionDisabled?: boolean;
  /** Disable only the split disclosure. */
  readonly disclosureDisabled?: boolean;
  /** Host-owned toggle state, also supported by a split entry primary action. */
  readonly pressed?: QuireKitToolbarToggleState;
  /** Ordered children of a semantic group. */
  readonly children?: readonly QuireKitToolbarEntry[];
  /** Declarative menu entries for a menu trigger or split disclosure; takes precedence over split contentRenderer. */
  readonly items?: readonly import("../menu/types").QuireKitMenuEntry[];
}

/** An accepted intent; the host owns execution, permissions and editor targets. */
export interface QuireKitToolbarExecuteEvent {
  /** Original native activation, when available, for host focus and interaction continuity. */
  readonly nativeEvent?: Event;
  /** Trigger entry, including opaque host metadata. For menus this is the menu trigger. */
  readonly item: QuireKitToolbarEntry;
  /** Entry value, or selected menu leaf value. */
  readonly value: string;
  /** Group and entry identities; menu leaf identity is appended. */
  readonly path: readonly string[];
  /** Interaction that produced this request. */
  readonly source: "action" | "toggle" | "menu" | "custom" | "popup";
  /** Entry default payload or the value supplied by a custom renderer. */
  readonly payload: unknown;
  /** Requested toggle state, present only for toggle activation. */
  readonly pressed?: boolean;
}

/** Popup transition request; controlled entries must write expanded back. */
export interface QuireKitToolbarOpenChangeEvent {
  /** Entry owning the popup. */
  readonly item: QuireKitToolbarEntry;
  /** Stable group and entry identities. */
  readonly path: readonly string[];
  /** Requested open state. */
  readonly expanded: boolean;
}
