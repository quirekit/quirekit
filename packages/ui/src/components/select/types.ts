import type { QuireKitControlSize } from "../control";
/** Select 公开的控件尺寸。 */
export type QuireKitSelectSize = QuireKitControlSize;

/** Select 浮层的首选方位。 */
export type QuireKitSelectPlacement =
  | "bottom-start"
  | "bottom-end"
  | "top-start"
  | "top-end";

/** Select 浮层可选的视觉边界强度。 */
export type QuireKitSelectBorder = "none" | "subtle" | "default";

/** Select 触发器或浮层接受的 CSS 宽度。 */
export type QuireKitSelectLength = string | number;

/** 一个可提交的 Select 选项。 */
export interface QuireKitSelectItem {
  /** 提交给 v-model 与原生表单的稳定值。 */
  readonly value: string;
  /** 选项的可见名称和 typeahead 文本。 */
  readonly label: string;
  /** 是否禁止选择当前选项。 */
  readonly disabled?: boolean;
  /** 选项后显示的快捷键，按阅读顺序列出；仅展示，不注册按键。 */
  readonly shortcut?: readonly string[];
}
