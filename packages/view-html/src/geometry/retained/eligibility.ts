import type { HtmlDescriptor, HtmlNodeDesc } from "../../descriptors";
import type { HtmlRetainedDocumentView } from "../../document";

/**
 * Admits only native text blocks whose normal-flow dependencies can be bounded.
 * @param view - Retained ownership tree after a complete measurement.
 * @returns Stable native blocks, or null for an unknown layout dependency.
 */
export function admitHtmlBlockFlow(view: HtmlRetainedDocumentView): readonly HtmlNodeDesc[] | null {
  const root = view.root.mount?.dom as HTMLElement | undefined;
  const window = root?.ownerDocument.defaultView;
  if (!root || !window?.getComputedStyle || root.ownerDocument.fonts?.status === "loading") return null;
  // Prove complete native ownership before reading styles. A late table or
  // resource must not add a full sibling style scan to every fallback edit.
  const blocks: HtmlNodeDesc[] = [];
  for (const descriptor of view.root.children) {
    if (descriptor.kind !== "node" || !descriptor.node.isTextblock || descriptor.node.textContent.length === 0
      || descriptor.mount?.dom.parentNode !== root || !nativeInlineTree(descriptor)) return null;
    blocks.push(descriptor);
  }
  if (!blocks.length) return null;
  const rootStyle = window.getComputedStyle(root);
  if (!safeStyle(rootStyle) || !["block", "flow-root"].includes(rootStyle.display)
    || !["normal", "start"].includes(rootStyle.alignContent || "normal") || hasGeneratedContent(root)) return null;
  for (let ancestor = root.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const style = window.getComputedStyle(ancestor);
    if (style.animationName !== "none" || !zeroTransition(style)) return null;
  }
  for (const descriptor of blocks) {
    const dom = descriptor.mount!.dom as HTMLElement;
    const style = window.getComputedStyle(dom);
    if (style.display !== "block" || !safeStyle(style) || hasGeneratedContent(dom)) return null;
    // Native marks can affect text metrics but must not introduce positioned,
    // floated, animated or independently laid-out descendants.
    for (const element of dom.querySelectorAll("*")) {
      const inlineStyle = window.getComputedStyle(element);
      if (!safeStyle(inlineStyle) || inlineStyle.display !== "inline" || hasGeneratedContent(element)) return null;
    }
  }
  return blocks;
}

/** @param descriptor - Native text or mark owner. @returns Whether no custom/atomic renderer can mutate asynchronously. */
function nativeInlineTree(descriptor: HtmlDescriptor): boolean {
  if (descriptor.kind === "text") return true;
  if (descriptor.kind !== "node" && descriptor.kind !== "mark") return false;
  if (descriptor.kind === "node" && !descriptor.node.isTextblock) return false;
  if (descriptor.kind === "mark" && descriptor.host) return false;
  return descriptor.children.every(nativeInlineTree);
}

/** @param style - Current computed layout style. @returns Whether normal-flow propagation has no independent motion. */
function safeStyle(style: CSSStyleDeclaration): boolean {
  return style.position === "static" && style.cssFloat === "none" && style.transform === "none"
    && style.writingMode === "horizontal-tb" && ["auto", "1"].includes(style.columnCount)
    && style.columnWidth === "auto" && style.animationName === "none"
    && zeroTransition(style)
    && ["normal", ""].includes(style.containerType) && ["none", ""].includes(style.contain)
    && ["visible", ""].includes(style.contentVisibility);
}

/** @param style - Observed style. @returns Whether hover/focus cannot leave an in-flight transition. */
function zeroTransition(style: CSSStyleDeclaration): boolean {
  return style.transitionDuration.split(",").every(value => Number.parseFloat(value) === 0);
}

/** @param element - Native flow element. @returns Whether unowned generated boxes could introduce independent layout. */
function hasGeneratedContent(element: Element): boolean {
  const window = element.ownerDocument.defaultView!;
  return ["::before", "::after"].some(pseudo => !["none", "normal"].includes(window.getComputedStyle(element, pseudo).content));
}
