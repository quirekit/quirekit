import { quireKitControlSizes } from "../control";
import type { QuireKitTheme } from "../../theme";
import type {
  QuireKitSegmentedSizeTokens,
  QuireKitSegmentedTokens
} from "./types";

/**
 * 从完整语义主题派生 Segmented Control 组件 token。
 *
 * @param theme - 宿主选择的完整语义主题。
 * @returns 不可变的 Segmented Control 组件 token。
 */
export function createSegmentedTokens(
  theme: QuireKitTheme
): QuireKitSegmentedTokens {
  return Object.freeze({
    fontFamily: theme.typography.control.fontFamily,
    fontWeight: theme.typography.body.fontWeight,
    letterSpacing: theme.typography.control.letterSpacing,
    size: Object.freeze({
      xs: sizeTokens(
        theme.control[quireKitControlSizes.xs.height],
        theme.spacing.inline,
        theme.spacing.inlineTight,
        theme.control.icon,
        theme.typography[quireKitControlSizes.xs.typography]
      ),
      sm: sizeTokens(
        theme.control[quireKitControlSizes.sm.height],
        theme.spacing.surfaceCompact,
        theme.spacing.inlineTight,
        theme.control.icon,
        theme.typography[quireKitControlSizes.sm.typography]
      ),
      md: sizeTokens(
        theme.control[quireKitControlSizes.md.height],
        theme.spacing.surfaceCompact,
        theme.spacing.inline,
        theme.control.icon,
        theme.typography[quireKitControlSizes.md.typography]
      ),
      lg: sizeTokens(
        theme.control[quireKitControlSizes.lg.height],
        theme.spacing.surface,
        theme.spacing.inline,
        theme.control.icon,
        theme.typography[quireKitControlSizes.lg.typography]
      ),
      xl: sizeTokens(
        theme.control[quireKitControlSizes.xl.height],
        theme.spacing.surface,
        theme.spacing.inline,
        theme.control.iconLarge,
        theme.typography[quireKitControlSizes.xl.typography]
      )
    }),
    trackInset: theme.borderWidth.focus,
    trackRadius: `calc(${theme.radius.control} + ${theme.borderWidth.focus})`,
    indicatorRadius: theme.radius.control,
    trackBackground: theme.color.surface.hover,
    foreground: theme.color.text.secondary,
    hoverForeground: theme.color.text.primary,
    hoverBackground: theme.color.surface.pressed,
    selectedForeground: theme.color.text.primary,
    selectedBackground: theme.color.surface.raised,
    disabledForeground: theme.color.text.disabled,
    focusColor: theme.color.border.focus,
    transitionDuration: theme.motion.controlDuration,
    transitionEasing: theme.motion.standardEasing
  });
}

/**
 * 组合一个公开尺寸的几何和排版投影。
 *
 * @param height - 语义控件高度。
 * @param paddingInline - 选项横向内边距。
 * @param gap - 选项内部内容间距。
 * @param iconSize - 图标光学盒尺寸。
 * @param typography - 匹配当前高度的语义排版角色。
 * @returns 不可变的公开尺寸 token。
 */
function sizeTokens(
  height: string,
  paddingInline: string,
  gap: string,
  iconSize: string,
  typography: QuireKitTheme["typography"]["compact"]
): QuireKitSegmentedSizeTokens {
  return Object.freeze({
    height,
    paddingInline,
    gap,
    iconSize,
    fontSize: typography.fontSize,
    lineHeight: typography.lineHeight
  });
}
