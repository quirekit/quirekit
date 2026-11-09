import type { QuireKitControlSize } from "../control";
import type { QuireKitSemanticTypographyRole } from "../../theme";

/** Segmented Control 公开的五档尺寸。 */
export type QuireKitSegmentedSize = QuireKitControlSize;

/** Segmented Control 的排列方向。 */
export type QuireKitSegmentedOrientation = "horizontal" | "vertical";

/** Segmented Control 轨道、选中片和选项共用的外形。 */
export type QuireKitSegmentedShape = "rounded" | "pill" | "square";

/** 一个可被 Segmented Control 选择的稳定选项。 */
export interface QuireKitSegmentedItem {
  /** 提交给表单和 v-model 的稳定语义值。 */
  readonly value: string;
  /** 选项的可见名称和可访问名称。 */
  readonly label: string;
  /** 是否禁止选择当前选项。 */
  readonly disabled?: boolean;
}

/** 一个公开尺寸对应的完整组件几何。 */
export interface QuireKitSegmentedSizeTokens {
  /** 控件轨道的可见高度。 */
  readonly height: string;
  /** 每个选项的最小横向内边距。 */
  readonly paddingInline: string;
  /** 选项内容之间的间距。 */
  readonly gap: string;
  /** 选项内图标的光学盒尺寸。 */
  readonly iconSize: string;
  /** 选项标签字号。 */
  readonly fontSize: string;
  /** 选项标签行高。 */
  readonly lineHeight: string;
}

/** Segmented Control 的完整组件 token 合同。 */
export interface QuireKitSegmentedTokens {
  /** 所有尺寸共享的产品字体。 */
  readonly fontFamily: QuireKitSemanticTypographyRole["fontFamily"];
  /** 标签使用的常规字重。 */
  readonly fontWeight: QuireKitSemanticTypographyRole["fontWeight"];
  /** 标签字距。 */
  readonly letterSpacing: QuireKitSemanticTypographyRole["letterSpacing"];
  /** 五档公开尺寸投影。 */
  readonly size: Readonly<
    Record<QuireKitSegmentedSize, QuireKitSegmentedSizeTokens>
  >;
  /** 轨道与选中片之间的内缩距离。 */
  readonly trackInset: string;
  /** 轨道圆角，默认由选中片圆角与轨道内缩距离配对。 */
  readonly trackRadius: string;
  /** 选中片圆角。 */
  readonly indicatorRadius: string;
  /** 安静分组轨道背景。 */
  readonly trackBackground: string;
  /** 默认标签和图标颜色。 */
  readonly foreground: string;
  /** 指针悬浮时的标签和图标颜色。 */
  readonly hoverForeground: string;
  /** 未选选项的悬浮背景。 */
  readonly hoverBackground: string;
  /** 已选选项的标签和图标颜色。 */
  readonly selectedForeground: string;
  /** 已选指示片的表面颜色。 */
  readonly selectedBackground: string;
  /** 禁用选项的标签和图标颜色。 */
  readonly disabledForeground: string;
  /** 可见焦点边界颜色。 */
  readonly focusColor: string;
  /** 选中片移动和状态反馈时长。 */
  readonly transitionDuration: string;
  /** 选中片移动和状态反馈曲线。 */
  readonly transitionEasing: string;
}
