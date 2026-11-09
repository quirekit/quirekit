/**
 * Compiles a conservative dependency on interactive CSS during full admission.
 * @param root - Native document whose subtree and ancestors can affect text flow.
 * @returns Whether interactions may change layout, including unreadable/unknown rules.
 */
export function hasHtmlInteractiveLayoutStyles(root: HTMLElement): boolean {
  const document = root.ownerDocument;
  /** @param rules - CSSOM rules in a stylesheet/group. @param parent - Enclosing nesting selector. @returns Possible interactive layout dependency. */
  function scan(rules: CSSRuleList, parent?: string): boolean {
    for (const rule of Array.from(rules)) {
      let selector = parent;
      // A conditional scope can own interaction state outside child selectors.
      // Preserve unknown group conditions instead of proving them unrelated.
      if (!("selectorText" in rule) && "cssRules" in rule
        && isInteractive(rule.cssText?.split("{")[0] ?? "")) return true;
      if ("selectorText" in rule) {
        const styled = rule as CSSStyleRule;
        selector = !parent ? styled.selectorText : styled.selectorText.includes("&")
          ? styled.selectorText.replaceAll("&", `:is(${parent})`) : `:is(${parent}) ${styled.selectorText}`;
      }
      if (selector && "style" in rule && isInteractive(selector)
        && changesLayout((rule as CSSStyleRule).style) && canAffectFlow(root, selector)) return true;
      if ("styleSheet" in rule) {
        const sheet = (rule as CSSImportRule).styleSheet;
        if (!sheet || scan(sheet.cssRules, parent)) return true;
      }
      if ("cssRules" in rule && scan((rule as CSSGroupingRule).cssRules, selector)) return true;
    }
    return false;
  }
  try {
    return [...Array.from(document.styleSheets ?? []), ...document.adoptedStyleSheets ?? []].some(sheet => scan(sheet.cssRules));
  } catch {
    // Cross-origin CSS and unsupported CSSOM cannot prove stable interaction metrics.
    return true;
  }
}

/** @param selector - Fully expanded nesting selector. @returns Whether observed interaction state participates. */
function isInteractive(selector: string): boolean {
  return /:(?:hover|active|focus(?:-within|-visible)?)(?![\w-])|\[\s*(?:data-qk-modality|style)\b/.test(selector);
}

/** @param style - Rule declarations. @returns Whether any declaration can change flow or inherited metrics. */
function changesLayout(style: CSSStyleDeclaration): boolean {
  for (let index = 0; index < style.length; index++) {
    const property = style.item(index);
    if (!/^(?:color|cursor|opacity|outline(?:-.+)?|background(?:-.+)?|box-shadow|text-decoration(?:-.+)?|border-(?:top-|right-|bottom-|left-)?color|fill|stroke)$/.test(property)) return true;
  }
  return false;
}

/** @param root - Native document. @param selector - Interactive selector. @returns Conservative potential match after removing state restrictions. */
function canAffectFlow(root: HTMLElement, selector: string): boolean {
  // Removing negative/relational restrictions over-approximates both entering
  // and leaving a state. Unknown nesting stays conservative, never a false proof.
  let broad = selector.replace(/:(?:not|has)\([^()]*\)/g, ":is(*)");
  if (/:(?:not|has)\(/.test(broad)) return true;
  broad = broad.replace(/:(?:hover|active|focus(?:-within|-visible)?)(?![\w-])/g, ":is(*)")
    .replace(/\[\s*(?:data-qk-modality|style)\b[^\]]*\]/g, ":is(*)")
    .replace(/::[\w-]+(?:\([^()]*\))?|:(?:before|after|first-letter|first-line)\b/g, "");
  for (let element: Element | null = root; element; element = element.parentElement) {
    if (element.matches(broad)) return true;
  }
  return root.querySelector(broad) !== null;
}
