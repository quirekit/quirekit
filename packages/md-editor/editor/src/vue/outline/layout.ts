import { computed, shallowRef, watch, type Ref } from "vue";

/** Minimum editor width that keeps a readable document column beside the pinned outline. */
const sideMinWidth = 1040;
/** Extra width the comment rail takes when both rails are shown. */
const commentReserve = 304;
/** Space below sticky chrome that still counts as the start of the reading area. */
const readingOffset = 24;

/**
 * Chooses the outline presentation from the editor's own width and tracks sticky toolbar geometry. With room the
 * outline is a pinned panel the reader can collapse to its toggle; without room the toggle opens a popover.
 * @param root - Editor root, whose width (not the window's) decides the rail.
 * @param toolbar - Sticky toolbar, if fixed toolbar chrome is shown.
 * @param enabled - Whether the host asked for an outline in a wide document layout.
 * @param comments - Whether the comment rail also takes width beside the document.
 * @returns Presentation mode, whether pinning fits, the reader's collapse choice, toolbar height and the reading line.
 */
export function useOutlineLayout(root: Ref<HTMLElement | null>, toolbar: Ref<HTMLElement | null>, enabled: () => boolean, comments: () => boolean = () => false) {
  const width = shallowRef(0), toolbarHeight = shallowRef(0), collapsed = shallowRef(false);
  // The comment rail pins content below the toolbar too, so its height matters without an outline.
  watch([root, toolbar, () => enabled() || comments()] as const, ([element, bar, on], _previous, cleanup) => {
    const Observer = element?.ownerDocument.defaultView?.ResizeObserver;
    if (!element || !on || !Observer) return;
    const observer = new Observer(() => {
      width.value = element.getBoundingClientRect().width;
      toolbarHeight.value = bar?.getBoundingClientRect().height ?? 0;
    });
    observer.observe(element); if (bar) observer.observe(bar);
    cleanup(() => observer.disconnect());
  }, { immediate: true });
  const pinnable = computed(() => width.value >= sideMinWidth + (comments() ? commentReserve : 0));
  const mode = computed(() => !enabled() ? "none" as const : pinnable.value && !collapsed.value ? "side" as const : "toggle" as const);
  /** @returns Client y below the sticky toolbar, or below the editor top without one. */
  function readingLine(): number {
    const bar = toolbar.value?.getBoundingClientRect(), top = root.value?.getBoundingClientRect().top ?? 0;
    return (bar && bar.height ? bar.bottom : Math.max(0, top)) + readingOffset;
  }
  return { mode, pinnable, collapsed, toolbarHeight, readingLine };
}
