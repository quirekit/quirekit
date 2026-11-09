/** Accordion 支持的布局与方向键导航方向。 */
export type QuireKitAccordionOrientation = "horizontal" | "vertical";

/** Accordion 触发器的公开尺寸。 */
export type QuireKitAccordionSize = "sm" | "md";

/** Accordion 的外框与条目边界外观。 */
export type QuireKitAccordionVariant = "outline" | "plain";

/** Accordion 中一个稳定条目的框架无关合同。 */
export interface QuireKitAccordionItem {
  /** 条目的稳定值，同时参与打开状态与 DOM 标识。 */
  readonly value: string;
  /** 触发器默认显示的主要文字。 */
  readonly title: string;
  /** 标题下方的可选说明。 */
  readonly description?: string;
  /** 未提供 content 插槽时展示的默认内容。 */
  readonly content?: string;
  /** 是否禁止当前条目响应 pointer 与 keyboard。 */
  readonly disabled?: boolean;
}
